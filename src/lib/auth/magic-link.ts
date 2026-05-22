import { getDb, isDbConfigured } from "@/lib/db";

/**
 * Magic-link helpers. We never persist the raw token — only SHA-256 hash of
 * it goes into the database. The full token is only sent to the user via
 * Resend. Tokens are single-use (consumed_at is set on first verify).
 */

const TOKEN_BYTES = 32;
/** Tokens older than this are considered expired (in addition to consumption). */
const TOKEN_TTL_MIN = 30;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateRawToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  const arr = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < arr.length; i += 1) {
    hex += arr[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Upsert a `users` row by email and store a fresh email_verifications row.
 * Returns the raw token so it can be embedded in the magic link.
 */
export async function issueMagicLink(opts: {
  email: string;
  locale: "uk" | "ru";
}): Promise<{ token: string; userId: string } | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const userRows = (await sql`
    insert into users (email, locale)
    values (${opts.email.toLowerCase()}, ${opts.locale})
    on conflict (email) do update
      set updated_at = now()
    returning id
  `) as { id: string }[];
  const userId = userRows[0]?.id;
  if (!userId) return null;

  const token = generateRawToken();
  const tokenHash = await sha256Hex(token);

  await sql`
    insert into email_verifications (token_hash, user_id)
    values (${tokenHash}, ${userId}::uuid)
    on conflict (token_hash) do nothing
  `;

  return { token, userId };
}

export interface ConsumedToken {
  userId: string;
  email: string;
}

/**
 * Verify and consume a magic-link token. Returns null if the token is
 * unknown, expired, or already consumed.
 */
export async function consumeMagicLink(token: string): Promise<ConsumedToken | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const tokenHash = await sha256Hex(token);
  const rows = (await sql`
    update email_verifications v
      set consumed_at = now()
    from users u
    where v.token_hash = ${tokenHash}
      and v.user_id = u.id
      and v.consumed_at is null
      and v.created_at > now() - make_interval(mins => ${TOKEN_TTL_MIN})
    returning u.id as user_id, u.email
  `) as { user_id: string; email: string }[];
  if (!rows[0]) return null;
  return { userId: rows[0].user_id, email: rows[0].email };
}

/**
 * True when `users.banned_at` is set for the given user. Lives here (next
 * to the magic-link helpers) so the edge-runtime verify route doesn't
 * pull in the much heavier admin module just to read a single column.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    select 1
    from users
    where id = ${userId}::uuid
      and banned_at is not null
    limit 1
  `) as unknown[];
  return rows.length > 0;
}
