import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";

const TG_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

function buildBotDeepLink(userId: string | null): string {
  const bot = TG_BOT.replace(/^@+/, "");
  if (!bot) return "https://t.me";
  const base = `https://t.me/${bot}`;
  return userId ? `${base}?start=lead_${userId}` : base;
}

interface ThankYouPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ThankYouPage({ searchParams }: ThankYouPageProps) {
  const params = await searchParams;
  const raw = params?.u;
  const userId = typeof raw === "string" && raw.length > 0 ? raw : null;
  return <ThankYouView userId={userId} />;
}

function ThankYouView({ userId }: { userId: string | null }) {
  const t = useTranslations("thanks");
  const botHref = buildBotDeepLink(userId);
  return (
    <main className="flex min-h-[80vh] items-center">
      <Container className="max-w-2xl text-center">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-6 text-lg text-foreground/70">{t("body")}</p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {TG_BOT ? (
            <a
              href={botHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center rounded-full border border-foreground/40 bg-foreground/5 px-6 text-sm text-foreground hover:border-foreground hover:bg-foreground/10"
            >
              {t("botCta")}
            </a>
          ) : null}
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
