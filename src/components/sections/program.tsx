import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

type Day = {
  day: string;
  title: string;
  desc: string;
  duration: string;
};

export function Program() {
  const t = useTranslations("program");
  const days = t.raw("days") as Day[];

  return (
    <section id="program" className="border-t border-foreground/10 py-20 sm:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs uppercase tracking-widest text-foreground/50">
              02
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              {t("title")}
            </h2>
            <p className="mt-5 text-lg text-foreground/70">{t("subtitle")}</p>
          </div>

          <ol className="space-y-4">
            {days.map((d, i) => (
              <li
                key={i}
                className="group rounded-3xl border border-foreground/10 p-6 transition-colors hover:border-foreground/30 sm:p-8"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-4">
                    <span className="font-display text-3xl text-foreground/30 sm:text-4xl">
                      D{i + 1}
                    </span>
                    <h3 className="font-display text-2xl sm:text-3xl">
                      {d.title}
                    </h3>
                  </div>
                  <span className="text-xs uppercase tracking-widest text-foreground/50">
                    {d.duration}
                  </span>
                </div>
                <p className="mt-4 max-w-2xl text-foreground/70">{d.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
