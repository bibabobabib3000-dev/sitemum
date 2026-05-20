import Image from "next/image";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

export function CommandCenter() {
  const t = useTranslations("platform.commandCenter");
  const bullets = t.raw("bullets") as string[];

  return (
    <section className="border-t border-foreground/10 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground/50">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-lg text-foreground/70">{t("desc")}</p>
          <ul className="mt-8 space-y-4">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-4 text-foreground/80">
                <span className="mt-2 h-1 w-6 shrink-0 bg-foreground/40" />
                <span className="text-base sm:text-lg">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-foreground/10 via-transparent to-transparent" />
          <div className="rounded-3xl border border-foreground/10 bg-muted/40 p-4 sm:p-6">
            <Image
              src="/platform/command-center.svg"
              alt={t("imageAlt")}
              width={640}
              height={420}
              className="h-auto w-full"
              priority={false}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
