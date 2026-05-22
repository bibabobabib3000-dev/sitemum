import { getDb, isDbConfigured } from "@/lib/db";
import type { NotificationPrefs } from "@/lib/auth/user";

/**
 * Universal notification dispatcher.
 *
 * Callers describe *what* happened (`kind` + `payload`) and *which*
 * channels they care about. We:
 *
 *  1. Look up the recipient's `notification_prefs` (PR B1).
 *  2. Intersect requested channels with the user's prefs.
 *  3. Write a single `notifications` row when `in_app` is enabled.
 *  4. Write one `outbox` row per enabled external channel.
 *
 * `outbox` rows are picked up later by `/api/cron/outbox-drain`. The
 * in-app row appears in the bell dropdown immediately.
 *
 * In stub mode (no DB), every call is a successful no-op — the calling
 * route returns its primary result and the notification is silently
 * dropped. The same contract makes the function safe to call from
 * tests without mocking.
 */

export type NotificationKind =
  | "case.approved"
  | "case.rejected"
  | "payment.success"
  | "lesson.unlocked"
  | "system.info";

export type Channel = "in_app" | "email" | "telegram";

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  /**
   * Channels the caller would like to use. The user's
   * `notification_prefs` is intersected with this set; the user is
   * always the source of truth.
   *
   * Defaults to `["in_app", "email", "telegram"]` — i.e. "use whatever
   * the user opted into".
   */
  channels?: Channel[];
  /**
   * Kind-specific JSON blob. The UI / outbox-drain knows how to render
   * each kind. Keep this small (under ~4 KB) — it's stored verbatim.
   */
  payload?: Record<string, unknown>;
  /**
   * Defer the outbox sends until this point. Defaults to now. Useful
   * for "X happens in 24h" reminders.
   */
  sendAfter?: Date;
}

export interface DispatchResult {
  inAppId: string | null;
  outboxIds: string[];
  effectiveChannels: Channel[];
}

const DEFAULT_CHANNELS: Channel[] = ["in_app", "email", "telegram"];

const ALL_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  "case.approved",
  "case.rejected",
  "payment.success",
  "lesson.unlocked",
  "system.info",
]);

export function isNotificationKind(value: string): value is NotificationKind {
  return ALL_KINDS.has(value as NotificationKind);
}

interface PrefsRow {
  notification_prefs: NotificationPrefs | null;
}

async function loadPrefs(userId: string): Promise<NotificationPrefs> {
  // Defaults match the migration's `notification_prefs` column default:
  // every channel enabled until the user opts out.
  const fallback: NotificationPrefs = {
    email: true,
    telegram: true,
    in_app: true,
  };
  if (!isDbConfigured()) return fallback;
  const sql = getDb()!;
  const rows = (await sql`
    select notification_prefs
    from users
    where id = ${userId}::uuid
    limit 1
  `) as PrefsRow[];
  if (rows.length === 0) return fallback;
  const raw = rows[0].notification_prefs;
  if (!raw) return fallback;
  return {
    email: Boolean(raw.email),
    telegram: Boolean(raw.telegram),
    in_app: Boolean(raw.in_app),
  };
}

function effective(
  requested: Channel[] | undefined,
  prefs: NotificationPrefs,
): Channel[] {
  const r = requested ?? DEFAULT_CHANNELS;
  const out: Channel[] = [];
  if (r.includes("in_app") && prefs.in_app) out.push("in_app");
  if (r.includes("email") && prefs.email) out.push("email");
  if (r.includes("telegram") && prefs.telegram) out.push("telegram");
  return out;
}

export async function notify(input: NotifyInput): Promise<DispatchResult> {
  const empty: DispatchResult = {
    inAppId: null,
    outboxIds: [],
    effectiveChannels: [],
  };

  if (!isDbConfigured()) return empty;
  const sql = getDb()!;

  const prefs = await loadPrefs(input.userId);
  const channels = effective(input.channels, prefs);
  if (channels.length === 0) return empty;

  const payload = input.payload ?? {};
  const result: DispatchResult = {
    inAppId: null,
    outboxIds: [],
    effectiveChannels: channels,
  };

  if (channels.includes("in_app")) {
    const rows = (await sql`
      insert into notifications (user_id, kind, payload)
      values (${input.userId}::uuid, ${input.kind}, ${JSON.stringify(payload)}::jsonb)
      returning id
    `) as { id: string }[];
    result.inAppId = rows[0]?.id ?? null;
  }

  // Outbox rows are tagged with the kind so the drain can pick the
  // right template/parser. `send_after` defaults to now in SQL.
  const sendAfter = input.sendAfter ?? null;
  for (const ch of channels) {
    if (ch === "in_app") continue;
    const rows = (await sql`
      insert into outbox (user_id, channel, payload, send_after)
      values (
        ${input.userId}::uuid,
        ${ch},
        ${JSON.stringify({ kind: input.kind, ...payload })}::jsonb,
        coalesce(${sendAfter ? sendAfter.toISOString() : null}::timestamptz, now())
      )
      returning id
    `) as { id: string }[];
    if (rows[0]?.id) result.outboxIds.push(rows[0].id);
  }

  return result;
}
