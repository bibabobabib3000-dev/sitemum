import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listAccess, listRecentPayments } from "@/lib/auth/access-read";
import { getLevel2Gate } from "@/lib/courses/access";
import { TileLevel } from "@/components/dashboard/tile-level";
import { TileHistory } from "@/components/dashboard/tile-history";
import { TileStates } from "@/components/dashboard/tile-states";
import { TileCertificate } from "@/components/dashboard/tile-certificate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  // layout already gated; getSession here is safe to assume present.
  const session = await getSession();
  const userId = session?.uid ?? null;

  const [access, payments, level2Gate] = await Promise.all([
    userId ? listAccess(userId) : Promise.resolve([]),
    userId ? listRecentPayments(userId, 8) : Promise.resolve([]),
    userId
      ? getLevel2Gate(userId)
      : Promise.resolve({
          hasLevel2Access: false,
          caseStudy: "missing" as const,
          certificate: false,
        }),
  ]);

  const ownedSlugs = new Set(access.map((a) => a.productSlug));

  const t = await getTranslations({ locale, namespace: "dashboard" });

  return (
    <div className="pb-24">
      <h1 className="font-display text-3xl sm:text-4xl">{t("hello")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/65">{t("intro")}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <TileLevel locale={locale} ownedSlugs={ownedSlugs} />
        <TileHistory locale={locale} payments={payments} />
        <TileStates locale={locale} />
        {level2Gate.hasLevel2Access ? (
          <TileCertificate
            locale={locale}
            status={level2Gate.caseStudy}
            certificateReady={level2Gate.certificate}
          />
        ) : null}
      </div>
    </div>
  );
}
