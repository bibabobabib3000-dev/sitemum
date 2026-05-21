import { getDb, isDbConfigured } from "@/lib/db";

export type CaseReviewStatus = "pending" | "approved" | "all";

export interface AdminCaseRow {
  userId: string;
  email: string;
  fullName: string | null;
  tgUsername: string | null;
  locale: "uk" | "ru";
  approved: boolean;
  submittedAt: Date;
  approvedAt: Date | null;
  reviewerEmail: string | null;
  bodyPreview: string;
  hasVideo: boolean;
}

export interface AdminCaseDetail extends AdminCaseRow {
  bodyUk: string;
  videoUrl: string | null;
  reviewNotesUk: string | null;
  reviewerUserId: string | null;
}

interface ListRow {
  user_id: string;
  email: string;
  full_name: string | null;
  tg_username: string | null;
  locale: string;
  approved: boolean;
  submitted_at: string | Date;
  approved_at: string | Date | null;
  reviewer_email: string | null;
  body_preview: string;
  has_video: boolean;
}

interface DetailRow extends ListRow {
  body_uk: string;
  video_url: string | null;
  review_notes_uk: string | null;
  reviewer_user_id: string | null;
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function rowToBase(r: ListRow): AdminCaseRow {
  return {
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    tgUsername: r.tg_username,
    locale: r.locale === "ru" ? "ru" : "uk",
    approved: r.approved,
    submittedAt: toDate(r.submitted_at),
    approvedAt: r.approved_at ? toDate(r.approved_at) : null,
    reviewerEmail: r.reviewer_email,
    bodyPreview: r.body_preview,
    hasVideo: r.has_video,
  };
}

export interface ListCasesInput {
  status: CaseReviewStatus;
  search: string | null;
  /** 1-based page. */
  page: number;
  pageSize: number;
}

export interface ListCasesResult {
  rows: AdminCaseRow[];
  total: number;
  pendingTotal: number;
  approvedTotal: number;
}

/**
 * Server-side paginated case list for the admin queue.
 *
 * Sort: pending first, then most recent submissions. Approved rows are
 * sorted by approval date so reviewers can scan recent decisions.
 *
 * The `search` parameter does a case-insensitive substring match on
 * email + full_name; we keep this as `ilike` instead of pg_trgm/fts
 * because admin-side row counts are small.
 */
export async function listCases(input: ListCasesInput): Promise<ListCasesResult> {
  if (!isDbConfigured()) {
    return { rows: [], total: 0, pendingTotal: 0, approvedTotal: 0 };
  }
  const sql = getDb()!;

  const limit = Math.max(1, Math.min(input.pageSize, 100));
  const offset = Math.max(0, (input.page - 1) * limit);
  const searchRaw = input.search?.trim() ?? "";
  const searchPattern = searchRaw ? `%${searchRaw}%` : null;

  const rowsRaw = await sql`
    select
      c.user_id,
      u.email,
      u.full_name,
      u.tg_username,
      u.locale,
      c.approved,
      c.submitted_at,
      c.approved_at,
      ru.email as reviewer_email,
      left(coalesce(c.body_uk, ''), 240) as body_preview,
      (c.video_url is not null and length(c.video_url) > 0) as has_video
    from cases c
    join users u on u.id = c.user_id
    left join users ru on ru.id = c.reviewer_user_id
    where
      (${input.status === "all"}::boolean
        or (${input.status === "pending"}::boolean and c.approved = false)
        or (${input.status === "approved"}::boolean and c.approved = true))
      and (
        ${searchPattern}::text is null
        or u.email ilike ${searchPattern}::text
        or coalesce(u.full_name, '') ilike ${searchPattern}::text
      )
    order by
      c.approved asc,
      case when c.approved then c.approved_at else c.submitted_at end desc
    limit ${limit} offset ${offset}
  `;
  const rows = (rowsRaw as ListRow[]).map(rowToBase);

  const countsRaw = await sql`
    select
      count(*) filter (
        where (${input.status === "all"}::boolean
          or (${input.status === "pending"}::boolean and c.approved = false)
          or (${input.status === "approved"}::boolean and c.approved = true))
        and (
          ${searchPattern}::text is null
          or u.email ilike ${searchPattern}::text
          or coalesce(u.full_name, '') ilike ${searchPattern}::text
        )
      )::int as total,
      count(*) filter (where c.approved = false)::int as pending_total,
      count(*) filter (where c.approved = true)::int as approved_total
    from cases c
    join users u on u.id = c.user_id
  `;
  const counts = (countsRaw as {
    total: number;
    pending_total: number;
    approved_total: number;
  }[])[0];

  return {
    rows,
    total: counts?.total ?? 0,
    pendingTotal: counts?.pending_total ?? 0,
    approvedTotal: counts?.approved_total ?? 0,
  };
}

export async function getCaseDetail(userId: string): Promise<AdminCaseDetail | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select
      c.user_id,
      u.email,
      u.full_name,
      u.tg_username,
      u.locale,
      c.approved,
      c.submitted_at,
      c.approved_at,
      ru.email as reviewer_email,
      left(coalesce(c.body_uk, ''), 240) as body_preview,
      (c.video_url is not null and length(c.video_url) > 0) as has_video,
      c.body_uk,
      c.video_url,
      c.review_notes_uk,
      c.reviewer_user_id
    from cases c
    join users u on u.id = c.user_id
    left join users ru on ru.id = c.reviewer_user_id
    where c.user_id = ${userId}::uuid
    limit 1
  `) as DetailRow[];
  const r = rows[0];
  if (!r) return null;
  return {
    ...rowToBase(r),
    bodyUk: r.body_uk,
    videoUrl: r.video_url,
    reviewNotesUk: r.review_notes_uk,
    reviewerUserId: r.reviewer_user_id,
  };
}

export type ReviewDecision = "approve" | "reject";

export interface ApplyDecisionInput {
  userId: string;
  decision: ReviewDecision;
  reviewerUserId: string;
  notes: string | null;
}

export interface ApplyDecisionResult {
  approved: boolean;
  approvedAt: Date | null;
  reviewNotesUk: string | null;
}

/**
 * Flips a case row according to the admin's decision and stamps the
 * reviewer + notes. Always writes `review_notes_uk` (even on approve)
 * so we don't lose context if the admin later switches the decision.
 *
 * The mutation is intentionally single-statement — concurrent reviewers
 * see last-write-wins, and the audit log (see route handler) preserves
 * the full sequence.
 */
export async function applyCaseDecision(
  input: ApplyDecisionInput,
): Promise<ApplyDecisionResult | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const approve = input.decision === "approve";
  const rows = (await sql`
    update cases
    set
      approved = ${approve}::boolean,
      approved_at = case when ${approve}::boolean then now() else null end,
      reviewer_user_id = ${input.reviewerUserId}::uuid,
      review_notes_uk = ${input.notes}
    where user_id = ${input.userId}::uuid
    returning approved, approved_at, review_notes_uk
  `) as {
    approved: boolean;
    approved_at: string | Date | null;
    review_notes_uk: string | null;
  }[];
  const r = rows[0];
  if (!r) return null;
  return {
    approved: r.approved,
    approvedAt: r.approved_at ? toDate(r.approved_at) : null,
    reviewNotesUk: r.review_notes_uk,
  };
}
