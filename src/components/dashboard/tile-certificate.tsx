import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CaseStudyStatus } from "@/lib/courses/certificate";

interface TileCertificateProps {
  locale: "uk" | "ru";
  status: CaseStudyStatus;
  certificateReady: boolean;
}

const STATUS_DOT: Record<CaseStudyStatus, string> = {
  missing: "bg-foreground/25",
  pending: "bg-amber-300",
  approved: "bg-emerald-300",
};

/**
 * Tile shown only when the user owns the Level 2 product. Surfaces the case
 * study state on the main dashboard so students do not need to dig through
 * the cabinet to find the certification CTA.
 */
export async function TileCertificate({
  locale,
  status,
  certificateReady,
}: TileCertificateProps) {
  const t = await getTranslations({ locale, namespace: "dashboard.tiles.certificate" });

  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8 lg:col-span-3">
      <div className="flex items-start justify-between gap-6 sm:items-center">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-foreground/55">
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 font-display text-2xl">{t("title")}</h2>
          <p className="mt-2 text-sm text-foreground/65">
            {t(`status.${status}.body`)}
          </p>
        </div>
        <span
          className={"h-2.5 w-2.5 shrink-0 rounded-full " + STATUS_DOT[status]}
          aria-hidden="true"
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {certificateReady ? (
          <span className="inline-flex h-11 items-center rounded-full bg-emerald-300/15 px-5 text-sm font-medium text-emerald-200">
            {t("certificateReady")}
          </span>
        ) : (
          <Link
            href="/dashboard/level-1/case-study"
            className="inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {t(`status.${status}.cta`)}
          </Link>
        )}
      </div>
    </section>
  );
}
