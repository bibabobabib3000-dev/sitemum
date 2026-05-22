"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface LessonNotesProps {
  lessonId: string;
  initialBody: string;
  initialUpdatedAt: string | null;
}

type Mode = "edit" | "preview";
type Status = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const MAX_LEN = 20_000;

/**
 * Tiny markdown renderer — paragraphs, ##/### headings, simple emphasis.
 * Kept inline so we don't pull in a markdown library; the lesson body
 * uses the same approach (see [lessonSlug]/page.tsx renderMarkdown).
 */
function renderMarkdown(md: string): string {
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const inline = (s: string) =>
    s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  const blocks = esc.split(/\n{2,}/);
  return blocks
    .map((p) => {
      if (/^###\s+/.test(p)) {
        return `<h3 class="mt-4 font-display text-base">${inline(
          p.replace(/^###\s+/, ""),
        )}</h3>`;
      }
      if (/^##\s+/.test(p)) {
        return `<h2 class="mt-5 font-display text-lg">${inline(
          p.replace(/^##\s+/, ""),
        )}</h2>`;
      }
      if (/^- /m.test(p)) {
        const items = p
          .split(/\n/)
          .filter((l) => /^- /.test(l))
          .map((l) => `<li>${inline(l.replace(/^- /, ""))}</li>`)
          .join("");
        return `<ul class="mt-3 ml-5 list-disc space-y-1 text-sm text-foreground/80">${items}</ul>`;
      }
      return `<p class="mt-3 text-sm leading-relaxed text-foreground/80 whitespace-pre-line">${inline(p)}</p>`;
    })
    .join("");
}

function fmtTime(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function LessonNotes({
  lessonId,
  initialBody,
  initialUpdatedAt,
}: LessonNotesProps) {
  const t = useTranslations("notes");
  const [body, setBody] = useState(initialBody);
  const [mode, setMode] = useState<Mode>("edit");
  const [status, setStatus] = useState<Status>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );
  const [error, setError] = useState<string | null>(null);

  const editorId = useId();
  const lastSavedBodyRef = useRef(initialBody);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const flush = useCallback(
    async (payload: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setStatus("saving");
      try {
        const res = await fetch("/api/lessons/notes/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, bodyMd: payload }),
        });
        const json = (await res.json()) as
          | {
              ok: true;
              data: {
                note: { lessonId: string; bodyMd: string; updatedAt: string } | null;
              };
            }
          | { ok: false; error: { code: string; message: string } };
        if (!res.ok || !json.ok) {
          setError(!json.ok ? json.error.message : t("error"));
          setStatus("error");
          return;
        }
        lastSavedBodyRef.current = payload;
        setStatus("saved");
        if (json.data.note) {
          setLastSavedAt(new Date(json.data.note.updatedAt));
        } else {
          setLastSavedAt(new Date());
        }
        setError(null);
      } catch {
        setError(t("error"));
        setStatus("error");
      } finally {
        inFlightRef.current = false;
      }
    },
    [lessonId, t],
  );

  // Debounced autosave: every change pushes the timer out by 1500ms;
  // when it fires we POST the current body. We also fire on unmount and
  // on visibility change so a tab-close doesn't lose the buffer.
  useEffect(() => {
    if (body === lastSavedBodyRef.current) {
      setStatus("idle");
      return;
    }
    setStatus("dirty");
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void flush(body);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [body, flush]);

  useEffect(() => {
    function onHide() {
      if (
        document.visibilityState === "hidden" &&
        body !== lastSavedBodyRef.current
      ) {
        void flush(body);
      }
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [body, flush]);

  const locale =
    typeof document !== "undefined"
      ? document.documentElement.lang || "uk"
      : "uk";

  const remaining = MAX_LEN - body.length;

  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground/55">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 font-display text-xl">{t("title")}</h2>
        </div>
        <div
          className="inline-flex rounded-full border border-foreground/15 bg-background/50 p-1 text-xs"
          role="tablist"
          aria-label={t("modeAria")}
        >
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={
                "rounded-full px-3 py-1 transition-colors " +
                (mode === m
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/60 hover:text-foreground")
              }
            >
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>
      </header>

      {mode === "edit" ? (
        <label htmlFor={editorId} className="sr-only">
          {t("editorAria")}
        </label>
      ) : null}
      {mode === "edit" ? (
        <textarea
          id={editorId}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
          maxLength={MAX_LEN}
          placeholder={t("placeholder")}
          className="mt-5 min-h-[220px] w-full resize-y rounded-2xl border border-foreground/15 bg-background/60 px-4 py-3 font-mono text-sm text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
        />
      ) : (
        <div
          className="mt-5 min-h-[220px] rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3"
          aria-label={t("previewAria")}
        >
          {body.trim() === "" ? (
            <p className="text-sm text-foreground/45">{t("emptyPreview")}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/55">
        <span aria-live="polite">
          {status === "saving" ? (
            t("status.saving")
          ) : status === "dirty" ? (
            t("status.dirty")
          ) : status === "error" ? (
            <span className="text-red-300">{error ?? t("status.error")}</span>
          ) : lastSavedAt ? (
            t("status.savedAt", { time: fmtTime(lastSavedAt, locale) })
          ) : (
            t("status.idle")
          )}
        </span>
        <span>{t("remaining", { count: remaining })}</span>
      </footer>
    </section>
  );
}
