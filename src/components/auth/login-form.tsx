"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface LoginFormProps {
  locale: "uk" | "ru";
  initialStatus: string | null;
}

export function LoginForm({ locale, initialStatus }: LoginFormProps) {
  const t = useTranslations("login");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    initialStatusToMessage(initialStatus, t)
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();

    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { sent: boolean; reason?: string } }
        | { ok: false; error: { code: string; message: string } };

      if (!res.ok || !json.ok) {
        const msg = !json.ok ? json.error.message : t("error");
        setError(msg);
        setSubmitting(false);
        return;
      }
      if (!json.data.sent) {
        // We intentionally do not reveal why nothing was sent (no DB, no
        // Resend, send failure). Show the same "check your inbox" message so
        // we never disclose whether an email exists in our system.
        setSent(true);
        return;
      }
      setSent(true);
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-foreground/15 bg-background/50 p-5 text-sm text-foreground/80">
        {t("sent")}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span className="text-foreground/70">{t("email")}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className="h-12 rounded-2xl border border-foreground/20 bg-background/60 px-4 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? t("submitting") : t("submit")}
      </Button>
      <p className="text-xs text-foreground/50">{t("disclaimer")}</p>
    </form>
  );
}

function initialStatusToMessage(
  status: string | null,
  t: ReturnType<typeof useTranslations>
): string | null {
  if (!status) return null;
  switch (status) {
    case "expired":
      return t("statusExpired");
    case "missing":
      return t("statusMissing");
    case "disabled":
      return t("statusDisabled");
    default:
      return null;
  }
}
