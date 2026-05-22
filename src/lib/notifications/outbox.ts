import { getDb, isDbConfigured } from "@/lib/db";

/**
 * Outbox repo — the persistent queue feeding `/api/cron/outbox-drain`.
 *
 * Rows are written by `notifications/dispatch.ts` (one per off-app
 * channel) and stamped `sent_at` (or `error_text`) by the drain. The
 * `attempts` counter is incremented every time we touch the row, so a
 * failed batch doesn't loop forever — the drain caps attempts at
 * `MAX_ATTEMPTS`.
 */

export const MAX_ATTEMPTS = 5;
export const DEFAULT_DRAIN_BATCH = 25;

export type OutboxChannel = "email" | "telegram";

export interface OutboxRow {
  id: string;
  userId: string | null;
  channel: OutboxChannel;
  /** Includes `kind` plus kind-specific fields the channel-renderer reads. */
  payload: Record<string, unknown>;
  attempts: number;
  sendAfter: Date;
  createdAt: Date;
}

interface RawRow {
  id: string;
  user_id: string | null;
  channel: string;
  payload: unknown;
  attempts: number;
  send_after: string | Date;
  created_at: string | Date;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toOutbox(row: RawRow): OutboxRow {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel === "telegram" ? "telegram" : "email",
    payload,
    attempts: row.attempts,
    sendAfter: toDate(row.send_after),
    createdAt: toDate(row.created_at),
  };
}

export async function fetchPending(limit: number = DEFAULT_DRAIN_BATCH): Promise<OutboxRow[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select id, user_id, channel, payload, attempts, send_after, created_at
    from outbox
    where sent_at is null
      and send_after <= now()
      and attempts < ${MAX_ATTEMPTS}
    order by send_after asc
    limit ${limit}
  `) as RawRow[];
  return rows.map(toOutbox);
}

export async function markSent(id: string): Promise<void> {
  if (!isDbConfigured()) return;
  const sql = getDb()!;
  await sql`
    update outbox
    set sent_at = now(), attempts = attempts + 1, error_text = null
    where id = ${id}::uuid
  `;
}

export async function markFailed(id: string, errorText: string): Promise<void> {
  if (!isDbConfigured()) return;
  const sql = getDb()!;
  const trimmed = errorText.length > 1000 ? errorText.slice(0, 1000) : errorText;
  await sql`
    update outbox
    set attempts = attempts + 1,
        error_text = ${trimmed}
    where id = ${id}::uuid
  `;
}
