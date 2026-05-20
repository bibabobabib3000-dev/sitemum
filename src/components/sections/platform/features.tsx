import { useTranslations } from "next-intl";
import { Map, ShoppingBag, UserCog, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/container";

type FeatureIcon = "userCog" | "map" | "shoppingBag";

type Feature = {
  icon: FeatureIcon;
  title: string;
  desc: string;
};

const ICONS: Record<FeatureIcon, LucideIcon> = {
  userCog: UserCog,
  map: Map,
  shoppingBag: ShoppingBag,
};

export function PlatformFeatures() {
  const t = useTranslations("platform.features");
  const items = t.raw("items") as Feature[];

  return (
    <section className="border-t border-foreground/10 py-20 sm:py-28">
      <Container>
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-foreground/50">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <article
                key={i}
                className="group relative flex flex-col gap-5 rounded-3xl border border-foreground/10 bg-muted/40 p-7 transition-colors hover:border-foreground/30"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/15 bg-background/60">
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                </span>
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="text-foreground/70">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
