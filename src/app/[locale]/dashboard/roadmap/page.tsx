import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import { getRoadmap } from "@/lib/courses/roadmap-state";
import { CATALOG, type ProductSlug } from "@/lib/payments/catalog";
import {
  RoadmapTimeline,
  type TimelineMilestone,
} from "@/components/dashboard/roadmap-timeline";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.roadmap.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function RoadmapPage({
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

  const milestones = await getRoadmap(session!.uid);

  const t = await getTranslations({ locale, namespace: "dashboard.roadmap" });

  const localized: TimelineMilestone[] = milestones.map((m) => {
    const product = CATALOG[m.id as ProductSlug];
    const title = product
      ? locale === "ru"
        ? product.titleRu
        : product.titleUk
      : m.title;
    return { ...m, title };
  });

  return (
    <div className="pb-24">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/65">{t("intro")}</p>

      <RoadmapTimeline
        milestones={localized}
        locale={locale}
        labels={{
          locked: t("state.locked"),
          active: t("state.active"),
          done: t("state.done"),
          progressOf: t("progressOf"),
          homework: t("homework"),
        }}
      />

      <p className="mt-12 max-w-2xl text-xs text-foreground/45">{t("footnote")}</p>
    </div>
  );
}
