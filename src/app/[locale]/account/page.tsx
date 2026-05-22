import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { Container } from "@/components/ui/container";
import { getSession } from "@/lib/auth/session";
import { getCurrentUser, userIsBanned } from "@/lib/auth/user";
import { AccountForm } from "@/components/account/account-form";
import { Link } from "@/i18n/navigation";

// Reads the cookie + a `users` row on every request — cannot be cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  // Triple gate: no session → /login, banned → /banned, no DB / stale
  // session → /login (treat as logged out).
  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
  }
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
  }
  if (userIsBanned(user)) {
    redirect({ href: "/banned", locale });
  }
  // `redirect` is typed as `() => never` but TS does not narrow through it
  // when called inside an `if`. Use a non-null assertion (the pattern used
  // elsewhere in this app — see e.g. dashboard/level-0/page.tsx).
  const resolvedUser = user!;

  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <>
      <SiteNav />
      <main className="pt-24">
        <Container className="max-w-2xl pb-24">
          <p className="text-xs uppercase tracking-widest text-foreground/60">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-foreground/70">{t("subtitle")}</p>

          <div className="mt-10 rounded-3xl border border-foreground/10 bg-muted/30 p-8 sm:p-10">
            <div className="mb-8 grid gap-1">
              <span className="text-xs uppercase tracking-widest text-foreground/55">
                {t("identity.emailLabel")}
              </span>
              <span className="text-base text-foreground">{resolvedUser.email}</span>
              <span className="mt-1 text-xs text-foreground/55">
                {t("identity.emailHint")}
              </span>
            </div>

            <AccountForm
              locale={locale}
              initial={{
                displayName: resolvedUser.displayName,
                bio: resolvedUser.bio,
                locale: resolvedUser.locale,
                tz: resolvedUser.tz,
                notificationPrefs: resolvedUser.notificationPrefs,
                themePref: resolvedUser.themePref,
              }}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-foreground/65">
            <Link
              href="/dashboard"
              className="underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
            >
              {t("links.dashboard")}
            </Link>
            <form action="/api/auth/logout" method="post">
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
              >
                {t("links.logout")}
              </button>
            </form>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
