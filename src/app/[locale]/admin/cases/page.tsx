import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/data-table";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { listCases, type AdminCaseRow, type CaseReviewStatus } from "@/lib/admin/cases";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.cases" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

function parseStatus(raw: string | string[] | undefined): CaseReviewStatus {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "approved" || v === "all" ? v : "pending";
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

function formatDate(d: Date, locale: "uk" | "ru"): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminCasesPage({
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
  const status = parseStatus(sp.status);
  const page = parsePage(sp.page);
  const search = parseSearch(sp.q);

  const t = await getTranslations({ locale, namespace: "admin.cases" });

  const { rows, total, pendingTotal, approvedTotal } = await listCases({
    status,
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: AdminDataTableColumn<AdminCaseRow>[] = [
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
      key: "submittedAt",
      header: t("col.submittedAt"),
      cell: (row) => (
        <span className="text-foreground/70">
          {formatDate(row.submittedAt, locale)}
        </span>
      ),
    },
    {
      key: "preview",
      header: t("col.preview"),
      cell: (row) => (
        <span className="line-clamp-2 text-foreground/65" title={row.bodyPreview}>
          {row.bodyPreview}
        </span>
      ),
      className: "max-w-md",
    },
    {
      key: "video",
      header: t("col.video"),
      align: "center",
      cell: (row) =>
        row.hasVideo ? (
          <span className="inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/75">
            {t("video.yes")}
          </span>
        ) : (
          <span className="text-foreground/40">—</span>
        ),
    },
    {
      key: "status",
      header: t("col.status"),
      align: "center",
      cell: (row) => (
        <StatusBadge
          approved={row.approved}
          labels={{
            pending: t("status.pending"),
            approved: t("status.approved"),
          }}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Link
          href={`/admin/cases/${row.userId}`}
          className="rounded-full border border-foreground/20 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
        >
          {t("actions.review")} →
        </Link>
      ),
    },
  ];

  const filterTabs: { key: CaseReviewStatus; label: string; count?: number }[] = [
    { key: "pending", label: t("filter.pending"), count: pendingTotal },
    { key: "approved", label: t("filter.approved"), count: approvedTotal },
    { key: "all", label: t("filter.all") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <form className="flex flex-wrap items-center gap-3" method="get">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          type="search"
          defaultValue={search ?? ""}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full max-w-xs rounded-full border border-foreground/15 bg-background px-4 text-sm text-foreground placeholder:text-foreground/40 focus:border-foreground/40 focus:outline-none sm:w-auto"
        />
        <div className="flex items-center gap-2 rounded-full border border-foreground/10 bg-muted/30 p-1">
          {filterTabs.map((tab) => {
            const isActive = tab.key === status;
            const params = new URLSearchParams();
            params.set("status", tab.key);
            if (search) params.set("q", search);
            return (
              <Link
                key={tab.key}
                href={`/admin/cases?${params.toString()}`}
                className={
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors " +
                  (isActive
                    ? "bg-foreground text-background"
                    : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground")
                }
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" ? (
                  <span
                    className={
                      "rounded-full px-1.5 text-[10px] " +
                      (isActive
                        ? "bg-background/20 text-background"
                        : "bg-foreground/10 text-foreground/70")
                    }
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </form>

      <AdminDataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.userId}
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
          status={status}
          search={search}
          prevLabel={t("pagination.prev")}
          nextLabel={t("pagination.next")}
          pageLabel={t("pagination.label", { page, total: totalPages })}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({
  approved,
  labels,
}: {
  approved: boolean;
  labels: { pending: string; approved: string };
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider " +
        (approved
          ? "bg-emerald-500/10 text-emerald-300"
          : "bg-amber-500/10 text-amber-300")
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (approved ? "bg-emerald-400" : "bg-amber-400")
        }
      />
      {approved ? labels.approved : labels.pending}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  status,
  search,
  prevLabel,
  nextLabel,
  pageLabel,
}: {
  page: number;
  totalPages: number;
  status: CaseReviewStatus;
  search: string | null;
  prevLabel: string;
  nextLabel: string;
  pageLabel: string;
}) {
  function buildUrl(p: number) {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("page", String(p));
    if (search) params.set("q", search);
    return `/admin/cases?${params.toString()}`;
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
