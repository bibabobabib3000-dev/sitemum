import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.states.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function StatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "dashboard.states" });

  return (
    <div className="pb-24">
      <h1 className="font-display text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/65">{t("intro")}</p>

      <div className="mt-10 rounded-3xl border border-dashed border-foreground/15 bg-muted/20 p-8 text-sm text-foreground/65">
        <p>{t("comingSoon")}</p>
        <ul className="mt-4 grid list-disc gap-1 ps-5 text-foreground/55">
          <li>{t("bullets.map")}</li>
          <li>{t("bullets.history")}</li>
          <li>{t("bullets.share")}</li>
        </ul>
      </div>
    </div>
  );
}
