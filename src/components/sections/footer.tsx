import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-foreground/10 py-12">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-2xl tracking-tight">RESOUL</div>
          <p className="mt-1 text-sm text-foreground/60">{t("tagline")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/70">
          <a href="#" className="hover:text-foreground">
            {t("links.offer")}
          </a>
          <a href="#" className="hover:text-foreground">
            {t("links.privacy")}
          </a>
          <a href="#" className="hover:text-foreground">
            {t("links.contact")}
          </a>
        </nav>
      </Container>
      <Container className="mt-8 text-xs text-foreground/40">
        {t("rights", { year })}
      </Container>
    </footer>
  );
}
