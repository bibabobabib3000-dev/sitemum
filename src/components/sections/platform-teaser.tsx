import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";

export function PlatformTeaser() {
  const t = useTranslations("platform.teaser");

  return (
    <section className="border-t border-foreground/10 py-16 sm:py-20">
      <Container>
        <div className="flex flex-col gap-6 rounded-3xl border border-foreground/10 bg-muted/40 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-foreground/50">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 text-base text-foreground/70 sm:text-lg">
              {t("desc")}
            </p>
          </div>
          <Link
            href="/platform"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-foreground/30 px-6 py-3 text-sm font-medium transition-colors hover:border-foreground hover:bg-foreground/5"
          >
            {t("cta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
