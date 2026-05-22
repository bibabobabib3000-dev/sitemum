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
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(
    initialStatusToMessage(initialStatus, t)
  );

  async function requestLink(email: string) {
    const res = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });
    return (await res.json()) as
      | { ok: true; data: { sent: boolean; reason?: string } }
      | { ok: false; error: { code: string; message: string } };
  }

  function startResendCooldown() {
    setResendCooldown(30);
    const handle = window.setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          window.clearInterval(handle);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();

    try {
      const json = await requestLink(email);
      if (!json.ok) {
        setError(json.error.message || t("error"));
        setSubmitting(false);
        return;
      }
      // We intentionally do not reveal why nothing was sent (no DB, no
      // Resend, send failure). Show the same "check your inbox" message so
      // we never disclose whether an email exists in our system.
      setLastEmail(email);
      setSent(true);
      startResendCooldown();
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!lastEmail || resendCooldown > 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const json = await requestLink(lastEmail);
      if (!json.ok) {
        setError(json.error.message || t("error"));
        return;
      }
      startResendCooldown();
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-foreground/15 bg-background/50 p-5 text-sm text-foreground/85">
          <p>
            {t.rich("sentTo", {
              email: lastEmail ?? "",
              strong: (chunks) => (
                <strong className="text-foreground">{chunks}</strong>
              ),
            })}
          </p>
          <p className="mt-2 text-foreground/70">{t("sent")}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-foreground/65">
          <button
            type="button"
            onClick={onResend}
            disabled={resendCooldown > 0 || submitting}
            className="underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:decoration-foreground/40"
          >
            {resendCooldown > 0
              ? t("resendIn", { seconds: resendCooldown })
              : submitting
                ? t("submitting")
                : t("resend")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
            className="underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
          >
            {t("changeEmail")}
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}
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
    case "banned":
      return t("statusBanned");
    default:
      return null;
  }
}
