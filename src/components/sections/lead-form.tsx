"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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

export function LeadForm() {
  const t = useTranslations("form");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const data = new FormData(e.currentTarget);
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      telegram: String(data.get("telegram") ?? ""),
      productSlug: "level-0",
      locale,
      referer:
        typeof document !== "undefined" ? document.referrer || undefined : undefined,
      utm: readUtm(),
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | { ok: true; data: unknown }
        | { ok: false; error: { code: string; message: string } };
      if (!res.ok || !json.ok) {
        const msg = !json.ok ? json.error.message : t("error");
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }
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
            className="mt-10 rounded-3xl border border-foreground/20 bg-background/60 p-8 text-center text-lg"
          >
            {t("success")}
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
