import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function PlatformHero() {
  const t = useTranslations("platform.hero");

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[80svh] items-center overflow-hidden pt-24"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(245,245,244,0.08),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent"
      />

      <Container className="flex flex-col gap-8 py-20 sm:py-24">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 text-xs uppercase tracking-widest text-foreground/70">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
          {t("eyebrow")}
        </span>

        <h1 className="font-display text-balance text-5xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
          {t("title")}
        </h1>

        <p className="max-w-2xl text-balance text-lg text-foreground/70 sm:text-xl">
          {t("subtitle")}
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/#form">
            <Button size="lg" className="gap-2">
              {t("cta")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/#program">
            <Button size="lg" variant="outline">
              {t("secondary")}
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
