import { getTranslations } from "next-intl/server";

interface Asset {
  key: string;
  url: string;
}

interface LessonLibraryProps {
  assets: Asset[];
  locale: "uk" | "ru";
}

function basename(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}

export async function LessonLibrary({ assets, locale }: LessonLibraryProps) {
  const t = await getTranslations({ locale, namespace: "lesson.library" });
  if (assets.length === 0) return null;
  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-display text-2xl">{t("title")}</h2>
      <p className="mt-2 text-sm text-foreground/65">{t("desc")}</p>
      <ul className="mt-6 grid gap-2 text-sm">
        {assets.map((a) => (
          <li
            key={a.key}
            className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-background/50 px-4 py-3"
          >
            <span className="truncate text-foreground/80">{basename(a.key)}</span>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-foreground/20 px-3 py-1 text-xs uppercase tracking-widest text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
            >
              {t("open")}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
