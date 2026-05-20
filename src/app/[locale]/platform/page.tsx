import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { PlatformHero } from "@/components/sections/platform/platform-hero";
import { PlatformFeatures } from "@/components/sections/platform/features";
import { CommandCenter } from "@/components/sections/platform/command-center";
import { VisualRoadmap } from "@/components/sections/platform/roadmap";
import { DeliverySystem } from "@/components/sections/platform/delivery";
import { EcosystemStats } from "@/components/sections/platform/stats";
import { MobilePwa } from "@/components/sections/platform/mobile";
import { PlatformCta } from "@/components/sections/platform/platform-cta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "platform.meta" });

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
  };
}

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteNav />
      <main>
        <PlatformHero />
        <PlatformFeatures />
        <CommandCenter />
        <VisualRoadmap />
        <DeliverySystem />
        <EcosystemStats />
        <MobilePwa />
        <PlatformCta />
      </main>
      <Footer />
    </>
  );
}
