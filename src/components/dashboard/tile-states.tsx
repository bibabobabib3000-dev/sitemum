import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function TileStates({ locale }: { locale: "uk" | "ru" }) {
  const t = await getTranslations({ locale, namespace: "dashboard.tiles.states" });
  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-display text-2xl">{t("title")}</h2>
      <p className="mt-2 text-sm text-foreground/65">{t("desc")}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-foreground/15 px-4 py-6 text-sm text-foreground/55">
        <p>{t("comingSoon")}</p>
        <Link
          href="/dashboard/states"
          className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-foreground hover:text-foreground"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
