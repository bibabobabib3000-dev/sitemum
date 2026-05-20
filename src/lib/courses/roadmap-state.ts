import { getDb, isDbConfigured } from "@/lib/db";
import { CATALOG, type ProductSlug } from "@/lib/payments/catalog";
import { isUnlocked } from "@/lib/courses/drip";

/**
 * Roadmap state: derives the "L0 → L1 → L2" progression for a single user
 * from three relations:
 *
 *   - `access`   — paid grants (granted_at, expires_at).
 *   - `enrollments` — per-course start time; drives drip unlock.
 *   - `homework_submissions` — count of submissions per lesson.
 *   - `lessons` — total lesson count per course (drip horizon).
 *
 * A milestone is `done` when the user has paid access, an enrollment that
 * already unlocked every lesson in that course, and has submitted homework
 * for every lesson. `active` when they have access but the course is still
 * in progress (drip not finished or homework not all in). `locked` when
 * there is no `access` row yet.
 */

export type MilestoneState = "locked" | "active" | "done";

export interface Milestone {
  id: ProductSlug;
  title: string;
  date?: Date;
  state: MilestoneState;
  lessonsTotal: number;
  lessonsUnlocked: number;
  homeworkDone: number;
}

/** Canonical order of the user-facing roadmap. */
const ORDER: ProductSlug[] = ["level-0", "level-1", "level-2"];

interface AccessRow {
  product_slug: string;
  granted_at: string | Date;
}

interface EnrollmentRow {
  course_slug: string;
  started_at: string | Date;
}

interface LessonStatRow {
  course_slug: string;
  total: string | number;
  max_offset: string | number | null;
}

interface HomeworkStatRow {
  course_slug: string;
  done: string | number;
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function toInt(v: string | number | null): number {
  if (v === null) return 0;
  return typeof v === "number" ? v : Number.parseInt(v, 10) || 0;
}

/**
 * Compute the user's roadmap. Always returns three milestones in canonical
 * order (level-0, level-1, level-2). Falls back to all-locked when the DB
 * is not configured.
 */
export async function getRoadmap(userId: string): Promise<Milestone[]> {
  if (!isDbConfigured()) {
    return ORDER.map((id) => ({
      id,
      title: CATALOG[id].titleUk,
      state: "locked",
      lessonsTotal: 0,
      lessonsUnlocked: 0,
      homeworkDone: 0,
    }));
  }

  const sql = getDb()!;

  const [rawAccess, rawEnrollments, rawLessonStats, rawHomeworkStats] =
    await Promise.all([
      sql`
        select product_slug, granted_at
        from access
        where user_id = ${userId}::uuid
          and (expires_at is null or expires_at > now())
      `,
      sql`
        select course_slug, started_at
        from enrollments
        where user_id = ${userId}::uuid
      `,
      sql`
        select course_slug, count(*)::text as total, max(day_offset)::text as max_offset
        from lessons
        group by course_slug
      `,
      sql`
        select l.course_slug, count(distinct h.lesson_id)::text as done
        from homework_submissions h
        join lessons l on l.id = h.lesson_id
        where h.user_id = ${userId}::uuid
        group by l.course_slug
      `,
    ]);
  const accessRows = rawAccess as AccessRow[];
  const enrollmentRows = rawEnrollments as EnrollmentRow[];
  const lessonStatRows = rawLessonStats as LessonStatRow[];
  const homeworkStatRows = rawHomeworkStats as HomeworkStatRow[];

  const accessBySlug = new Map<string, Date>();
  for (const row of accessRows) accessBySlug.set(row.product_slug, toDate(row.granted_at));

  const enrollmentBySlug = new Map<string, Date>();
  for (const row of enrollmentRows) {
    enrollmentBySlug.set(row.course_slug, toDate(row.started_at));
  }

  const lessonStatBySlug = new Map<string, { total: number; maxOffset: number }>();
  for (const row of lessonStatRows) {
    lessonStatBySlug.set(row.course_slug, {
      total: toInt(row.total),
      maxOffset: toInt(row.max_offset),
    });
  }

  const homeworkBySlug = new Map<string, number>();
  for (const row of homeworkStatRows) homeworkBySlug.set(row.course_slug, toInt(row.done));

  const now = new Date();

  return ORDER.map((slug) => {
    const grantedAt = accessBySlug.get(slug);
    const enrolledAt = enrollmentBySlug.get(slug);
    const lessonStat = lessonStatBySlug.get(slug);
    const total = lessonStat?.total ?? 0;
    const maxOffset = lessonStat?.maxOffset ?? 0;
    const homeworkDone = homeworkBySlug.get(slug) ?? 0;

    const allUnlocked =
      total > 0 && enrolledAt !== undefined && isUnlocked(now, enrolledAt, maxOffset);
    const allHomework = total > 0 && homeworkDone >= total;

    let state: MilestoneState;
    if (!grantedAt) state = "locked";
    else if (total > 0 && allUnlocked && allHomework) state = "done";
    else state = "active";

    const lessonsUnlocked = (() => {
      if (!enrolledAt || total === 0) return 0;
      // Drip steps are integer days starting from `started_at`; floor the
      // elapsed days to find how many lessons are currently visible.
      const elapsedMs = now.getTime() - enrolledAt.getTime();
      const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
      return Math.max(0, Math.min(total, elapsedDays + 1));
    })();

    return {
      id: slug,
      title: CATALOG[slug].titleUk,
      date: grantedAt,
      state,
      lessonsTotal: total,
      lessonsUnlocked,
      homeworkDone,
    };
  });
}
