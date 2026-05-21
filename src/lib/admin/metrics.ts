import { unstable_cache } from "next/cache";
import { getDb, isDbConfigured } from "@/lib/db";

/**
 * KPI snapshot rendered on the admin overview (PR A1).
 *
 * The shape stays small + numeric so it's cheap to cache and trivial to
 * extend in later PRs (A4 will reuse most of these counters for the
 * funnel page). Each field that depends on infra we haven't built yet
 * (e.g. webhook error log lands in PR E2) is typed nullable so the
 * UI can render "—" instead of a misleading zero.
 */
export interface AdminOverviewMetrics {
  /** Distinct emails that submitted a lead in the last 24h. */
  newLeads24h: number;
  /** Conversion rate (paid ÷ leads) over the last 30d, 0..1, null if 0 leads. */
  conversion30d: number | null;
  /** Total successful payments today in UAH cents. */
  paymentsTodayUahCents: number;
  /** Distinct users currently enrolled in level-0 (`enrollments.course_slug = 'level-0'`). */
  activeLevel0: number;
  /** Distinct users currently enrolled in level-1. */
  activeLevel1: number;
  /** Distinct users with access to level-2 product. */
  activeLevel2: number;
  /** Cases awaiting review (`cases.approved = false`). */
  casesPending: number;
  /**
   * Webhook errors in the last 7d. Infra lands with PR E2 (Sentry +
   * `/api/admin/metrics`); for now we surface `null` so the tile reads
   * "—" rather than fabricating a zero.
   */
  webhookErrors7d: number | null;
  /** ISO timestamp of when the snapshot was generated. */
  generatedAt: string;
}

interface ConvRow {
  paid: number;
  leads: number;
}

async function computeMetrics(): Promise<AdminOverviewMetrics> {
  const generatedAt = new Date().toISOString();

  if (!isDbConfigured()) {
    return {
      newLeads24h: 0,
      conversion30d: null,
      paymentsTodayUahCents: 0,
      activeLevel0: 0,
      activeLevel1: 0,
      activeLevel2: 0,
      casesPending: 0,
      webhookErrors7d: null,
      generatedAt,
    };
  }

  const sql = getDb()!;

  const [
    leadsRowsRaw,
    convRowsRaw,
    payRowsRaw,
    l0RowsRaw,
    l1RowsRaw,
    l2RowsRaw,
    casesRowsRaw,
  ] = await Promise.all([
    sql`
      select count(distinct lower(email))::int as n
      from leads
      where created_at >= now() - interval '24 hours'
    `,
    sql`
      select
        (select count(*)::int from payments
          where status = 'success'
            and currency = 'UAH'
            and created_at >= now() - interval '30 days') as paid,
        (select count(distinct lower(email))::int from leads
          where created_at >= now() - interval '30 days') as leads
    `,
    sql`
      select coalesce(sum(amount_cents), 0)::bigint as cents
      from payments
      where status = 'success'
        and currency = 'UAH'
        and created_at >= date_trunc('day', now())
    `,
    sql`
      select count(distinct user_id)::int as n
      from enrollments
      where course_slug = 'level-0'
    `,
    sql`
      select count(distinct user_id)::int as n
      from enrollments
      where course_slug = 'level-1'
    `,
    sql`
      select count(distinct user_id)::int as n
      from access
      where product_slug = 'level-2'
        and (expires_at is null or expires_at > now())
    `,
    sql`
      select count(*)::int as n
      from cases
      where approved = false
    `,
  ]);

  const leadsRows = leadsRowsRaw as { n: number }[];
  const convRows = convRowsRaw as ConvRow[];
  const payRows = payRowsRaw as { cents: string | number }[];
  const l0Rows = l0RowsRaw as { n: number }[];
  const l1Rows = l1RowsRaw as { n: number }[];
  const l2Rows = l2RowsRaw as { n: number }[];
  const casesRows = casesRowsRaw as { n: number }[];

  const paid = Number(convRows[0]?.paid ?? 0);
  const leads = Number(convRows[0]?.leads ?? 0);
  const conversion30d = leads > 0 ? paid / leads : null;

  const rawCents = payRows[0]?.cents ?? 0;
  const paymentsTodayUahCents =
    typeof rawCents === "string" ? Number.parseInt(rawCents, 10) : Number(rawCents);

  return {
    newLeads24h: leadsRows[0]?.n ?? 0,
    conversion30d,
    paymentsTodayUahCents: Number.isFinite(paymentsTodayUahCents) ? paymentsTodayUahCents : 0,
    activeLevel0: l0Rows[0]?.n ?? 0,
    activeLevel1: l1Rows[0]?.n ?? 0,
    activeLevel2: l2Rows[0]?.n ?? 0,
    casesPending: casesRows[0]?.n ?? 0,
    webhookErrors7d: null,
    generatedAt,
  };
}

/**
 * 60s-cached metrics snapshot. The overview page renders this directly;
 * callers that mutate underlying data (e.g. PR A2 approving a case) can
 * tag the cache key to invalidate. For PR A1 the simple TTL is enough.
 */
export const getOverviewMetrics = unstable_cache(
  computeMetrics,
  ["admin", "overview", "v1"],
  { revalidate: 60, tags: ["admin:overview"] },
);
