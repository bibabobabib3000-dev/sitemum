import { getDb, isDbConfigured } from "@/lib/db";
import { hasAccess } from "@/lib/payments/access";
import type { ProductSlug } from "@/lib/payments/catalog";
import {
  canIssueCertificate as canIssueLevel2Certificate,
  caseStudyStatus,
  getCaseStudy,
  type CaseStudyStatus,
} from "@/lib/courses/certificate";

/**
 * Repo helpers and access gates for the courses layer.
 *
 * A user can OPEN a course if they have a matching `access` row (granted
 * by the `/api/pay/<provider>/webhook` handlers). A user can SEE A LESSON
 * if (a) they have access AND (b) the lesson's day_offset has elapsed
 * since their enrollment.
 */

export interface Course {
  slug: string;
  titleUk: string;
  titleRu: string | null;
  descriptionUk: string | null;
  descriptionRu: string | null;
}

export interface Lesson {
  id: string;
  courseSlug: string;
  slug: string;
  dayOffset: number;
  titleUk: string;
  titleRu: string | null;
  bodyMdUk: string | null;
  bodyMdRu: string | null;
  videoKey: string | null;
  audioKey: string | null;
  assetKeys: string[];
}

export interface Enrollment {
  userId: string;
  courseSlug: string;
  startedAt: Date;
}

/**
 * Map course slug to the product slug that unlocks it. Today they are 1:1
 * (`level-0` course is unlocked by `level-0` product).
 */
const COURSE_TO_PRODUCT: Record<string, ProductSlug> = {
  "level-0": "level-0",
  "level-1": "level-1",
  "level-2": "level-2",
};

export async function getCourse(slug: string): Promise<Course | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select slug, title_uk, title_ru, description_uk, description_ru
    from courses
    where slug = ${slug}
    limit 1
  `) as {
    slug: string;
    title_uk: string;
    title_ru: string | null;
    description_uk: string | null;
    description_ru: string | null;
  }[];
  const r = rows[0];
  if (!r) return null;
  return {
    slug: r.slug,
    titleUk: r.title_uk,
    titleRu: r.title_ru,
    descriptionUk: r.description_uk,
    descriptionRu: r.description_ru,
  };
}

export async function listLessons(courseSlug: string): Promise<Lesson[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select id, course_slug, slug, day_offset, title_uk, title_ru,
           body_md_uk, body_md_ru, video_key, audio_key, asset_keys
    from lessons
    where course_slug = ${courseSlug}
    order by day_offset asc
  `) as {
    id: string;
    course_slug: string;
    slug: string;
    day_offset: number;
    title_uk: string;
    title_ru: string | null;
    body_md_uk: string | null;
    body_md_ru: string | null;
    video_key: string | null;
    audio_key: string | null;
    asset_keys: string[] | null;
  }[];
  return rows.map(toLesson);
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string
): Promise<Lesson | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select id, course_slug, slug, day_offset, title_uk, title_ru,
           body_md_uk, body_md_ru, video_key, audio_key, asset_keys
    from lessons
    where course_slug = ${courseSlug} and slug = ${lessonSlug}
    limit 1
  `) as {
    id: string;
    course_slug: string;
    slug: string;
    day_offset: number;
    title_uk: string;
    title_ru: string | null;
    body_md_uk: string | null;
    body_md_ru: string | null;
    video_key: string | null;
    audio_key: string | null;
    asset_keys: string[] | null;
  }[];
  return rows[0] ? toLesson(rows[0]) : null;
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select id, course_slug, slug, day_offset, title_uk, title_ru,
           body_md_uk, body_md_ru, video_key, audio_key, asset_keys
    from lessons
    where id = ${id}::uuid
    limit 1
  `) as {
    id: string;
    course_slug: string;
    slug: string;
    day_offset: number;
    title_uk: string;
    title_ru: string | null;
    body_md_uk: string | null;
    body_md_ru: string | null;
    video_key: string | null;
    audio_key: string | null;
    asset_keys: string[] | null;
  }[];
  return rows[0] ? toLesson(rows[0]) : null;
}

