import { getDb, isDbConfigured } from "@/lib/db";

export interface AdminUserListRow {
  id: string;
  email: string;
  fullName: string | null;
  locale: "uk" | "ru";
  isAdmin: boolean;
  bannedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  utmSource: string | null;
  accessSlugs: string[];
  paymentTotalCents: number;
}

export interface AdminUserDetail extends AdminUserListRow {
  tgUsername: string | null;
  tgId: number | null;
  enrollments: { courseSlug: string; startedAt: Date }[];
  access: {
    slug: string;
    grantedAt: Date;
    expiresAt: Date | null;
    grantedByEmail: string | null;
  }[];
  payments: {
    id: string;
    provider: "wfp" | "mono";
    productSlug: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: Date;
  }[];
  leads: {
    id: string;
    productSlug: string;
    utmSource: string | null;
    referer: string | null;
    createdAt: Date;
  }[];
  caseStudy: {
    bodyUk: string;
    videoUrl: string | null;
    approved: boolean;
    submittedAt: Date;
    approvedAt: Date | null;
  } | null;
}

interface ListRow {
  id: string;
  email: string;
  full_name: string | null;
  locale: string;
  is_admin: boolean;
  banned_at: string | Date | null;
  last_seen_at: string | Date | null;
  created_at: string | Date;
  utm_source: string | null;
  access_slugs: string[] | null;
  payment_total_cents: number | string | null;
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function rowToList(r: ListRow): AdminUserListRow {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    locale: r.locale === "ru" ? "ru" : "uk",
    isAdmin: r.is_admin,
    bannedAt: r.banned_at ? toDate(r.banned_at) : null,
    lastSeenAt: r.last_seen_at ? toDate(r.last_seen_at) : null,
    createdAt: toDate(r.created_at),
    utmSource: r.utm_source,
    accessSlugs: (r.access_slugs ?? []).filter(Boolean),
    paymentTotalCents: Number(r.payment_total_cents ?? 0),
  };
}

export type LocaleFilter = "any" | "uk" | "ru";
export type AccessFilter = "any" | "level-0" | "level-1" | "level-2" | "none";

export interface ListUsersInput {
  search: string | null;
  locale: LocaleFilter;
  access: AccessFilter;
  page: number;
  pageSize: number;
}

export interface ListUsersResult {
  rows: AdminUserListRow[];
  total: number;
}

/**
 * Server-side paginated user list for the admin surface.
 *
 * Sort: most recently active first (last_seen_at desc, then created_at desc).
 * The `access` filter takes one slug or "none" — "none" returns users with
 * zero rows in `access`. "any" disables the filter.
 *
 * We compute the access array via `array_agg(distinct product_slug)`; nulls
 * are stripped in JS to keep callers from threading the SQL null through.
 */
