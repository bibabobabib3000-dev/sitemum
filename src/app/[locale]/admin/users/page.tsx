import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/data-table";
import { AdminEmptyState } from "@/components/admin/empty-state";
import {
  listUsers,
  type AdminUserListRow,
  type AccessFilter,
  type LocaleFilter,
} from "@/lib/admin/users";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

function parseAccess(raw: string | string[] | undefined): AccessFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "level-0" || v === "level-1" || v === "level-2" || v === "none") return v;
  return "any";
}

function parseLocale(raw: string | string[] | undefined): LocaleFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "uk" || v === "ru") return v;
  return "any";
}

function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseSearch(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v?.trim() ? v.trim() : null;
}

function formatDate(d: Date | null, locale: "uk" | "ru"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}

function formatMoney(cents: number, locale: "uk" | "ru"): string {
  if (cents <= 0) return "—";
  return new Intl.NumberFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100)) + " ₴";
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";
  const sp = await searchParams;
  const access = parseAccess(sp.access);
  const localeFilter = parseLocale(sp.locale);
  const page = parsePage(sp.page);
  const search = parseSearch(sp.q);

  const t = await getTranslations({ locale, namespace: "admin.users" });

  const { rows, total } = await listUsers({
    search,
    locale: localeFilter,
    access,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: AdminDataTableColumn<AdminUserListRow>[] = [
    {
      key: "user",
      header: t("col.user"),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {row.fullName ?? t("noName")}
          </span>
          <span className="text-xs text-foreground/55">{row.email}</span>
        </div>
      ),
    },
    {
      key: "locale",
      header: t("col.locale"),
      align: "center",
      cell: (row) => (
        <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/70">
          {row.locale}
        </span>
      ),
    },
    {
      key: "access",
      header: t("col.access"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.accessSlugs.length === 0 ? (
            <span className="text-foreground/40">—</span>
          ) : (
            row.accessSlugs.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/75"
              >
                {slug.replace("level-", "L")}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      key: "paid",
      header: t("col.paid"),
      align: "right",
      cell: (row) => (
        <span className="text-foreground/70">
          {formatMoney(row.paymentTotalCents, locale)}
        </span>
      ),
    },
    {
      key: "utm",
      header: t("col.utm"),
      cell: (row) => (
        <span className="text-xs text-foreground/55">{row.utmSource ?? "—"}</span>
      ),
    },
    {
      key: "lastSeenAt",
      header: t("col.lastSeen"),
      cell: (row) => (
        <span className="text-foreground/70">
          {formatDate(row.lastSeenAt, locale)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("col.status"),
      align: "center",
      cell: (row) => {
        if (row.bannedAt) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("status.banned")}
            </span>
          );
        }
        if (row.isAdmin) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">
              {t("status.admin")}
            </span>
          );
        }
        return <span className="text-foreground/40">—</span>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Link
          href={`/admin/users/${row.id}`}
          className="rounded-full border border-foreground/20 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
        >
          {t("actions.open")} →
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <form className="flex flex-wrap items-center gap-3" method="get">
        <input
          name="q"
          type="search"
          defaultValue={search ?? ""}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full max-w-xs rounded-full border border-foreground/15 bg-background px-4 text-sm text-foreground placeholder:text-foreground/40 focus:border-foreground/40 focus:outline-none sm:w-auto"
        />
        <Select
          name="access"
          value={access}
          ariaLabel={t("filters.access")}
          options={[
            { value: "any", label: t("filters.accessAny") },
            { value: "level-0", label: "L0" },
            { value: "level-1", label: "L1" },
            { value: "level-2", label: "L2" },
            { value: "none", label: t("filters.accessNone") },
          ]}
        />
        <Select
          name="locale"
          value={localeFilter}
          ariaLabel={t("filters.locale")}
          options={[
            { value: "any", label: t("filters.localeAny") },
            { value: "uk", label: "uk" },
            { value: "ru", label: "ru" },
          ]}
        />
        <button
          type="submit"
          className="h-10 rounded-full border border-foreground/15 px-4 text-xs uppercase tracking-wider text-foreground/75 transition-colors hover:border-foreground hover:text-foreground"
        >
          {t("filters.apply")}
        </button>
      </form>

      <AdminDataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        empty={
          <AdminEmptyState
            title={t("empty.title")}
            description={t("empty.description")}
          />
        }
      />

      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          search={search}
          access={access}
          locale={localeFilter}
          prevLabel={t("pagination.prev")}
          nextLabel={t("pagination.next")}
          pageLabel={t("pagination.label", { page, total: totalPages })}
        />
      ) : null}
    </div>
  );
}

function Select({
  name,
  value,
  ariaLabel,
  options,
}: {
  name: string;
  value: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={ariaLabel}
      className="h-10 rounded-full border border-foreground/15 bg-background px-3 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Pagination({
  page,
  totalPages,
  search,
  access,
  locale,
  prevLabel,
  nextLabel,
  pageLabel,
}: {
  page: number;
  totalPages: number;
  search: string | null;
  access: AccessFilter;
  locale: LocaleFilter;
  prevLabel: string;
  nextLabel: string;
  pageLabel: string;
}) {
  function buildUrl(p: number) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (search) params.set("q", search);
    if (access !== "any") params.set("access", access);
    if (locale !== "any") params.set("locale", locale);
    return `/admin/users?${params.toString()}`;
  }
  const prev = page > 1 ? buildUrl(page - 1) : null;
  const next = page < totalPages ? buildUrl(page + 1) : null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-4 text-sm text-foreground/65">
      {prev ? (
        <Link
          href={prev}
          className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/75 transition-colors hover:border-foreground hover:text-foreground"
        >
          ← {prevLabel}
        </Link>
      ) : (
        <span className="px-3 py-1 text-xs text-foreground/30">← {prevLabel}</span>
      )}
      <span className="text-xs">{pageLabel}</span>
      {next ? (
        <Link
          href={next}
          className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/75 transition-colors hover:border-foreground hover:text-foreground"
        >
          {nextLabel} →
        </Link>
      ) : (
        <span className="px-3 py-1 text-xs text-foreground/30">{nextLabel} →</span>
      )}
    </nav>
  );
}
