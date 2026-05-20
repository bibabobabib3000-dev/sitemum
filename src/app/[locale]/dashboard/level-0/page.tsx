import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import {
  canEnterCourse,
  ensureEnrollment,
  getCourse,
  listLessons,
} from "@/lib/courses/access";
import { unlockInfo } from "@/lib/courses/drip";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "course.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function Level0Page({
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

  const allowed = await canEnterCourse(userId, "level-0");
  const t = await getTranslations({ locale, namespace: "course" });

  if (!allowed) {
    return (
      <section className="pb-24">
        <p className="text-xs uppercase tracking-widest text-foreground/55">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">
          {t("locked.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/70">
          {t("locked.body")}
        </p>
        <Link
          href="/platform"
          className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
        >
          {t("locked.cta")}
        </Link>
      </section>
    );
  }

  const [course, lessons, enrollment] = await Promise.all([
    getCourse("level-0"),
    listLessons("level-0"),
    ensureEnrollment(userId, "level-0"),
  ]);

  if (!course || lessons.length === 0 || !enrollment) {
    return (
      <section className="pb-24">
        <p className="text-xs uppercase tracking-widest text-foreground/55">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">
          {t("emptyTitle")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/70">
          {t("emptyBody")}
        </p>
      </section>
    );
  }

  const now = new Date();
  const courseTitle = locale === "ru" ? course.titleRu ?? course.titleUk : course.titleUk;
  const courseDesc =
    locale === "ru"
      ? course.descriptionRu ?? course.descriptionUk ?? ""
      : course.descriptionUk ?? "";

  return (
    <section className="pb-24">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">{courseTitle}</h1>
      <p className="mt-3 max-w-2xl text-sm text-foreground/70">{courseDesc}</p>

      <ol className="mt-10 grid gap-3">
        {lessons.map((lesson) => {
          const info = unlockInfo(now, enrollment.startedAt, lesson.dayOffset);
          const title = locale === "ru" ? lesson.titleRu ?? lesson.titleUk : lesson.titleUk;
          const dayBadge = t("dayBadge", { day: lesson.dayOffset + 1 });
          return (
            <li
              key={lesson.id}
              className="rounded-2xl border border-foreground/10 bg-muted/30"
            >
              {info.unlocked ? (
                <Link
                  href={`/dashboard/level-0/${lesson.slug}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-foreground/5"
                >
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-widest text-foreground/40">
                      {dayBadge}
                    </p>
                    <p className="mt-1 text-foreground">{title}</p>
                  </div>
                  <span className="text-xs uppercase tracking-widest text-emerald-300">
                    {t("statusOpen")}
                  </span>
                </Link>
              ) : (
                <div
                  className="flex items-center gap-4 px-5 py-4 opacity-60"
                  aria-disabled="true"
                >
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-widest text-foreground/40">
                      {dayBadge}
                    </p>
                    <p className="mt-1 text-foreground/70">{title}</p>
                  </div>
                  <span className="text-xs uppercase tracking-widest text-foreground/45">
                    {t("opensIn", { days: info.daysUntilUnlock })}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
