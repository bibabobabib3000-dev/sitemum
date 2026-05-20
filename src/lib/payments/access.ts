import { getDb, isDbConfigured } from "@/lib/db";
import type { ProductSlug } from "./catalog";

export interface InsertPaymentInput {
  userId: string | null;
  provider: "wfp" | "mono";
  providerRef: string;
  productSlug: ProductSlug;
  amountCents: number;
  currency: string;
  status: string;
  raw: unknown;
}

/**
 * Idempotent payment write. Returns true if this is the first time we
 * persisted this `(provider, provider_ref)` pair.
 */
export async function recordPayment(
  input: InsertPaymentInput
): Promise<{ persisted: boolean }> {
  if (!isDbConfigured()) return { persisted: false };
  const sql = getDb()!;
  const rows = (await sql`
    insert into payments (
      user_id, provider, provider_ref, product_slug,
      amount_cents, currency, status, raw
    ) values (
      ${input.userId},
      ${input.provider},
      ${input.providerRef},
      ${input.productSlug},
      ${input.amountCents},
      ${input.currency},
      ${input.status},
      ${JSON.stringify(input.raw)}::jsonb
    )
    on conflict (provider, provider_ref) do nothing
    returning id
  `) as { id: string }[];
  return { persisted: rows.length > 0 };
}

/**
 * Grant access to a product. Upsert keyed on (user_id, product_slug).
 */
export async function grantAccess(
  userId: string,
  productSlug: ProductSlug
): Promise<void> {
  if (!isDbConfigured()) return;
  const sql = getDb()!;
  await sql`
    insert into access (user_id, product_slug)
    values (${userId}::uuid, ${productSlug})
    on conflict (user_id, product_slug)
    do update set granted_at = excluded.granted_at
  `;
}

export async function hasAccess(
  userId: string,
  productSlug: ProductSlug
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    select 1 from access
    where user_id = ${userId}::uuid
      and product_slug = ${productSlug}
      and (expires_at is null or expires_at > now())
    limit 1
  `) as unknown[];
  return rows.length > 0;
}

/**
 * Lookup a user's email + tg_id by id so the webhook can DM them after
 * payment confirmation.
 */
export async function getUserContact(
  userId: string
): Promise<{ email: string; tgId: number | null; locale: "uk" | "ru" } | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select email, tg_id, locale from users where id = ${userId}::uuid limit 1
  `) as { email: string; tg_id: string | number | null; locale: string }[];
  if (!rows[0]) return null;
  return {
    email: rows[0].email,
    tgId: rows[0].tg_id !== null ? Number(rows[0].tg_id) : null,
    locale: rows[0].locale === "ru" ? "ru" : "uk",
  };
}
