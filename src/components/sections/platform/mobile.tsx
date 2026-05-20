import Image from "next/image";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

export function MobilePwa() {
  const t = useTranslations("platform.mobile");
  const bullets = t.raw("bullets") as string[];

  return (
    <section className="border-t border-foreground/10 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16 lg:items-center">
        <div className="order-2 flex justify-center lg:order-1">
          <div className="relative w-full max-w-[320px]">
            <div className="absolute inset-0 -z-10 rounded-[36px] bg-gradient-to-br from-foreground/10 via-transparent to-transparent" />
            <Image
              src="/platform/mobile.svg"
              alt={t("imageAlt")}
              width={360}
              height={600}
              className="h-auto w-full"
            />
          </div>
        </div>

        <div className="order-1 lg:order-2">
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
      </Container>
    </section>
  );
}
