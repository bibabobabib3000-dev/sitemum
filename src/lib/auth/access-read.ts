import { getDb, isDbConfigured } from "@/lib/db";

export interface AccessRow {
  productSlug: string;
  grantedAt: string;
  expiresAt: string | null;
}

/**
 * Read all access rows for a user. Returns [] when DB is not configured.
 */
export async function listAccess(userId: string): Promise<AccessRow[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select product_slug, granted_at, expires_at
    from access
    where user_id = ${userId}::uuid
    order by granted_at desc
  `) as {
    product_slug: string;
    granted_at: string | Date;
    expires_at: string | Date | null;
  }[];
  return rows.map((r) => ({
    productSlug: r.product_slug,
    grantedAt: r.granted_at instanceof Date ? r.granted_at.toISOString() : r.granted_at,
    expiresAt:
      r.expires_at === null
        ? null
        : r.expires_at instanceof Date
        ? r.expires_at.toISOString()
        : r.expires_at,
  }));
}

export interface RecentPaymentRow {
  provider: "wfp" | "mono";
  productSlug: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

export async function listRecentPayments(
  userId: string,
  limit = 10
): Promise<RecentPaymentRow[]> {
  if (!isDbConfigured()) return [];
  const sql = getDb()!;
  const rows = (await sql`
    select provider, product_slug, amount_cents, currency, status, created_at
    from payments
    where user_id = ${userId}::uuid
    order by created_at desc
    limit ${limit}
  `) as {
    provider: "wfp" | "mono";
    product_slug: string;
    amount_cents: number;
    currency: string;
    status: string;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    provider: r.provider,
    productSlug: r.product_slug,
    amountCents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));
}
