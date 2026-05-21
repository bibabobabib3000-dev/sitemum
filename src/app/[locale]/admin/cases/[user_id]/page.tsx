import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CaseReviewForm } from "@/components/admin/case-review-form";
import { getCaseDetail } from "@/lib/admin/cases";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; user_id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.cases" });
  return {
    title: t("detail.metaTitle"),
    robots: { index: false, follow: false },
  };
}

function formatDate(d: Date, locale: "uk" | "ru"): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function looksLikeUrl(s: string | null): s is string {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; user_id: string }>;
}) {
  const { locale: localeRaw, user_id } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  // Basic UUID shape check — the data lookup will short-circuit anyway,
  // but this avoids hitting Postgres with garbage.
  if (!/^[0-9a-f-]{36}$/i.test(user_id)) {
    notFound();
  }

  const detail = await getCaseDetail(user_id);
  if (!detail) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "admin.cases" });

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow={t("detail.eyebrow")}
        title={detail.fullName ?? detail.email}
        description={detail.email}
        actions={
          <Link
            href="/admin/cases"
            className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
          >
            ← {t("detail.backToQueue")}
          </Link>
        }
      />

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
              {t("detail.bodyHeading")}
            </h2>
            <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
              {detail.bodyUk}
            </article>
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
              {t("detail.videoHeading")}
            </h2>
            {looksLikeUrl(detail.videoUrl) ? (
              <a
                href={detail.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-foreground/80 underline-offset-4 hover:underline"
              >
                {detail.videoUrl}
              </a>
            ) : (
              <span className="text-sm text-foreground/55">{t("detail.noVideo")}</span>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
              {t("detail.metaHeading")}
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <MetaRow
                label={t("detail.meta.submittedAt")}
                value={formatDate(detail.submittedAt, locale)}
              />
              <MetaRow
                label={t("detail.meta.locale")}
                value={detail.locale.toUpperCase()}
              />
              <MetaRow
                label={t("detail.meta.tg")}
                value={detail.tgUsername ? `@${detail.tgUsername}` : "—"}
              />
              <MetaRow
                label={t("detail.meta.status")}
                value={detail.approved ? t("status.approved") : t("status.pending")}
                emphasis={detail.approved ? "positive" : "alert"}
              />
              {detail.approvedAt ? (
                <MetaRow
                  label={t("detail.meta.approvedAt")}
                  value={formatDate(detail.approvedAt, locale)}
                />
              ) : null}
              {detail.reviewerEmail ? (
                <MetaRow
                  label={t("detail.meta.reviewer")}
                  value={detail.reviewerEmail}
                />
              ) : null}
            </dl>
          </div>

          <CaseReviewForm
            userId={detail.userId}
            approved={detail.approved}
            defaultNotes={detail.reviewNotesUk ?? ""}
            copy={{
              notesLabel: t("form.notesLabel"),
              notesPlaceholder: t("form.notesPlaceholder"),
              notesHelp: t("form.notesHelp"),
              approve: t("form.approve"),
              reject: t("form.reject"),
              submitting: t("form.submitting"),
              emailDelivered: t("form.emailDelivered"),
              emailFailed: t("form.emailFailed"),
              tgDelivered: t("form.tgDelivered"),
              tgFailed: t("form.tgFailed"),
              successApprove: t("form.successApprove"),
              successReject: t("form.successReject"),
              errorGeneric: t("form.errorGeneric"),
              alreadyApproved: t("form.alreadyApproved"),
            }}
          />
        </aside>
      </section>
    </div>
  );
}

function MetaRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "positive" | "alert";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-foreground/55">{label}</dt>
      <dd
        className={
          "text-sm " +
          (emphasis === "positive"
            ? "text-emerald-300"
            : emphasis === "alert"
              ? "text-amber-300"
              : "text-foreground/80")
        }
      >
        {value}
      </dd>
    </div>
  );
}