export async function listUsers(input: ListUsersInput): Promise<ListUsersResult> {
  if (!isDbConfigured()) return { rows: [], total: 0 };
  const sql = getDb()!;

  const limit = Math.max(1, Math.min(input.pageSize, 200));
  const offset = Math.max(0, (input.page - 1) * limit);
  const searchPattern = input.search?.trim() ? `%${input.search.trim()}%` : null;

  const localeFilter = input.locale === "any" ? null : input.locale;
  const accessSlugFilter =
    input.access === "any" || input.access === "none" ? null : input.access;
  const accessNoneFilter = input.access === "none";

  const rowsRaw = await sql`
    select
      u.id,
      u.email,
      u.full_name,
      u.locale,
      u.is_admin,
      u.banned_at,
      u.last_seen_at,
      u.created_at,
      u.utm_source,
      coalesce(
        (select array_agg(distinct product_slug)
         from access a
         where a.user_id = u.id
           and (a.expires_at is null or a.expires_at > now())),
        '{}'
      ) as access_slugs,
      coalesce(
        (select sum(amount_cents)::bigint
         from payments p
         where p.user_id = u.id
           and p.status = 'success'),
        0
      ) as payment_total_cents
    from users u
    where
      (${searchPattern}::text is null
        or u.email ilike ${searchPattern}::text
        or coalesce(u.full_name, '') ilike ${searchPattern}::text
        or coalesce(u.tg_username, '') ilike ${searchPattern}::text)
      and (${localeFilter}::text is null or u.locale = ${localeFilter}::text)
      and (
        ${accessSlugFilter}::text is null
        or exists (
          select 1 from access a
          where a.user_id = u.id
            and a.product_slug = ${accessSlugFilter}::text
            and (a.expires_at is null or a.expires_at > now())
        )
      )
      and (
        ${!accessNoneFilter}::boolean
        or not exists (
          select 1 from access a
          where a.user_id = u.id
            and (a.expires_at is null or a.expires_at > now())
        )
      )
    order by
      coalesce(u.last_seen_at, u.created_at) desc,
      u.created_at desc
    limit ${limit} offset ${offset}
  `;
  const rows = (rowsRaw as ListRow[]).map(rowToList);

  const countRaw = await sql`
    select count(*)::int as n
    from users u
    where
      (${searchPattern}::text is null
        or u.email ilike ${searchPattern}::text
        or coalesce(u.full_name, '') ilike ${searchPattern}::text
        or coalesce(u.tg_username, '') ilike ${searchPattern}::text)
      and (${localeFilter}::text is null or u.locale = ${localeFilter}::text)
      and (
        ${accessSlugFilter}::text is null
        or exists (
          select 1 from access a
          where a.user_id = u.id
            and a.product_slug = ${accessSlugFilter}::text
            and (a.expires_at is null or a.expires_at > now())
        )
      )
      and (
        ${!accessNoneFilter}::boolean
        or not exists (
          select 1 from access a
          where a.user_id = u.id
            and (a.expires_at is null or a.expires_at > now())
        )
      )
  `;
  const total = (countRaw as { n: number }[])[0]?.n ?? 0;

  return { rows, total };
}

interface DetailListRow extends ListRow {
  tg_username: string | null;
  tg_id: string | number | null;
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;

  const baseRowsRaw = await sql`
    select
      u.id,
      u.email,
      u.full_name,
      u.locale,
      u.is_admin,
      u.banned_at,
      u.last_seen_at,
      u.created_at,
      u.utm_source,
      u.tg_username,
      u.tg_id,
      coalesce(
        (select array_agg(distinct product_slug)
         from access a
         where a.user_id = u.id
           and (a.expires_at is null or a.expires_at > now())),
        '{}'
      ) as access_slugs,
      coalesce(
        (select sum(amount_cents)::bigint
         from payments p
         where p.user_id = u.id
           and p.status = 'success'),
        0
      ) as payment_total_cents
    from users u
    where u.id = ${userId}::uuid
    limit 1
  `;
  const baseRow = (baseRowsRaw as DetailListRow[])[0];
  if (!baseRow) return null;

  const enrollmentsRaw = await sql`
    select course_slug, started_at
    from enrollments
    where user_id = ${userId}::uuid
    order by started_at asc
  `;
  const accessRaw = await sql`
    select a.product_slug, a.granted_at, a.expires_at, g.email as granted_by_email
    from access a
    left join users g on g.id = a.granted_by_user_id
    where a.user_id = ${userId}::uuid
    order by a.granted_at desc
  `;
  const paymentsRaw = await sql`
    select id, provider, product_slug, amount_cents, currency, status, created_at
    from payments
    where user_id = ${userId}::uuid
    order by created_at desc
    limit 100
  `;
  const leadsRaw = await sql`
    select id, product_slug, utm_source, referer, created_at
    from leads
    where user_id = ${userId}::uuid
    order by created_at desc
    limit 100
  `;
  const caseStudyRaw = await sql`
    select body_uk, video_url, approved, submitted_at, approved_at
    from cases
    where user_id = ${userId}::uuid
    limit 1
  `;

