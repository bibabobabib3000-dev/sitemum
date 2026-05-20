import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import {
  canEnterCourse,
  ensureEnrollment,
  getLesson,
  listHomework,
} from "@/lib/courses/access";
import { unlockInfo } from "@/lib/courses/drip";
import { r2PublicUrl } from "@/lib/storage/r2";
import { LessonPlayer } from "@/components/courses/lesson-player";
import { HomeworkForm } from "@/components/courses/homework-form";
import { LessonLibrary } from "@/components/courses/library";

export const dynamic = "force-dynamic";

interface PageParams {
  locale: string;
  lessonSlug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, lessonSlug } = await params;
  const lesson = await getLesson("level-0", lessonSlug);
  if (!lesson) {
    return { title: "RESOUL", robots: { index: false, follow: false } };
  }
  const title = locale === "ru" ? lesson.titleRu ?? lesson.titleUk : lesson.titleUk;
  return {
    title: `${title} — RESOUL`,
    robots: { index: false, follow: false },
  };
}

function renderMarkdown(md: string): string {
  // Tiny safe renderer — escape everything, then re-introduce simple
  // structures: `## h`, `### h`, blank-line paragraphs.
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = esc.split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      if (/^###\s+/.test(p)) {
        return `<h3 class="mt-6 font-display text-lg">${p.replace(/^###\s+/, "")}</h3>`;
      }
      if (/^##\s+/.test(p)) {
        return `<h2 class="mt-8 font-display text-xl">${p.replace(/^##\s+/, "")}</h2>`;
      }
      return `<p class="mt-4 text-sm text-foreground/75 leading-relaxed whitespace-pre-line">${p}</p>`;
    })
    .join("");
}

export default async function LessonPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { locale: localeRaw, lessonSlug } = await params;
  setRequestLocale(localeRaw);
  const locale: "uk" | "ru" = localeRaw === "ru" ? "ru" : "uk";

  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
  }
  const userId = session!.uid;

  const lesson = await getLesson("level-0", lessonSlug);
  if (!lesson) {
    notFound();
  }

  const allowed = await canEnterCourse(userId, lesson.courseSlug);
  if (!allowed) {
    redirect({ href: "/dashboard/level-0", locale });
  }

  const enrollment = await ensureEnrollment(userId, lesson.courseSlug);
  if (!enrollment) {
    return null;
  }
  const info = unlockInfo(new Date(), enrollment.startedAt, lesson.dayOffset);
  if (!info.unlocked) {
    redirect({ href: "/dashboard/level-0", locale });
  }

  const recent = await listHomework(userId, lesson.id, 3);

  const t = await getTranslations({ locale, namespace: "lesson" });
  const title = locale === "ru" ? lesson.titleRu ?? lesson.titleUk : lesson.titleUk;
  const body =
    locale === "ru"
      ? lesson.bodyMdRu ?? lesson.bodyMdUk ?? ""
      : lesson.bodyMdUk ?? "";

  const assets = lesson.assetKeys
    .map((key) => ({ key, url: r2PublicUrl(key) }))
    .filter((a): a is { key: string; url: string } => Boolean(a.url));

  return (
    <article className="pb-24">
      <Link
        href="/dashboard/level-0"
        className="text-xs uppercase tracking-widest text-foreground/55 hover:text-foreground"
      >
        ← {t("backToCourse")}
      </Link>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-foreground/45">
        {t("dayBadge", { day: lesson.dayOffset + 1 })}
      </p>

      <div className="mt-8">
        <LessonPlayer lessonId={lesson.id} locale={locale} />
      </div>

      {body ? (
        <div
          className="mt-10"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      ) : null}

      {assets.length > 0 ? (
        <div className="mt-12">
          <LessonLibrary assets={assets} locale={locale} />
        </div>
      ) : null}

      <div className="mt-12">
        <HomeworkForm
          lessonId={lesson.id}
          locale={locale}
          recent={recent.map((r) => ({
            id: r.id,
            bodyText: r.bodyText,
            externalUrl: r.externalUrl,
            fileKeysCount: r.fileKeys.length,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      </div>
    </article>
  );
}
