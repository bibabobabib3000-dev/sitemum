import { getDb, isDbConfigured } from "@/lib/db";

export interface EventRow {
  id: string;
  slug: string;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  startAt: string;
  durationMin: number;
  topicUk: string;
  topicRu: string | null;
}

interface RawEventRow {
  id: string;
  slug: string;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  start_at: string | Date;
  duration_min: number;
  topic_uk: string;
  topic_ru: string | null;
}

function fromRow(row: RawEventRow): EventRow {
  return {
    id: row.id,
    slug: row.slug,
    zoomMeetingId: row.zoom_meeting_id,
    zoomJoinUrl: row.zoom_join_url,
    startAt:
      row.start_at instanceof Date
        ? row.start_at.toISOString()
        : new Date(row.start_at).toISOString(),
    durationMin: row.duration_min,
    topicUk: row.topic_uk,
    topicRu: row.topic_ru,
  };
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select id, slug, zoom_meeting_id, zoom_join_url, start_at,
      duration_min, topic_uk, topic_ru
    from events where slug = ${slug} limit 1
  `) as RawEventRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function registerAttendee(opts: {
  eventId: string;
  userId: string;
}): Promise<{ alreadyRegistered: boolean }> {
  if (!isDbConfigured()) {
    throw new Error("DB not configured");
  }
  const sql = getDb()!;
  const rows = (await sql`
    insert into event_attendees (event_id, user_id)
    values (${opts.eventId}::uuid, ${opts.userId}::uuid)
    on conflict (event_id, user_id) do nothing
    returning event_id
  `) as { event_id: string }[];
  return { alreadyRegistered: rows.length === 0 };
}

export interface PendingReminderRow {
  eventId: string;
  userId: string;
  joinUrl: string | null;
  startAt: string;
  topicUk: string;
  topicRu: string | null;
  userTgId: number | null;
  userLocale: "uk" | "ru";
}

interface RawPendingReminderRow {
  event_id: string;
  user_id: string;
  zoom_join_url: string | null;
  start_at: string | Date;
  topic_uk: string;
  topic_ru: string | null;
  tg_id: string | number | null;
  locale: string | null;
}

function fromPendingRow(row: RawPendingReminderRow): PendingReminderRow {
  return {
    eventId: row.event_id,
    userId: row.user_id,
    joinUrl: row.zoom_join_url,
    startAt:
      row.start_at instanceof Date
        ? row.start_at.toISOString()
        : new Date(row.start_at).toISOString(),
    topicUk: row.topic_uk,
    topicRu: row.topic_ru,
    userTgId: row.tg_id !== null ? Number(row.tg_id) : null,
    userLocale: row.locale === "ru" ? "ru" : "uk",
  };
}

/**
 * Returns attendees whose event starts within ~`minutesBefore` ± `windowMin`
 * minutes and who have not yet received this reminder. Caller is responsible
 * for marking the reminder as sent (markReminderSent) after dispatch.
 *
 * `which = 60` selects reminder_60_sent_at; `which = 15` selects
 * reminder_15_sent_at.
 */
export async function getPendingReminders(opts: {
  which: 60 | 15;
  windowMin: number;
}): Promise<PendingReminderRow[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const { which, windowMin } = opts;

  const upperMin = which + windowMin;
  const lowerMin = which - windowMin;

  const rows =
    which === 60
      ? ((await sql`
          select a.event_id, a.user_id, e.zoom_join_url, e.start_at,
            e.topic_uk, e.topic_ru,
            u.tg_id, u.locale
          from event_attendees a
          join events e on e.id = a.event_id
          join users  u on u.id = a.user_id
          where a.reminder_60_sent_at is null
            and e.start_at > now()
            and e.start_at <= now() + make_interval(mins => ${upperMin})
            and e.start_at >= now() + make_interval(mins => ${lowerMin})
          limit 500
        `) as RawPendingReminderRow[])
      : ((await sql`
          select a.event_id, a.user_id, e.zoom_join_url, e.start_at,
            e.topic_uk, e.topic_ru,
            u.tg_id, u.locale
          from event_attendees a
          join events e on e.id = a.event_id
          join users  u on u.id = a.user_id
          where a.reminder_15_sent_at is null
            and e.start_at > now()
            and e.start_at <= now() + make_interval(mins => ${upperMin})
            and e.start_at >= now() + make_interval(mins => ${lowerMin})
          limit 500
        `) as RawPendingReminderRow[]);

  return rows.map(fromPendingRow);
}

export async function markReminderSent(opts: {
  which: 60 | 15;
  eventId: string;
  userId: string;
}): Promise<void> {
  if (!isDbConfigured()) return;
  const sql = getDb()!;
  if (opts.which === 60) {
    await sql`
      update event_attendees set reminder_60_sent_at = now()
      where event_id = ${opts.eventId}::uuid
        and user_id = ${opts.userId}::uuid
    `;
  } else {
    await sql`
      update event_attendees set reminder_15_sent_at = now()
      where event_id = ${opts.eventId}::uuid
        and user_id = ${opts.userId}::uuid
    `;
  }
}

/**
 * Mark a participant as joined. Idempotent — keeps the earliest joined_at on
 * repeat webhooks. Looks the user up by tg_id (preferred) then by email so
 * the Zoom webhook can match without a participant ID we already have.
 */
export async function markAttendeeJoined(opts: {
  zoomMeetingId: string;
  participantEmail?: string;
}): Promise<{ updated: number }> {
  if (!isDbConfigured()) return { updated: 0 };
  if (!opts.participantEmail) return { updated: 0 };
  const sql = getDb()!;

  const rows = (await sql`
    update event_attendees a
       set joined_at = coalesce(a.joined_at, now())
      from events e, users u
     where a.event_id = e.id
       and a.user_id = u.id
       and e.zoom_meeting_id = ${opts.zoomMeetingId}
       and lower(u.email) = lower(${opts.participantEmail})
    returning a.event_id
  `) as { event_id: string }[];

  return { updated: rows.length };
}
