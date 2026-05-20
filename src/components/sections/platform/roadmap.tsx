import Image from "next/image";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

type Milestone = {
  level: string;
  title: string;
  desc: string;
};

export function VisualRoadmap() {
  const t = useTranslations("platform.roadmap");
  const milestones = t.raw("milestones") as Milestone[];

  return (
    <section className="border-t border-foreground/10 bg-muted/30 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground/50">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-lg text-foreground/70">{t("desc")}</p>

          <ol className="mt-8 space-y-4">
            {milestones.map((m, i) => (
              <li
                key={i}
                className="flex gap-5 rounded-2xl border border-foreground/10 bg-background/40 p-5"
              >
                <span className="font-display text-2xl text-foreground/40">
                  {m.level}
                </span>
                <div>
                  <h3 className="font-display text-xl">{m.title}</h3>
                  <p className="mt-1 text-foreground/70">{m.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-foreground/10 bg-background/40 p-4 sm:p-6">
            <Image
              src="/platform/roadmap.svg"
              alt={t("title")}
              width={640}
              height={420}
              className="h-auto w-full"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
