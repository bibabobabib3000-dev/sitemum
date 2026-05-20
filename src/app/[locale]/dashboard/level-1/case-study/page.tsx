import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import { hasAccess } from "@/lib/payments/access";
import {
  getCaseStudy,
  caseStudyStatus,
  type CaseStudyStatus,
} from "@/lib/courses/certificate";
import { CaseStudyForm } from "@/components/dashboard/case-study-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "dashboard.caseStudy.meta",
  });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

const STATUS_STYLES: Record<CaseStudyStatus, string> = {
  missing:
    "border-foreground/15 bg-background/60 text-foreground/70",
  pending:
    "border-amber-300/30 bg-amber-300/10 text-amber-200",
  approved:
    "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
};

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Locked behind the Level 2 paywall — the form is only meaningful for
  // students enrolled in the certification programme.
  const ownsL2 = await hasAccess(session!.uid, "level-2");
  const cs = ownsL2 ? await getCaseStudy(session!.uid) : null;
  const status = ownsL2 ? caseStudyStatus(cs) : "missing";

  const t = await getTranslations({
    locale,
    namespace: "dashboard.caseStudy",
  });

  if (!ownsL2) {
    return (
      <div className="pb-24">
        <p className="text-xs uppercase tracking-widest text-foreground/55">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">{t("title")}</h1>
        <div className="mt-8 max-w-2xl rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
          <p className="text-sm text-foreground/75">{t("noAccess.body")}</p>
          <div className="mt-6">
            <Link
              href="/platform"
              className="inline-flex h-11 items-center rounded-full border border-foreground/30 px-6 text-sm font-medium text-foreground hover:border-foreground hover:bg-foreground/5"
            >
              {t("noAccess.cta")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/65">{t("intro")}</p>

      <div
        className={
          "mt-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest " +
          STATUS_STYLES[status]
        }
      >
        <span className="font-medium">{t(`status.${status}.badge`)}</span>
      </div>

      <div className="mt-3 max-w-2xl rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
        <p className="text-sm text-foreground/75">
          {t(`status.${status}.body`)}
        </p>
        {status === "approved" && cs?.approvedAt ? (
          <p className="mt-3 text-xs text-foreground/45">
            {t("status.approved.approvedAt", {
              date: cs.approvedAt.toLocaleDateString(
                locale === "ru" ? "ru-RU" : "uk-UA",
                { year: "numeric", month: "long", day: "2-digit" }
              ),
            })}
          </p>
        ) : null}
      </div>

      {status === "approved" ? null : (
        <section className="mt-10 max-w-2xl">
          <h2 className="font-display text-2xl">{t("form.title")}</h2>
          <p className="mt-2 text-sm text-foreground/60">{t("form.intro")}</p>
          <CaseStudyForm
            initialBody={cs?.bodyUk ?? ""}
            initialVideoUrl={cs?.videoUrl ?? ""}
            isResubmit={status === "pending"}
          />
        </section>
      )}
    </div>
  );
}
