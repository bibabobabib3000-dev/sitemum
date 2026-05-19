import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

type Pillar = { title: string; desc: string };

export function Method() {
  const t = useTranslations("method");
  const pillars = t.raw("pillars") as Pillar[];

  return (
    <section id="method" className="py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-foreground/50">
            01
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-lg text-foreground/70">{t("subtitle")}</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {pillars.map((p, i) => (
            <article
              key={i}
              className="group relative flex flex-col gap-4 rounded-3xl border border-foreground/10 bg-muted/40 p-7 transition-colors hover:border-foreground/30"
            >
              <span className="text-xs uppercase tracking-widest text-foreground/40">
                0{i + 1}
              </span>
              <h3 className="font-display text-2xl">{p.title}</h3>
              <p className="text-foreground/70">{p.desc}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
