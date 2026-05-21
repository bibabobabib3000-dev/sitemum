import { getDb, isDbConfigured } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth/session";

/**
 * Resolved admin context for a request. Returned by `getAdminContext` and
 * surfaced via `requireAdmin` to layout / RPC handlers.
 */
export interface AdminContext {
  session: SessionPayload;
  userId: string;
  email: string;
  fullName: string | null;
}

/**
 * Discriminated outcome of the admin check, so callers can branch on the
 * shape (e.g. layouts trigger `notFound()` on `forbidden`, API routes
 * return a 401/403 JSON response).
 */
export type AdminCheck =
  | { kind: "ok"; ctx: AdminContext }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" };

interface AdminLookupRow {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
}

/**
 * Resolves the current session into an admin context without throwing.
 *
 * Returns:
 *  - `unauthenticated` — no session cookie / expired signature.
 *  - `forbidden`       — signed-in user but `is_admin = false`, or the
 *                        DB is not configured (admin surface is off).
 *  - `ok`              — caller is an admin; `ctx` is safe to use.
 *
 * Side effects (only on `ok`):
 *  - Touches `users.last_seen_at` to power the support tooling that needs
 *    to see "last admin activity" without bolting on a separate table.
 *    Failures are swallowed — the read path matters more than the metric.
 */
export async function getAdminContext(): Promise<AdminCheck> {
  const session = await getSession();
  if (!session) return { kind: "unauthenticated" };

  if (!isDbConfigured()) return { kind: "forbidden" };

  const sql = getDb()!;
  const rows = (await sql`
    select id, email, full_name, is_admin
    from users
    where id = ${session.uid}::uuid
    limit 1
  `) as AdminLookupRow[];

  const row = rows[0];
  if (!row || !row.is_admin) return { kind: "forbidden" };

  try {
    await sql`
      update users
      set last_seen_at = now()
      where id = ${session.uid}::uuid
    `;
  } catch {
    /* best-effort */
  }

  return {
    kind: "ok",
    ctx: {
      session,
      userId: row.id,
      email: row.email,
      fullName: row.full_name,
    },
  };
}

/**
 * Convenience wrapper for layouts / pages: returns the admin context or
 * throws a tagged error you can intercept higher up.
 *
 * Most callers should prefer `getAdminContext` and react to each kind
 * explicitly (e.g. redirect unauthenticated to /login, notFound on
 * forbidden to hide the admin surface from unauthorized eyes).
 */
export async function requireAdmin(): Promise<AdminContext> {
  const result = await getAdminContext();
  if (result.kind === "ok") return result.ctx;
  throw new AdminAccessError(result.kind);
}

export class AdminAccessError extends Error {
  readonly kind: "unauthenticated" | "forbidden";
  constructor(kind: "unauthenticated" | "forbidden") {
    super(`admin access denied: ${kind}`);
    this.name = "AdminAccessError";
    this.kind = kind;
  }
}

/**
 * Append-only audit log entry. Used by every admin-side mutation we
 * will add in subsequent PRs (PR A2 case approvals, A3 access grants,
 * A5 content edits, etc.).
 */
export async function writeAuditLog(input: {
  actorUserId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  if (!isDbConfigured()) return;
  const sql = getDb()!;
  const payload = JSON.stringify(input.payload ?? {});
  await sql`
    insert into audit_log (actor_user_id, action, target_type, target_id, payload)
    values (
      ${input.actorUserId ?? null}::uuid,
      ${input.action},
      ${input.targetType ?? null},
      ${input.targetId ?? null},
      ${payload}::jsonb
    )
  `;
}
