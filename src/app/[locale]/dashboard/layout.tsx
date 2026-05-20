import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";

// Cookie-gated: must run on every request.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations({ locale, namespace: "dashboard.nav" });

  return (
    <>
      <SiteNav />
      <main className="pt-24">
        <Container>
          <nav className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-foreground/10 pb-4 text-sm">
            <Link
              href="/dashboard"
              className="text-foreground transition-colors hover:text-foreground"
            >
              {t("overview")}
            </Link>
            <Link
              href="/dashboard/roadmap"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              {t("roadmap")}
            </Link>
            <Link
              href="/dashboard/states"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              {t("states")}
            </Link>
            <form
              action="/api/auth/logout"
              method="post"
              className="ms-auto"
            >
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="text-sm text-foreground/60 transition-colors hover:text-foreground"
              >
                {t("logout")}
              </button>
            </form>
          </nav>
          {children}
        </Container>
      </main>
      <Footer />
    </>
  );
}
