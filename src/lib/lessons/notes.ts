import { getDb, isDbConfigured } from "@/lib/db";

/**
 * Per-lesson notes + bookmarks repo (PR B2).
 *
 * The two relations are intentionally tiny:
 *
 *  - `lesson_notes (user_id, lesson_id, body_md, updated_at, created_at)`
 *  - `lesson_bookmarks (user_id, lesson_id, created_at)`
 *
 * The note's `body_md` is a plain UTF-8 string with a soft cap of
 * 20 000 chars (enforced at the API boundary). We do not version edits —
 * the autosave loop just overwrites the row.
 *
 * Every function degrades to a safe empty/no-op when DB is not
 * configured, so the dashboard renders cleanly in stub mode.
 */

export const NOTE_BODY_MAX = 20_000;

export interface LessonNote {
  userId: string;
  lessonId: string;
  bodyMd: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface LessonNoteListItem {
  lessonId: string;
  courseSlug: string | null;
  lessonSlug: string | null;
  titleUk: string | null;
  titleRu: string | null;
  bodyMd: string;
  updatedAt: Date;
}

export interface LessonBookmarkListItem {
  lessonId: string;
  courseSlug: string | null;
  lessonSlug: string | null;
  titleUk: string | null;
  titleRu: string | null;
  dayOffset: number | null;
  createdAt: Date;
}

interface RawNoteRow {
  user_id: string;
  lesson_id: string;
  body_md: string;
  updated_at: string | Date;
  created_at: string | Date;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNote(row: RawNoteRow): LessonNote {
  return {
    userId: row.user_id,
    lessonId: row.lesson_id,
    bodyMd: row.body_md,
    updatedAt: toDate(row.updated_at),
    createdAt: toDate(row.created_at),
  };
}

export async function getNote(
  userId: string,
  lessonId: string,
): Promise<LessonNote | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select user_id, lesson_id, body_md, updated_at, created_at
    from lesson_notes
    where user_id = ${userId}::uuid
      and lesson_id = ${lessonId}::uuid
    limit 1
  `) as RawNoteRow[];
  if (rows.length === 0) return null;
  return toNote(rows[0]);
}

/**
 * Upsert a note. Trims to NOTE_BODY_MAX. Returns the persisted row.
 * If `body_md` is empty after trimming, the row is deleted and `null`
 * is returned — the absence of a row is the canonical empty state.
 */
export async function upsertNote(
  userId: string,
  lessonId: string,
  bodyMd: string,
): Promise<LessonNote | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const trimmed = bodyMd.length > NOTE_BODY_MAX
    ? bodyMd.slice(0, NOTE_BODY_MAX)
    : bodyMd;
  if (trimmed.trim() === "") {
    await sql`
      delete from lesson_notes
      where user_id = ${userId}::uuid
        and lesson_id = ${lessonId}::uuid
    `;
    return null;
  }
  const rows = (await sql`
    insert into lesson_notes (user_id, lesson_id, body_md, updated_at)
    values (${userId}::uuid, ${lessonId}::uuid, ${trimmed}, now())
    on conflict (user_id, lesson_id)
      do update set body_md = excluded.body_md, updated_at = now()
    returning user_id, lesson_id, body_md, updated_at, created_at
  `) as RawNoteRow[];
  if (rows.length === 0) return null;
  return toNote(rows[0]);
}

export async function listNotes(
  userId: string,
  limit: number = 200,
): Promise<LessonNoteListItem[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select n.lesson_id,
           l.course_slug,
           l.slug as lesson_slug,
           l.title_uk,
           l.title_ru,
           n.body_md,
           n.updated_at
    from lesson_notes n
    left join lessons l on l.id = n.lesson_id
    where n.user_id = ${userId}::uuid
    order by n.updated_at desc
    limit ${limit}
  `) as {
    lesson_id: string;
    course_slug: string | null;
    lesson_slug: string | null;
    title_uk: string | null;
    title_ru: string | null;
    body_md: string;
    updated_at: string | Date;
  }[];
  return rows.map((r) => ({
    lessonId: r.lesson_id,
    courseSlug: r.course_slug,
    lessonSlug: r.lesson_slug,
    titleUk: r.title_uk,
    titleRu: r.title_ru,
    bodyMd: r.body_md,
    updatedAt: toDate(r.updated_at),
  }));
}

export async function isBookmarked(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    select 1
    from lesson_bookmarks
    where user_id = ${userId}::uuid
      and lesson_id = ${lessonId}::uuid
    limit 1
  `) as unknown[];
  return rows.length > 0;
}

/**
 * Add or remove a bookmark. Returns the new state.
 *
 * We accept an explicit `desired` flag so the client can be
 * idempotent — e.g. retrying after a network blip doesn't flip the
 * state back to the previous value.
 */
export async function setBookmark(
  userId: string,
  lessonId: string,
  desired: boolean,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  if (desired) {
    await sql`
      insert into lesson_bookmarks (user_id, lesson_id)
      values (${userId}::uuid, ${lessonId}::uuid)
      on conflict (user_id, lesson_id) do nothing
    `;
    return true;
  }
  await sql`
    delete from lesson_bookmarks
    where user_id = ${userId}::uuid
      and lesson_id = ${lessonId}::uuid
  `;
  return false;
}

export async function listBookmarks(
  userId: string,
  limit: number = 200,
): Promise<LessonBookmarkListItem[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select b.lesson_id,
           l.course_slug,
           l.slug as lesson_slug,
           l.title_uk,
           l.title_ru,
           l.day_offset,
           b.created_at
    from lesson_bookmarks b
    left join lessons l on l.id = b.lesson_id
    where b.user_id = ${userId}::uuid
    order by b.created_at desc
    limit ${limit}
  `) as {
    lesson_id: string;
    course_slug: string | null;
    lesson_slug: string | null;
    title_uk: string | null;
    title_ru: string | null;
    day_offset: number | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    lessonId: r.lesson_id,
    courseSlug: r.course_slug,
    lessonSlug: r.lesson_slug,
    titleUk: r.title_uk,
    titleRu: r.title_ru,
    dayOffset: r.day_offset,
    createdAt: toDate(r.created_at),
  }));
}
