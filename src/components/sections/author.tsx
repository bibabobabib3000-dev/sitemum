import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function Author() {
  const t = useTranslations("author");

  return (
    <section id="about" className="border-t border-foreground/10 py-20 sm:py-28">
      <Container className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-center md:gap-16">
        <div className="aspect-[4/5] overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-br from-muted to-background" />
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground/50">
            03
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-foreground/75">{t("desc")}</p>
          <div className="mt-7">
            <Button variant="outline">{t("cta")}</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
