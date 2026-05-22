import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { Container } from "@/components/ui/container";
import { getCurrentUser, userIsBanned } from "@/lib/auth/user";

// Reads `users.banned_at` on every request, so caching is a no-go.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "banned.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function BannedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  const user = await getCurrentUser();

  // Two early-exits:
  //   1. No session at all — there is nothing to display; bounce to login.
  //   2. Session exists but the account is NOT banned — the user landed
  //      here by accident (bookmark / shared link); send them home.
  if (!user) {
    redirect({ href: "/login", locale });
  }
  if (!userIsBanned(user)) {
    redirect({ href: "/dashboard", locale });
  }
  // TS doesn't narrow through `redirect` (see comment in account/page.tsx).
  const bannedUser = user!;

  const t = await getTranslations({ locale, namespace: "banned" });

  return (
    <>
      <SiteNav />
      <main className="flex min-h-[80vh] items-center">
        <Container className="max-w-xl">
          <div className="rounded-3xl border border-red-400/30 bg-red-500/[0.04] p-8 sm:p-10">
            <p className="text-xs uppercase tracking-widest text-red-300/80">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-sm text-foreground/75">{t("body")}</p>
            {bannedUser.banReason ? (
              <div className="mt-6 rounded-2xl border border-foreground/15 bg-background/60 p-5">
                <p className="text-xs uppercase tracking-widest text-foreground/55">
                  {t("reasonLabel")}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/85">
                  {bannedUser.banReason}
                </p>
              </div>
            ) : null}
            <p className="mt-6 text-sm text-foreground/70">
              {t.rich("contact", {
                a: (chunks) => (
                  <a
                    href={`mailto:${t("supportEmail")}`}
                    className="underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
            <form
              action="/api/auth/logout"
              method="post"
              className="mt-8"
            >
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full border border-foreground/30 px-6 text-sm font-medium text-foreground transition-colors hover:border-foreground hover:bg-foreground/5"
              >
                {t("logout")}
              </button>
            </form>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
