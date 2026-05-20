"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface CaseStudyFormProps {
  initialBody: string;
  initialVideoUrl: string;
  /** When true the form sits in re-edit mode (resubmission). */
  isResubmit: boolean;
}

const MIN_BODY = 200;
const MAX_BODY = 20000;

interface SubmitResponse {
  ok: true;
  data: { submittedAt: string; approved: boolean };
}
interface SubmitError {
  ok: false;
  error: { code: string; message: string };
}

export function CaseStudyForm({
  initialBody,
  initialVideoUrl,
  isResubmit,
}: CaseStudyFormProps) {
  const t = useTranslations("dashboard.caseStudy.form");

  const [body, setBody] = useState(initialBody);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = body.trim().length < MIN_BODY;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/case-study/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          videoUrl: videoUrl.trim() || null,
        }),
      });
      const json = (await res.json()) as SubmitResponse | SubmitError;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-6">
        <p className="text-sm text-emerald-200">{t("submitted")}</p>
        <p className="mt-2 text-xs text-emerald-200/70">
          {t("submittedSub")}
        </p>
      </div>
    );
  }

  const bodyLen = body.trim().length;
  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <label className="grid gap-2">
        <span className="text-xs uppercase tracking-widest text-foreground/55">
          {t("bodyLabel")}
        </span>
        <textarea
          required
          minLength={MIN_BODY}
          maxLength={MAX_BODY}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="rounded-2xl border border-foreground/15 bg-background/60 p-4 text-sm leading-relaxed text-foreground outline-none placeholder:text-foreground/40 focus:border-foreground/35"
          placeholder={t("bodyPlaceholder")}
        />
        <span
          className={
            "text-xs " +
            (tooShort ? "text-foreground/55" : "text-emerald-300/80")
          }
        >
          {t("bodyCounter", { count: bodyLen, min: MIN_BODY })}
        </span>
      </label>

      <label className="grid gap-2">
        <span className="text-xs uppercase tracking-widest text-foreground/55">
          {t("videoLabel")}
        </span>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          maxLength={500}
          placeholder="https://"
          className="rounded-2xl border border-foreground/15 bg-background/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:border-foreground/35"
        />
        <span className="text-xs text-foreground/50">{t("videoHint")}</span>
      </label>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-foreground/45">
          {isResubmit ? t("resubmitHint") : t("firstHint")}
        </p>
        <Button
          type="submit"
          disabled={submitting || tooShort}
          className="shrink-0"
        >
          {submitting ? t("submitting") : isResubmit ? t("resubmit") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
