"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export interface AccountFormInitial {
  displayName: string | null;
  bio: string | null;
  locale: "uk" | "ru";
  tz: string | null;
  notificationPrefs: {
    email: boolean;
    telegram: boolean;
    in_app: boolean;
  };
  themePref: "system" | "dark" | "light";
}

interface AccountFormProps {
  locale: "uk" | "ru";
  initial: AccountFormInitial;
}

const THEME_OPTIONS: AccountFormInitial["themePref"][] = ["system", "dark", "light"];
const LOCALE_OPTIONS: AccountFormInitial["locale"][] = ["uk", "ru"];

// Browsers that don't expose `Intl.supportedValuesOf` still get a small,
// curated fallback list so the dropdown is never empty.
const TZ_FALLBACK = [
  "UTC",
  "Europe/Kyiv",
  "Europe/Warsaw",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Lisbon",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tbilisi",
  "Asia/Dubai",
];

function listTimeZones(): string[] {
  type IntlWithTz = typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const intl = Intl as IntlWithTz;
  if (typeof intl.supportedValuesOf === "function") {
    try {
      const all = intl.supportedValuesOf("timeZone");
      if (Array.isArray(all) && all.length > 0) return all;
    } catch {
      /* fall through */
    }
  }
  return TZ_FALLBACK;
}

export function AccountForm({ locale, initial }: AccountFormProps) {
  const t = useTranslations("account.form");

  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [localeValue, setLocaleValue] = useState<"uk" | "ru">(initial.locale);
  const [tz, setTz] = useState(initial.tz ?? "");
  const [prefs, setPrefs] = useState(initial.notificationPrefs);
  const [themePref, setThemePref] = useState(initial.themePref);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const tzOptions = useMemo(listTimeZones, []);
  const formId = useId();

  function togglePref(key: keyof AccountFormInitial["notificationPrefs"]) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      display_name: displayName.trim() === "" ? null : displayName.trim(),
      bio: bio.trim() === "" ? null : bio,
      locale: localeValue,
      tz: tz === "" ? null : tz,
      notification_prefs: prefs,
      theme_pref: themePref,
    };

    try {
      const res = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | { ok: true; data: unknown }
        | { ok: false; error: { code: string; message: string } };
      if (!res.ok || !json.ok) {
        setError(!json.ok ? json.error.message : t("error"));
        setSubmitting(false);
        return;
      }
      setSavedAt(Date.now());
      // When the locale changed, the rest of the app needs to pick up the
      // new translations. A hard reload also re-renders `<html lang>` from
      // the new cookie/account value.
      if (localeValue !== locale) {
        window.location.assign(`/${localeValue}/account?status=saved`);
        return;
      }
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="grid gap-7">
      <label className="grid gap-2 text-sm">
        <span className="text-foreground/70">{t("displayName.label")}</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={120}
          placeholder={t("displayName.placeholder")}
          className="h-12 rounded-2xl border border-foreground/20 bg-background/60 px-4 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
        />
        <span className="text-xs text-foreground/55">{t("displayName.hint")}</span>
      </label>

      <label className="grid gap-2 text-sm">
        <span className="text-foreground/70">{t("bio.label")}</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder={t("bio.placeholder")}
          className="min-h-[120px] resize-y rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
        />
        <span className="text-xs text-foreground/55">
          {t("bio.hint", { remaining: 500 - bio.length })}
        </span>
      </label>

      <div className="grid gap-2 text-sm">
        <span className="text-foreground/70">{t("locale.label")}</span>
        <div className="grid grid-cols-2 gap-3">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLocaleValue(opt)}
              className={
                "h-12 rounded-2xl border px-4 text-sm transition-colors " +
                (localeValue === opt
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-foreground/20 text-foreground/70 hover:border-foreground/40")
              }
              aria-pressed={localeValue === opt}
            >
              {t(`locale.options.${opt}`)}
            </button>
          ))}
        </div>
        <span className="text-xs text-foreground/55">{t("locale.hint")}</span>
      </div>

      <label className="grid gap-2 text-sm">
        <span className="text-foreground/70">{t("tz.label")}</span>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="h-12 rounded-2xl border border-foreground/20 bg-background/60 px-4 text-base text-foreground focus:border-foreground focus:outline-none"
        >
          <option value="">{t("tz.unset")}</option>
          {tzOptions.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <span className="text-xs text-foreground/55">{t("tz.hint")}</span>
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-sm text-foreground/70">
          {t("notifications.label")}
        </legend>
        <div className="grid gap-2">
          {(["email", "telegram", "in_app"] as const).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-foreground/15 bg-background/40 px-4 py-3 text-sm"
            >
              <span>
                <span className="block text-foreground">
                  {t(`notifications.channels.${key}.label`)}
                </span>
                <span className="block text-xs text-foreground/55">
                  {t(`notifications.channels.${key}.hint`)}
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                className="h-5 w-5 rounded border-foreground/30 bg-background text-foreground"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2 text-sm">
        <span className="text-foreground/70">{t("theme.label")}</span>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setThemePref(opt)}
              className={
                "h-12 rounded-2xl border px-3 text-sm transition-colors " +
                (themePref === opt
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-foreground/20 text-foreground/70 hover:border-foreground/40")
              }
              aria-pressed={themePref === opt}
            >
              {t(`theme.options.${opt}`)}
            </button>
          ))}
        </div>
        <span className="text-xs text-foreground/55">{t("theme.hint")}</span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {savedAt !== null ? (
        <p role="status" className="text-sm text-emerald-300">
          {t("saved")}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
