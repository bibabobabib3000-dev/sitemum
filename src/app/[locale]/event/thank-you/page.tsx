import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";

export default function ThankYouPage() {
  const t = useTranslations("thanks");
  return (
    <main className="flex min-h-[80vh] items-center">
      <Container className="max-w-2xl text-center">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-6 text-lg text-foreground/70">{t("body")}</p>
        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-full border border-foreground/20 px-6 text-sm text-foreground hover:border-foreground"
          >
            {t("home")}
          </Link>
        </div>
      </Container>
    </main>
  );
}