  const base = rowToList(baseRow);

  const caseRow = (caseStudyRaw as {
    body_uk: string;
    video_url: string | null;
    approved: boolean;
    submitted_at: string | Date;
    approved_at: string | Date | null;
  }[])[0];

  return {
    ...base,
    tgUsername: baseRow.tg_username,
    tgId: baseRow.tg_id !== null ? Number(baseRow.tg_id) : null,
    enrollments: (enrollmentsRaw as { course_slug: string; started_at: string | Date }[]).map(
      (r) => ({ courseSlug: r.course_slug, startedAt: toDate(r.started_at) }),
    ),
    access: (
      accessRaw as {
        product_slug: string;
        granted_at: string | Date;
        expires_at: string | Date | null;
        granted_by_email: string | null;
      }[]
    ).map((r) => ({
      slug: r.product_slug,
      grantedAt: toDate(r.granted_at),
      expiresAt: r.expires_at ? toDate(r.expires_at) : null,
      grantedByEmail: r.granted_by_email,
    })),
    payments: (
      paymentsRaw as {
        id: string;
        provider: "wfp" | "mono";
        product_slug: string;
        amount_cents: number | string;
        currency: string;
        status: string;
        created_at: string | Date;
      }[]
    ).map((r) => ({
      id: r.id,
      provider: r.provider,
      productSlug: r.product_slug,
      amountCents: Number(r.amount_cents),
      currency: r.currency,
      status: r.status,
      createdAt: toDate(r.created_at),
    })),
    leads: (
      leadsRaw as {
        id: string;
        product_slug: string;
        utm_source: string | null;
        referer: string | null;
        created_at: string | Date;
      }[]
    ).map((r) => ({
      id: r.id,
      productSlug: r.product_slug,
      utmSource: r.utm_source,
      referer: r.referer,
      createdAt: toDate(r.created_at),
    })),
    caseStudy: caseRow
      ? {
          bodyUk: caseRow.body_uk,
          videoUrl: caseRow.video_url,
          approved: caseRow.approved,
          submittedAt: toDate(caseRow.submitted_at),
          approvedAt: caseRow.approved_at ? toDate(caseRow.approved_at) : null,
        }
      : null,
  };
}

export type AccessProductSlug = "level-0" | "level-1" | "level-2";

export interface GrantAccessInput {
  userId: string;
  productSlug: AccessProductSlug;
  grantedByUserId: string;
}

/**
 * Admin-initiated grant. Upserts the `access` row and stamps the granting
 * admin. Caller is responsible for writing the audit_log entry.
 */
export async function adminGrantAccess(input: GrantAccessInput): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  await sql`
    insert into access (user_id, product_slug, granted_by_user_id)
    values (
      ${input.userId}::uuid,
      ${input.productSlug},
      ${input.grantedByUserId}::uuid
    )
    on conflict (user_id, product_slug)
    do update set
      granted_at = now(),
      granted_by_user_id = excluded.granted_by_user_id,
      expires_at = null
  `;
  return true;
}

export interface RevokeAccessInput {
  userId: string;
  productSlug: AccessProductSlug;
}

export async function adminRevokeAccess(input: RevokeAccessInput): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    delete from access
    where user_id = ${input.userId}::uuid
      and product_slug = ${input.productSlug}
    returning product_slug
  `) as { product_slug: string }[];
  return rows.length > 0;
}

export type BanAction = "ban" | "unban";

export async function setBanState(userId: string, action: BanAction): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  if (action === "ban") {
    const rows = (await sql`
      update users
      set banned_at = coalesce(banned_at, now())
      where id = ${userId}::uuid
      returning id
    `) as { id: string }[];
    return rows.length > 0;
  }
  const rows = (await sql`
    update users
    set banned_at = null
    where id = ${userId}::uuid
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function isUserBanned(userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    select 1 from users where id = ${userId}::uuid and banned_at is not null limit 1
  `) as unknown[];
  return rows.length > 0;
}
