import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CATALOG, type ProductSlug } from "@/lib/payments/catalog";

interface TileLevelProps {
  locale: "uk" | "ru";
  ownedSlugs: Set<string>;
}

interface PlanRow {
  slug: ProductSlug;
  /**
   * When a product has a course page wired up, set its slug here so we can
   * link the row to `/dashboard/<courseSlug>`. PR #9 ships `level-0`; the
   * other rows stay as plain status indicators until their courses exist.
   */
  courseHref?: "/dashboard/level-0";
}

const PLANS: PlanRow[] = [
  { slug: "level-0", courseHref: "/dashboard/level-0" },
  { slug: "level-1" },
  { slug: "level-2" },
];

export async function TileLevel({ locale, ownedSlugs }: TileLevelProps) {
  const t = await getTranslations({ locale, namespace: "dashboard.tiles.level" });

  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-display text-2xl">{t("title")}</h2>
      <p className="mt-2 text-sm text-foreground/65">{t("desc")}</p>
      <ul className="mt-6 grid gap-3">
        {PLANS.map(({ slug, courseHref }) => {
          const product = CATALOG[slug];
          const title = locale === "ru" ? product.titleRu : product.titleUk;
          const owned = ownedSlugs.has(slug);
          const linkable = owned && Boolean(courseHref);

          const body = (
            <>
              <div className="flex-1">
                <p className="text-sm text-foreground">{title}</p>
                <p className="text-xs uppercase tracking-widest text-foreground/40">
                  {owned ? t("statusOpen") : t("statusLocked")}
                </p>
              </div>
              <span
                className={
                  "h-2.5 w-2.5 rounded-full " +
                  (owned ? "bg-emerald-300" : "bg-foreground/20")
                }
                aria-hidden="true"
              />
            </>
          );

          if (linkable && courseHref) {
            return (
              <li key={slug}>
                <Link
                  href={courseHref}
                  className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-background/50 px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-foreground/5"
                >
                  {body}
                </Link>
              </li>
            );
          }
          return (
            <li
              key={slug}
              className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-background/50 px-4 py-3"
            >
              {body}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
