"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type FbqFn = (
  command: "track" | "trackCustom",
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type UtmKeys = "source" | "medium" | "campaign" | "content" | "term";

function readUtm(): Partial<Record<UtmKeys, string>> {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  const out: Partial<Record<UtmKeys, string>> = {};
  (["source", "medium", "campaign", "content", "term"] as UtmKeys[]).forEach(
    (k) => {
      const v = sp.get(`utm_${k}`);
      if (v) out[k] = v.slice(0, 200);
    }
  );
  return out;
}

const TG_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

function buildBotDeepLink(userId: string | null): string {
  const bot = TG_BOT.replace(/^@+/, "");
  if (!bot) return "https://t.me";
  const base = `https://t.me/${bot}`;
  return userId ? `${base}?start=lead_${userId}` : base;
}

export function LeadForm() {
  const t = useTranslations("form");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const data = new FormData(e.currentTarget);
    const eventId = newEventId();
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      telegram: String(data.get("telegram") ?? ""),
      productSlug: "level-0",
      locale,
      referer:
        typeof document !== "undefined" ? document.referrer || undefined : undefined,
      utm: readUtm(),
      eventId,
    };

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      try {
        window.fbq(
          "track",
          "Lead",
          { content_name: payload.productSlug },
          { eventID: eventId }
        );
      } catch (err) {
        console.warn("[pixel:lead_track_failed]", err);
      }
    }

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | {
            ok: true;
            data: { stored: boolean; userId: string | null; mode: "db" | "stub" };
          }
        | { ok: false; error: { code: string; message: string } };
      if (!res.ok || !json.ok) {
        const msg = !json.ok ? json.error.message : t("error");
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }
      setUserId(json.data.userId);
      setDone(true);
    } catch {
      setErrorMsg(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="form"
      className="border-t border-foreground/10 bg-muted/30 py-20 sm:py-28"
    >
      <Container className="max-w-2xl">
        <div className="text-center">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-foreground/70">{t("subtitle")}</p>
        </div>

        {done ? (
          <div
            role="status"
            className="mt-10 rounded-3xl border border-foreground/20 bg-background/60 p-8 text-center"
          >
            <p className="text-lg">{t("success")}</p>
            {TG_BOT ? (
              <>
                <p className="mt-4 text-sm text-foreground/70">
                  {t("botHint")}
                </p>
                <a
                  href={buildBotDeepLink(userId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-12 items-center rounded-full border border-foreground/40 bg-foreground/5 px-6 text-sm text-foreground hover:border-foreground hover:bg-foreground/10"
                >
                  {t("botCta")}
                </a>
              </>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-10 grid gap-4 rounded-3xl border border-foreground/10 bg-background/60 p-6 sm:p-8"
          >
            <Field name="name" label={t("name")} type="text" required />
            <Field name="email" label={t("email")} type="email" required />
            <Field
              name="telegram"
              label={t("telegram")}
              type="text"
              placeholder="@username"
              required
            />
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
            {errorMsg ? (
              <p
                role="alert"
                className="text-sm text-red-300/90"
              >
                {errorMsg}
              </p>
            ) : (
              <p className="text-xs text-foreground/50">{t("soon")}</p>
            )}
          </form>
        )}
      </Container>
    </section>
  );
}

function Field({
  name,
  label,
  type,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-foreground/70">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="h-12 rounded-full border border-foreground/20 bg-background px-5 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
      />
    </label>
  );
}
