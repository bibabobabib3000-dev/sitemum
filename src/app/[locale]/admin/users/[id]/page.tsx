import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UserAdminActions } from "@/components/admin/user-admin-actions";
import { getAdminContext } from "@/lib/auth/admin";
import { getUserDetail, type AdminUserDetail } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return {
    title: t("detail.metaTitle"),
    robots: { index: false, follow: false },
  };
}

function formatDate(d: Date | null, locale: "uk" | "ru"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatMoney(cents: number, currency: string, locale: "uk" | "ru"): string {
  const value = new Intl.NumberFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(cents / 100);
  return `${value} ${currency}`;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: localeRaw, id } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const ctx = await getAdminContext();
  const viewerId = ctx.kind === "ok" ? ctx.ctx.userId : null;
  const isSelf = viewerId === detail.id;

  const t = await getTranslations({ locale, namespace: "admin.users" });

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow={t("detail.eyebrow")}
        title={detail.fullName ?? detail.email}
        description={detail.email}
        actions={
          <Link
            href="/admin/users"
            className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
          >
            ← {t("detail.backToList")}
          </Link>
        }
      />

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <IdentityCard detail={detail} locale={locale} t={t} />
          <AccessCard detail={detail} locale={locale} t={t} />
          <PaymentsCard detail={detail} locale={locale} t={t} formatMoney={formatMoney} />
          <LeadsCard detail={detail} locale={locale} t={t} />
          {detail.caseStudy ? (
            <CaseCard detail={detail} locale={locale} t={t} />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <UserAdminActions
            userId={detail.id}
            isAdmin={detail.isAdmin}
            isSelf={isSelf}
            banned={detail.bannedAt !== null}
            accessSlugs={detail.accessSlugs}
            copy={{
              heading: t("actions.heading"),
              accessHeading: t("actions.accessHeading"),
              grant: t("actions.grant"),
              revoke: t("actions.revoke"),
              banHeading: t("actions.banHeading"),
              ban: t("actions.ban"),
              unban: t("actions.unban"),
              impersonateHeading: t("actions.impersonateHeading"),
              impersonate: t("actions.impersonate"),
              impersonateDisabledSelf: t("actions.impersonateDisabledSelf"),
              impersonateDisabledAdmin: t("actions.impersonateDisabledAdmin"),
              busy: t("actions.busy"),
              successGrant: t("actions.successGrant"),
              successRevoke: t("actions.successRevoke"),
              successBan: t("actions.successBan"),
              successUnban: t("actions.successUnban"),
              error: t("actions.error"),
            }}
          />
        </aside>
      </section>
    </div>
  );
}

function IdentityCard({
  detail,
  locale,
  t,
}: {
  detail: AdminUserDetail;
  locale: "uk" | "ru";
  t: (k: string) => string;
}) {
  return (
    <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
        {t("detail.identityHeading")}
      </h2>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <MetaRow label={t("detail.meta.email")} value={detail.email} />
        <MetaRow label={t("detail.meta.fullName")} value={detail.fullName ?? "—"} />
        <MetaRow
          label={t("detail.meta.tg")}
          value={detail.tgUsername ? `@${detail.tgUsername}` : "—"}
        />
        <MetaRow label={t("detail.meta.locale")} value={detail.locale.toUpperCase()} />
        <MetaRow label={t("detail.meta.utm")} value={detail.utmSource ?? "—"} />
        <MetaRow
          label={t("detail.meta.createdAt")}
          value={formatDate(detail.createdAt, locale)}
        />
        <MetaRow
          label={t("detail.meta.lastSeenAt")}
          value={formatDate(detail.lastSeenAt, locale)}
        />
        <MetaRow
          label={t("detail.meta.role")}
          value={detail.isAdmin ? t("status.admin") : t("status.user")}
          emphasis={detail.isAdmin ? "positive" : "neutral"}
        />
        <MetaRow
          label={t("detail.meta.banned")}
          value={detail.bannedAt ? formatDate(detail.bannedAt, locale) : "—"}
          emphasis={detail.bannedAt ? "alert" : "neutral"}
        />
      </dl>
    </div>
  );
}

function AccessCard({
  detail,
  locale,
  t,
}: {
  detail: AdminUserDetail;
  locale: "uk" | "ru";
  t: (k: string) => string;
}) {
  return (
    <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
        {t("detail.accessHeading")}
      </h2>
      {detail.access.length === 0 ? (
        <p className="text-sm text-foreground/55">{t("detail.accessEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {detail.access.map((row) => (
            <li
              key={row.slug}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-foreground/10 bg-background/40 px-4 py-2"
            >
              <span className="font-medium text-foreground">{row.slug}</span>
              <span className="text-xs text-foreground/55">
                {t("detail.grantedAt")} {formatDate(row.grantedAt, locale)}
                {row.grantedByEmail ? ` · ${row.grantedByEmail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentsCard({
  detail,
  locale,
  t,
  formatMoney,
}: {
  detail: AdminUserDetail;
  locale: "uk" | "ru";
  t: (k: string) => string;
  formatMoney: (c: number, cur: string, l: "uk" | "ru") => string;
}) {
  return (
    <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
        {t("detail.paymentsHeading")}
      </h2>
      {detail.payments.length === 0 ? (
        <p className="text-sm text-foreground/55">{t("detail.paymentsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {detail.payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/5 pb-2 last:border-b-0 last:pb-0"
            >
              <span>
                <span className="font-medium text-foreground">{p.productSlug}</span>
                <span className="ml-2 text-xs text-foreground/55">
                  {p.provider} · {p.status}
                </span>
              </span>
              <span className="text-foreground/75">
                {formatMoney(p.amountCents, p.currency, locale)} ·{" "}
                <span className="text-xs text-foreground/55">
                  {formatDate(p.createdAt, locale)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadsCard({
  detail,
  locale,
  t,
}: {
  detail: AdminUserDetail;
  locale: "uk" | "ru";
  t: (k: string) => string;
}) {
  return (
    <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
        {t("detail.leadsHeading")}
      </h2>
      {detail.leads.length === 0 ? (
        <p className="text-sm text-foreground/55">{t("detail.leadsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {detail.leads.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/5 pb-2 last:border-b-0 last:pb-0"
            >
              <span className="text-foreground/75">
                {l.productSlug}
                <span className="ml-2 text-xs text-foreground/55">
                  {l.utmSource ?? "—"} · {l.referer ?? "—"}
                </span>
              </span>
              <span className="text-xs text-foreground/55">
                {formatDate(l.createdAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaseCard({
  detail,
  locale,
  t,
}: {
  detail: AdminUserDetail;
  locale: "uk" | "ru";
  t: (k: string) => string;
}) {
  if (!detail.caseStudy) return null;
  return (
    <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <h2 className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
        <span>{t("detail.caseHeading")}</span>
        <Link
          href={`/admin/cases/${detail.id}`}
          className="text-[10px] uppercase tracking-wider text-foreground/65 underline-offset-4 hover:underline"
        >
          {t("detail.caseOpen")} →
        </Link>
      </h2>
      <p className="mb-2 text-xs text-foreground/55">
        {t("detail.caseSubmittedAt")} {formatDate(detail.caseStudy.submittedAt, locale)}
        {" · "}
        <span className={detail.caseStudy.approved ? "text-emerald-300" : "text-amber-300"}>
          {detail.caseStudy.approved ? t("status.approved") : t("status.pending")}
        </span>
      </p>
      <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
        {detail.caseStudy.bodyUk}
      </p>
    </div>
  );
}

function MetaRow({
  label,
  value,
  emphasis = "neutral",
}: {
  label: string;
  value: string;
  emphasis?: "neutral" | "positive" | "alert";
}) {
  const valueClass =
    emphasis === "positive"
      ? "text-emerald-300"
      : emphasis === "alert"
        ? "text-amber-300"
        : "text-foreground/85";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-foreground/55">{label}</dt>
      <dd className={`text-right ${valueClass}`}>{value}</dd>
    </div>
  );
}
