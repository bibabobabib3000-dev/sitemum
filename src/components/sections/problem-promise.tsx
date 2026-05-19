import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

export function ProblemPromise() {
  const tProblem = useTranslations("problem");
  const tPromise = useTranslations("promise");

  const problems = tProblem.raw("items") as string[];
  const promises = tPromise.raw("items") as string[];

  return (
    <section className="border-y border-foreground/10 bg-muted/30 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">
            {tProblem("title")}
          </h2>
          <ul className="mt-8 space-y-4">
            {problems.map((item, i) => (
              <li key={i} className="flex gap-4 text-foreground/80">
                <span className="mt-2 h-1 w-6 shrink-0 bg-foreground/40" />
                <span className="text-base sm:text-lg">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">
            {tPromise("title")}
          </h2>
          <ul className="mt-8 space-y-4">
            {promises.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border border-foreground/10 bg-background/40 p-5 text-base sm:text-lg"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
