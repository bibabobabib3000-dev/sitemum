import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import { listBookmarks } from "@/lib/lessons/notes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookmarksIndex.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

function fmtDate(d: Date, locale: "uk" | "ru"): string {
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uk-UA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default async function BookmarksIndexPage({
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
  const userId = session!.uid;

  const t = await getTranslations({ locale, namespace: "bookmarksIndex" });
  const bookmarks = await listBookmarks(userId, 200);

  return (
    <section className="pb-24">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/70">
        {t("subtitle")}
      </p>

      {bookmarks.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-foreground/15 bg-muted/20 p-8 text-sm text-foreground/65">
          <p className="font-display text-base text-foreground">
            {t("empty.title")}
          </p>
          <p className="mt-2">{t("empty.body")}</p>
          <Link
            href="/dashboard/level-0"
            className="mt-4 inline-block underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
          >
            {t("empty.cta")}
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-3">
          {bookmarks.map((b) => {
            const title =
              locale === "ru"
                ? b.titleRu ?? b.titleUk ?? t("unknownLesson")
                : b.titleUk ?? t("unknownLesson");
            const href =
              b.courseSlug === "level-0" && b.lessonSlug
                ? `/dashboard/level-0/${b.lessonSlug}`
                : b.courseSlug === "level-1"
                  ? "/dashboard/level-1"
                  : "/dashboard";
            const day =
              b.dayOffset !== null && b.dayOffset !== undefined
                ? t("dayBadge", { day: b.dayOffset + 1 })
                : null;
            return (
              <li key={b.lessonId}>
                <Link
                  href={href}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-foreground/10 bg-muted/30 p-5 transition-colors hover:border-foreground/30"
                >
                  <div className="flex flex-col">
                    <span className="font-display text-base text-foreground">
                      {title}
                    </span>
                    {day ? (
                      <span className="text-xs uppercase tracking-widest text-foreground/45">
                        {day}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-foreground/55">
                    {t("savedAt", { date: fmtDate(b.createdAt, locale) })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