function toLesson(r: {
  id: string;
  course_slug: string;
  slug: string;
  day_offset: number;
  title_uk: string;
  title_ru: string | null;
  body_md_uk: string | null;
  body_md_ru: string | null;
  video_key: string | null;
  audio_key: string | null;
  asset_keys: string[] | null;
}): Lesson {
  return {
    id: r.id,
    courseSlug: r.course_slug,
    slug: r.slug,
    dayOffset: r.day_offset,
    titleUk: r.title_uk,
    titleRu: r.title_ru,
    bodyMdUk: r.body_md_uk,
    bodyMdRu: r.body_md_ru,
    videoKey: r.video_key,
    audioKey: r.audio_key,
    assetKeys: r.asset_keys ?? [],
  };
}

export async function getEnrollment(
  userId: string,
  courseSlug: string
): Promise<Enrollment | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select user_id, course_slug, started_at
    from enrollments
    where user_id = ${userId}::uuid and course_slug = ${courseSlug}
    limit 1
  `) as { user_id: string; course_slug: string; started_at: string | Date }[];
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.user_id,
    courseSlug: r.course_slug,
    startedAt: r.started_at instanceof Date ? r.started_at : new Date(r.started_at),
  };
}

/**
 * Create an enrollment row on first course open. Returns the canonical
 * enrollment (either freshly inserted or the existing one).
 */
export async function ensureEnrollment(
  userId: string,
  courseSlug: string
): Promise<Enrollment | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    insert into enrollments (user_id, course_slug)
    values (${userId}::uuid, ${courseSlug})
    on conflict (user_id, course_slug) do update
      set course_slug = excluded.course_slug
    returning user_id, course_slug, started_at
  `) as { user_id: string; course_slug: string; started_at: string | Date }[];
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.user_id,
    courseSlug: r.course_slug,
    startedAt: r.started_at instanceof Date ? r.started_at : new Date(r.started_at),
  };
}

/**
 * Strict access check: must have a paid `access` row.
 */
export async function canEnterCourse(
  userId: string,
  courseSlug: string
): Promise<boolean> {
  const product = COURSE_TO_PRODUCT[courseSlug];
  if (!product) return false;
  return hasAccess(userId, product);
}

/**
 * Level 2 certificate gate.
 *
 * Returns whether the certificate can be issued today AND the current state
 * of the case study (so the dashboard can render the right CTA without a
 * second roundtrip).
 *
 * - `caseStudy: "missing"` → user has not submitted the case study form.
 * - `caseStudy: "pending"` → submitted, awaiting admin approval.
 * - `caseStudy: "approved"` → cleared; `certificate` is true iff the user
 *   also owns the `level-2` product.
 */
export interface Level2GateState {
  hasLevel2Access: boolean;
  caseStudy: CaseStudyStatus;
  certificate: boolean;
}

export async function getLevel2Gate(userId: string): Promise<Level2GateState> {
  const [owns, cs] = await Promise.all([
    hasAccess(userId, "level-2"),
    getCaseStudy(userId),
  ]);
  const status = caseStudyStatus(cs);
  return {
    hasLevel2Access: owns,
    caseStudy: status,
    certificate: owns && status === "approved",
  };
}

export { canIssueLevel2Certificate };

export interface HomeworkSubmissionInput {
  userId: string;
  lessonId: string;
  bodyText: string | null;
  externalUrl: string | null;
  fileKeys: string[];
}

export async function recordHomework(
  input: HomeworkSubmissionInput
): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    insert into homework_submissions (
      user_id, lesson_id, body_text, external_url, file_keys
    )
    values (
      ${input.userId}::uuid,
      ${input.lessonId}::uuid,
      ${input.bodyText},
      ${input.externalUrl},
      ${input.fileKeys}
    )
    returning id
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

export interface HomeworkRow {
  id: string;
  bodyText: string | null;
  externalUrl: string | null;
  fileKeys: string[];
  createdAt: Date;
}

export async function listHomework(
  userId: string,
  lessonId: string,
  limit = 5
): Promise<HomeworkRow[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select id, body_text, external_url, file_keys, created_at
    from homework_submissions
    where user_id = ${userId}::uuid and lesson_id = ${lessonId}::uuid
    order by created_at desc
    limit ${limit}
  `) as {
    id: string;
    body_text: string | null;
    external_url: string | null;
    file_keys: string[] | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    id: r.id,
    bodyText: r.body_text,
    externalUrl: r.external_url,
    fileKeys: r.file_keys ?? [],
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
  }));
}
