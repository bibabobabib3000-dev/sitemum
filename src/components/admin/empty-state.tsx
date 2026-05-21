import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Neutral empty-state surface — used wherever an admin list / data-table
 * has nothing to show yet. Kept intentionally bland (no illustration) so
 * we can drop in lottie/svg art later (planned for PR C4).
 */
export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-dashed border-foreground/15 bg-muted/20 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="font-display text-xl">{title}</div>
      {description ? (
        <p className="max-w-md text-sm text-foreground/65">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
