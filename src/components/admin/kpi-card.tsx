import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Compact KPI card used on the admin overview grid. Designed to live in
 * a responsive grid (`grid-cols-2 lg:grid-cols-4`).
 *
 * Pass `value=null` to render the "no data" dash (we use this for metrics
 * whose underlying infrastructure isn't wired up yet — see PR E2 follow-up
 * for webhook errors).
 */
export function AdminKpiCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode | null;
  hint?: React.ReactNode;
  tone?: "default" | "alert" | "positive";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-3xl border bg-muted/30 p-5",
        tone === "alert" && "border-amber-500/30 bg-amber-500/5",
        tone === "positive" && "border-emerald-500/30 bg-emerald-500/5",
        tone === "default" && "border-foreground/10",
        className,
      )}
    >
      <span className="text-xs uppercase tracking-[0.16em] text-foreground/55">
        {label}
      </span>
      <span className="font-display text-3xl leading-none text-foreground sm:text-4xl">
        {value === null || value === undefined ? "—" : value}
      </span>
      {hint ? <span className="text-xs text-foreground/55">{hint}</span> : null}
    </div>
  );
}
