import { cn } from "@/lib/utils";

export function Stat({
  value,
  caption,
  className,
}: {
  value: string;
  caption: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-foreground/10 bg-muted/40 p-7",
        className
      )}
    >
      <span className="font-display text-5xl leading-none sm:text-6xl">
        {value}
      </span>
      <span className="text-sm text-foreground/70 sm:text-base">{caption}</span>
    </div>
  );
}
