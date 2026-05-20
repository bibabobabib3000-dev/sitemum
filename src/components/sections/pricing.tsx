import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CATALOG, amountUah, type ProductSlug } from "@/lib/payments/catalog";

interface Plan {
  slug: ProductSlug;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  { slug: "level-0", highlighted: true },
  { slug: "level-1" },
  { slug: "level-2" },
];

export function PricingSection() {
  const t = useTranslations("pricing");
  const locale = t("locale") as "uk" | "ru";

  return (
    <section
      id="pricing"
      className="border-t border-foreground/10 py-20 sm:py-28"
    >
      <Container>
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <p className="text-xs uppercase tracking-widest text-foreground/60">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-foreground/70 sm:text-lg">{t("desc")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Plan key={p.slug} slug={p.slug} highlighted={p.highlighted} locale={locale} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function Plan({
  slug,
  highlighted,
  locale,
}: {
  slug: ProductSlug;
  highlighted?: boolean;
  locale: "uk" | "ru";
}) {
  const t = useTranslations(`pricing.plans.${slug}`);
  const product = CATALOG[slug];
  const title = locale === "ru" ? product.titleRu : product.titleUk;
  const desc = locale === "ru" ? product.descRu : product.descUk;
  const features = t.raw("features") as string[];
  const ctaHref = slug === "level-0" ? "/#form" : "/#form";

  return (
    <div
      className={
        "flex flex-col gap-6 rounded-3xl border p-7 sm:p-8 " +
        (highlighted
          ? "border-foreground/30 bg-muted/60"
          : "border-foreground/10 bg-muted/30")
      }
    >
      <div>
        <h3 className="font-display text-3xl">{title}</h3>
        <p className="mt-2 text-foreground/70">{desc}</p>
      </div>

      <div>
        <p className="font-display text-5xl leading-none">
          {amountUah(product.amountCents)}{" "}
          <span className="text-lg uppercase tracking-wide text-foreground/60">
            {product.currency}
          </span>
        </p>
      </div>

      <ul className="flex flex-col gap-3 text-sm text-foreground/80">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-foreground/60" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <Link href={ctaHref}>
          <Button
            size="lg"
            variant={highlighted ? "primary" : "outline"}
            className="w-full gap-2"
          >
            {t("cta")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
