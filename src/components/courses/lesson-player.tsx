"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface LessonPlayerProps {
  lessonId: string;
  locale: "uk" | "ru";
}

type SignResult =
  | { kind: "loading" }
  | { kind: "error"; code: string; message: string }
  | { kind: "noMedia" }
  | { kind: "ready"; videoUrl: string; audioUrl: string | null };

export function LessonPlayer({ lessonId }: LessonPlayerProps) {
  const t = useTranslations("lesson.player");
  const [state, setState] = useState<SignResult>({ kind: "loading" });

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonId}/sign`, {
          cache: "no-store",
        });
        const json = (await res.json()) as
          | {
              ok: true;
              data: {
                videoUrl: string | null;
                audioUrl?: string | null;
                ttlSec?: number;
              };
            }
          | { ok: false; error: { code: string; message: string } };
        if (aborted) return;
        if (!json.ok) {
          setState({
            kind: "error",
            code: json.error.code,
            message: json.error.message,
          });
          return;
        }
        if (!json.data.videoUrl) {
          setState({ kind: "noMedia" });
          return;
        }
        setState({
          kind: "ready",
          videoUrl: json.data.videoUrl,
          audioUrl: json.data.audioUrl ?? null,
        });
      } catch (err) {
        if (aborted) return;
        setState({
          kind: "error",
          code: "network",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      aborted = true;
    };
  }, [lessonId]);

  if (state.kind === "loading") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-foreground/15 bg-muted/30 text-xs uppercase tracking-widest text-foreground/55">
        {t("loading")}
      </div>
    );
  }
  if (state.kind === "noMedia") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-foreground/15 bg-muted/30 text-sm text-foreground/55">
        {t("noMedia")}
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-red-300/30 bg-red-500/5 px-6 text-center text-sm text-red-200">
        {t("error")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-black">
      <video
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full"
        src={state.videoUrl}
      />
      {state.audioUrl ? (
        <div className="border-t border-foreground/10 bg-muted/20 px-4 py-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-foreground/55">
            {t("audioFallback")}
          </p>
          <audio controls className="w-full" src={state.audioUrl} />
        </div>
      ) : null}
    </div>
  );
}
