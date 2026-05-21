import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminKpiCard } from "@/components/admin/kpi-card";
import { getOverviewMetrics } from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.overview" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

function formatUah(cents: number, locale: "uk" | "ru"): string {
  const uah = cents / 100;
  return new Intl.NumberFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(uah);
}

function formatPercent(rate: number | null, locale: "uk" | "ru"): string | null {
  if (rate === null) return null;
  return new Intl.NumberFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(rate);
}

function formatTime(iso: string, locale: "uk" | "ru"): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-UA" : "uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  const t = await getTranslations({ locale, namespace: "admin.overview" });

  const metrics = await getOverviewMetrics();

  const tiles: {
    label: string;
    value: React.ReactNode | null;
    hint?: string;
    tone?: "default" | "alert" | "positive";
  }[] = [
    {
      label: t("kpi.newLeads24h"),
      value: metrics.newLeads24h,
      hint: t("kpi.newLeads24hHint"),
    },
    {
      label: t("kpi.conversion30d"),
      value: formatPercent(metrics.conversion30d, locale),
      hint: t("kpi.conversion30dHint"),
    },
    {
      label: t("kpi.paymentsToday"),
      value: formatUah(metrics.paymentsTodayUahCents, locale),
      hint: t("kpi.paymentsTodayHint"),
    },
    {
      label: t("kpi.activeLevel0"),
      value: metrics.activeLevel0,
      hint: t("kpi.activeLevel0Hint"),
    },
    {
      label: t("kpi.activeLevel1"),
      value: metrics.activeLevel1,
      hint: t("kpi.activeLevel1Hint"),
    },
    {
      label: t("kpi.activeLevel2"),
      value: metrics.activeLevel2,
      hint: t("kpi.activeLevel2Hint"),
    },
    {
      label: t("kpi.casesPending"),
      value: metrics.casesPending,
      hint: t("kpi.casesPendingHint"),
      tone: metrics.casesPending > 0 ? "alert" : "default",
    },
    {
      label: t("kpi.webhookErrors7d"),
      value: metrics.webhookErrors7d,
      hint: t("kpi.webhookErrors7dHint"),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <span className="text-xs text-foreground/55">
            {t("generatedAt", { time: formatTime(metrics.generatedAt, locale) })}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <AdminKpiCard
            key={tile.label}
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            tone={tile.tone}
          />
        ))}
      </div>

      <p className="text-xs text-foreground/45">{t("cacheNote")}</p>
    </div>
  );
}
