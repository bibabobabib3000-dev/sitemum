import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import { listNotes } from "@/lib/lessons/notes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notesIndex.meta" });
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
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function snippet(md: string, max = 220): string {
  const stripped = md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max - 1) + "…";
}

export default async function NotesIndexPage({
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

  const t = await getTranslations({ locale, namespace: "notesIndex" });
  const notes = await listNotes(userId, 200);

  return (
    <section className="pb-24">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/70">
        {t("subtitle")}
      </p>

      {notes.length === 0 ? (
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
        <ul className="mt-10 grid gap-4">
          {notes.map((n) => {
            const title =
              locale === "ru"
                ? n.titleRu ?? n.titleUk ?? t("unknownLesson")
                : n.titleUk ?? t("unknownLesson");
            // Notes are linked back to their lesson, but the lesson page
            // currently lives under `/dashboard/level-0/[lessonSlug]`. If
            // the course slug isn't level-0 (future levels) we still link
            // to the level overview so the user can find the lesson.
            const href =
              n.courseSlug === "level-0" && n.lessonSlug
                ? `/dashboard/level-0/${n.lessonSlug}`
                : n.courseSlug === "level-1"
                  ? "/dashboard/level-1"
                  : "/dashboard";
            return (
              <li key={n.lessonId}>
                <Link
                  href={href}
                  className="block rounded-2xl border border-foreground/10 bg-muted/30 p-5 transition-colors hover:border-foreground/30"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-display text-base text-foreground">
                      {title}
                    </span>
                    <span className="text-xs text-foreground/55">
                      {t("updatedAt", { date: fmtDate(n.updatedAt, locale) })}
                    </span>
                  </header>
                  <p className="mt-2 text-sm text-foreground/70">
                    {snippet(n.bodyMd)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
