import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Stat } from "@/components/ui/stat";

type StatItem = { value: string; caption: string };

export function EcosystemStats() {
  const t = useTranslations("platform.stats");
  const items = t.raw("items") as StatItem[];

  return (
    <section className="border-t border-foreground/10 bg-muted/30 py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground/50">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {items.map((s, i) => (
              <Stat key={i} value={s.value} caption={s.caption} />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-foreground/10 bg-background/40 p-8 sm:p-10">
          <h3 className="font-display text-2xl sm:text-3xl">
            {t("side.title")}
          </h3>
          <p className="mt-4 text-foreground/70 sm:text-lg">
            {t("side.desc")}
          </p>
        </div>
      </Container>
    </section>
  );
}
