import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared header for admin pages — keeps a consistent look across
 * overview, cases, users, etc. Title is mandatory, the eyebrow + description
 * are optional, and the right slot is for primary actions (filters,
 * "new" buttons, refresh).
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-foreground/10 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <span className="text-xs uppercase tracking-[0.18em] text-foreground/55">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-foreground/65">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
