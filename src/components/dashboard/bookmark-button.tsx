"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface BookmarkButtonProps {
  lessonId: string;
  initialBookmarked: boolean;
}

export function BookmarkButton({
  lessonId,
  initialBookmarked,
}: BookmarkButtonProps) {
  const t = useTranslations("bookmarks");
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (submitting) return;
    const next = !bookmarked;
    setBookmarked(next); // optimistic
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/lessons/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, bookmarked: next }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { bookmarked: boolean } }
        | { ok: false; error: { code: string; message: string } };
      if (!res.ok || !json.ok) {
        // Roll back optimism.
        setBookmarked(!next);
        setError(!json.ok ? json.error.message : t("error"));
        return;
      }
      setBookmarked(json.data.bookmarked);
    } catch {
      setBookmarked(!next);
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={submitting}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? t("remove") : t("add")}
        title={bookmarked ? t("remove") : t("add")}
        className={
          "inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs transition-colors " +
          (bookmarked
            ? "border-foreground bg-foreground/10 text-foreground"
            : "border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground")
        }
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          width="14"
          height="14"
          className="mr-1.5"
        >
          <path
            d="M4 2.5h8a.5.5 0 0 1 .5.5v10.382a.5.5 0 0 1-.74.44L8 11.667l-3.76 2.155a.5.5 0 0 1-.74-.44V3a.5.5 0 0 1 .5-.5Z"
            fill={bookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        {bookmarked ? t("statusOn") : t("statusOff")}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
