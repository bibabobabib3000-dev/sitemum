import { getDb, isDbConfigured } from "@/lib/db";
import type { NotificationKind } from "./dispatch";

/**
 * Read-side helpers for the in-app notifications inbox.
 *
 * The bell dropdown uses `countUnread` and `listNotifications`; the
 * "Mark all read" button calls `markAllRead`; clicking a single item
 * calls `markRead(id)`.
 *
 * Every function degrades to a safe empty/no-op when DB is not
 * configured so the dashboard renders cleanly in stub mode.
 */

export interface InAppNotification {
  id: string;
  kind: NotificationKind | string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

interface RawRow {
  id: string;
  kind: string;
  payload: unknown;
  read_at: string | Date | null;
  created_at: string | Date;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNotification(row: RawRow): InAppNotification {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    kind: row.kind,
    payload,
    readAt: row.read_at ? toDate(row.read_at) : null,
    createdAt: toDate(row.created_at),
  };
}

export async function countUnread(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const sql = getDb()!;
  const rows = (await sql`
    select count(*)::int as n
    from notifications
    where user_id = ${userId}::uuid
      and read_at is null
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function listNotifications(
  userId: string,
  limit: number = 20,
): Promise<InAppNotification[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select id, kind, payload, read_at, created_at
    from notifications
    where user_id = ${userId}::uuid
    order by created_at desc
    limit ${limit}
  `) as RawRow[];
  return rows.map(toNotification);
}

export async function markRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    update notifications
    set read_at = coalesce(read_at, now())
    where user_id = ${userId}::uuid
      and id = ${notificationId}::uuid
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const sql = getDb()!;
  const rows = (await sql`
    update notifications
    set read_at = now()
    where user_id = ${userId}::uuid
      and read_at is null
    returning id
  `) as { id: string }[];
  return rows.length;
}
