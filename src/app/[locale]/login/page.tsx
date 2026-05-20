import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const status = typeof sp?.status === "string" ? sp.status : null;
  const t = await getTranslations({ locale, namespace: "login" });

  return (
    <>
      <SiteNav />
      <main className="flex min-h-[80vh] items-center">
        <Container className="max-w-md">
          <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-8 sm:p-10">
            <p className="text-xs uppercase tracking-widest text-foreground/60">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-sm text-foreground/70">{t("subtitle")}</p>
            <div className="mt-8">
              <LoginForm
                locale={locale === "ru" ? "ru" : "uk"}
                initialStatus={status}
              />
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
