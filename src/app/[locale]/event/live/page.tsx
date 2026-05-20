import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { SiteNav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EventCountdown } from "@/components/sections/event/countdown";
import { JoinCta } from "@/components/sections/event/join-cta";
import { RegisterCta } from "@/components/sections/event/register-cta";
import { getEventBySlug, type EventRow } from "@/lib/events/repo";
import { isDbConfigured } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "event.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickUserId(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;
  return UUID_RE.test(raw) ? raw : null;
}

function pickSlug(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;
  return /^[a-z0-9-]{1,64}$/.test(raw) ? raw : null;
}

function endIso(event: EventRow): string {
  const start = new Date(event.startAt).getTime();
  return new Date(start + event.durationMin * 60_000).toISOString();
}

function formatStartUtc(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default async function EventLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const slug = pickSlug(sp?.slug) ?? "immersion-w5";
  const userId = pickUserId(sp?.u);

  const event = isDbConfigured() ? await getEventBySlug(slug) : null;

  return (
    <>
      <SiteNav />
      <main>
        {event ? (
          <LiveSection event={event} userId={userId} locale={locale} />
        ) : (
          <NotFoundSection locale={locale} />
        )}
      </main>
      <Footer />
    </>
  );
}

async function LiveSection({
  event,
  userId,
  locale,
}: {
  event: EventRow;
  userId: string | null;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "event.live" });
  const startAt = event.startAt;
  const endAt = endIso(event);
  const topic =
    locale === "ru" && event.topicRu ? event.topicRu : event.topicUk;

  return (
    <section className="pt-32 pb-24 sm:pt-40">
      <Container className="flex max-w-4xl flex-col gap-10">
        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 text-xs uppercase tracking-widest text-foreground/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            {t("eyebrow")}
          </span>
          <h1 className="font-display text-balance text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            {topic}
          </h1>
          <p className="max-w-2xl text-balance text-foreground/70 sm:text-lg">
            {t("subtitle")}
          </p>
        </div>

        <EventCountdown startAtIso={startAt} endAtIso={endAt} />

        <div className="grid gap-3 text-sm text-foreground/65 sm:grid-cols-2">
          <Meta label={t("starts")} value={formatStartUtc(startAt)} />
          <Meta
            label={t("duration")}
            value={`${event.durationMin} ${t("minutesShort")}`}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <JoinCta
            joinUrl={event.zoomJoinUrl}
            startAtIso={startAt}
            endAtIso={endAt}
          />
          <RegisterCta eventSlug={event.slug} userId={userId} />
        </div>
      </Container>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-muted/40 px-5 py-4">
      <p className="text-xs uppercase tracking-widest text-foreground/50">
        {label}
      </p>
      <p className="mt-1 text-base text-foreground">{value}</p>
    </div>
  );
}

async function NotFoundSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "event.notFound" });
  return (
    <section className="flex min-h-[70vh] items-center pt-24">
      <Container className="flex max-w-xl flex-col items-start gap-6">
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-foreground/70">{t("body")}</p>
        <Link href="/">
          <Button size="lg">{t("cta")}</Button>
        </Link>
      </Container>
    </section>
  );
}
