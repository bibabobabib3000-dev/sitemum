import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { isSessionBanned } from "@/lib/auth/user";
import { countUnread } from "@/lib/notifications/read";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";
import { NotifBell } from "@/components/dashboard/notif-bell";

// Cookie-gated + ban-gated: must run on every request.
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

  // Ban gate: a session whose user got banned mid-session is bounced to
  // a dedicated explainer page. We do NOT silently log them out — the
  // user needs to know why they lost access.
  if (await isSessionBanned()) {
    redirect({ href: "/banned", locale });
  }

  const t = await getTranslations({ locale, namespace: "dashboard.nav" });
  const unread = session ? await countUnread(session.uid) : 0;

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
            <Link
              href="/dashboard/notes"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              {t("notes")}
            </Link>
            <Link
              href="/dashboard/bookmarks"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              {t("bookmarks")}
            </Link>
            <Link
              href="/account"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              {t("account")}
            </Link>
            <div className="ms-auto flex items-center gap-3">
              <NotifBell initialUnread={unread} />
              <form action="/api/auth/logout" method="post">
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="text-sm text-foreground/60 transition-colors hover:text-foreground"
                >
                  {t("logout")}
                </button>
              </form>
            </div>
          </nav>
          {children}
        </Container>
      </main>
      <Footer />
    </>
  );
}
