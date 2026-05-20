import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function PlatformCta() {
  const t = useTranslations("platform.cta");

  return (
    <section className="border-t border-foreground/10 py-20 sm:py-28">
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-3xl border border-foreground/10 bg-muted/40 p-8 text-center sm:p-12">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="max-w-xl text-foreground/70 sm:text-lg">{t("desc")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/#form">
              <Button size="lg" className="gap-2">
                {t("primary")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/#program">
              <Button size="lg" variant="outline">
                {t("secondary")}
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
