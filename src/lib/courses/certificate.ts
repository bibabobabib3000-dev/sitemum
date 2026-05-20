import { getDb, isDbConfigured } from "@/lib/db";
import { hasAccess } from "@/lib/payments/access";

/**
 * Level 2 certificate gate.
 *
 * Issuing the Level 2 certificate is blocked behind a manual review of a
 * case study (`cases` table, see `migrations/0007_cases.sql`). The student
 * submits text + an optional video URL, an admin flips `approved=true`,
 * and `canIssueCertificate` then returns true.
 *
 * No actual PDF/PNG certificate is generated in this PR — downstream UI
 * uses these helpers to decide what to render.
 */

export type CaseStudyStatus = "missing" | "pending" | "approved";

export interface CaseStudy {
  userId: string;
  bodyUk: string;
  videoUrl: string | null;
  approved: boolean;
  submittedAt: Date;
  approvedAt: Date | null;
}

interface CaseStudyRow {
  user_id: string;
  body_uk: string;
  video_url: string | null;
  approved: boolean;
  submitted_at: string | Date;
  approved_at: string | Date | null;
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function toCaseStudy(r: CaseStudyRow): CaseStudy {
  return {
    userId: r.user_id,
    bodyUk: r.body_uk,
    videoUrl: r.video_url,
    approved: r.approved,
    submittedAt: toDate(r.submitted_at),
    approvedAt: r.approved_at ? toDate(r.approved_at) : null,
  };
}

export async function getCaseStudy(userId: string): Promise<CaseStudy | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select user_id, body_uk, video_url, approved, submitted_at, approved_at
    from cases
    where user_id = ${userId}::uuid
    limit 1
  `) as CaseStudyRow[];
  return rows[0] ? toCaseStudy(rows[0]) : null;
}

export function caseStudyStatus(c: CaseStudy | null): CaseStudyStatus {
  if (!c) return "missing";
  return c.approved ? "approved" : "pending";
}

export interface RecordCaseStudyInput {
  userId: string;
  bodyUk: string;
  videoUrl: string | null;
}

/**
 * Insert or update the case study row for a user. Resubmissions reset
 * `approved=false` and bump `submitted_at` so the admin gets a fresh
 * review queue.
 */
export async function recordCaseStudy(
  input: RecordCaseStudyInput
): Promise<CaseStudy | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    insert into cases (user_id, body_uk, video_url)
    values (${input.userId}::uuid, ${input.bodyUk}, ${input.videoUrl})
    on conflict (user_id) do update
      set body_uk = excluded.body_uk,
          video_url = excluded.video_url,
          approved = false,
          approved_at = null,
          submitted_at = now()
    returning user_id, body_uk, video_url, approved, submitted_at, approved_at
  `) as CaseStudyRow[];
  return rows[0] ? toCaseStudy(rows[0]) : null;
}

/**
 * Final gate: can this user receive the Level 2 certificate today?
 *
 * Requires:
 * 1. Paid `access` row for `level-2`.
 * 2. A `cases` row with `approved = true`.
 */
export async function canIssueCertificate(userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const owns = await hasAccess(userId, "level-2");
  if (!owns) return false;
  const cs = await getCaseStudy(userId);
  return Boolean(cs?.approved);
}
