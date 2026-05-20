import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paid.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function PaidPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const ref = typeof sp?.ref === "string" ? sp.ref : null;
  const t = await getTranslations({ locale, namespace: "paid" });

  return (
    <>
      <SiteNav />
      <main className="flex min-h-[80vh] items-center">
        <Container className="max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-foreground/60">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-6 text-foreground/70 sm:text-lg">{t("body")}</p>
          {ref ? (
            <p className="mt-4 text-xs uppercase tracking-widest text-foreground/40">
              ref: {ref}
            </p>
          ) : null}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/">
              <Button size="lg">{t("home")}</Button>
            </Link>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
