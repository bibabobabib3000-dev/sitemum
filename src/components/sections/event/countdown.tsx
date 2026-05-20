"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Parts {
  d: number;
  h: number;
  m: number;
  s: number;
}

function computeParts(targetIso: string): Parts | "live" | "ended" {
  const now = Date.now();
  const target = new Date(targetIso).getTime();
  const diff = target - now;
  if (diff <= 0) return "live";
  const totalSeconds = Math.floor(diff / 1000);
  const d = Math.floor(totalSeconds / 86_400);
  const h = Math.floor((totalSeconds % 86_400) / 3_600);
  const m = Math.floor((totalSeconds % 3_600) / 60);
  const s = totalSeconds % 60;
  return { d, h, m, s };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

interface CountdownProps {
  startAtIso: string;
  endAtIso: string;
}

export function EventCountdown({ startAtIso, endAtIso }: CountdownProps) {
  const t = useTranslations("event.live");
  const [parts, setParts] = useState<Parts | "live" | "ended">(() =>
    computeParts(startAtIso)
  );

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const end = new Date(endAtIso).getTime();
      if (now > end) {
        setParts("ended");
        return;
      }
      setParts(computeParts(startAtIso));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startAtIso, endAtIso]);

  if (parts === "live") {
    return (
      <p className="inline-flex items-center gap-2 rounded-full border border-foreground/30 px-4 py-2 text-sm uppercase tracking-widest">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        {t("live")}
      </p>
    );
  }

  if (parts === "ended") {
    return (
      <p className="text-base text-foreground/60">{t("endedBody")}</p>
    );
  }

  const labels = {
    days: t("countdownLabels.days"),
    hours: t("countdownLabels.hours"),
    minutes: t("countdownLabels.minutes"),
    seconds: t("countdownLabels.seconds"),
  };

  return (
    <div
      role="timer"
      aria-live="polite"
      className="grid grid-cols-4 gap-3 sm:gap-6"
    >
      <Cell value={parts.d} label={labels.days} />
      <Cell value={parts.h} label={labels.hours} pad />
      <Cell value={parts.m} label={labels.minutes} pad />
      <Cell value={parts.s} label={labels.seconds} pad />
    </div>
  );
}

function Cell({
  value,
  label,
  pad: padded,
}: {
  value: number;
  label: string;
  pad?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-foreground/10 bg-muted/40 px-2 py-4 sm:px-4 sm:py-5">
      <span className="font-display text-4xl leading-none tabular-nums sm:text-5xl">
        {padded ? pad(value) : value}
      </span>
      <span className="text-xs uppercase tracking-widest text-foreground/55">
        {label}
      </span>
    </div>
  );
}
