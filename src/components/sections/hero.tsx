import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const t = useTranslations("hero");

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(245,245,244,0.08),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent"
      />

      <Container className="grid gap-10 py-20 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-8 animate-fade-in-up">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 text-xs uppercase tracking-widest text-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            {t("eyebrow")}
          </span>

          <h1 className="font-display text-balance text-5xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
            {t("title")}
          </h1>

          <p className="max-w-xl text-balance text-lg text-foreground/70 sm:text-xl">
            {t("subtitle")}
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="#form">
              <Button size="lg" className="gap-2">
                {t("cta")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#program">
              <Button size="lg" variant="outline">
                {t("secondary")}
              </Button>
            </a>
          </div>

          <p className="text-xs uppercase tracking-widest text-foreground/50">
            {t("note")}
          </p>
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-foreground/10 via-transparent to-transparent" />
          <div className="flex h-full flex-col justify-between rounded-3xl border border-foreground/10 p-8">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-foreground/50">
                v 1.0
              </span>
              <span className="text-xs uppercase tracking-widest text-foreground/50">
                5d · 1 live
              </span>
            </div>
            <div className="space-y-2 font-display text-3xl leading-tight">
              <p>Структура.</p>
              <p>Тіло.</p>
              <p>Стани.</p>
              <p>Практика.</p>
              <p>Інтеграція.</p>
            </div>
            <div className="flex items-end justify-between text-xs uppercase tracking-widest text-foreground/50">
              <span>D1 → D5</span>
              <span>RESOUL METHOD</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
