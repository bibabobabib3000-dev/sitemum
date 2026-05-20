import { Check, Lock } from "lucide-react";
import type { Milestone, MilestoneState } from "@/lib/courses/roadmap-state";

interface RoadmapTimelineProps {
  milestones: TimelineMilestone[];
  labels: {
    locked: string;
    active: string;
    done: string;
    progressOf: string;
    homework: string;
  };
  locale: "uk" | "ru";
}

/**
 * Page-shaped milestone: same data as `Milestone` from
 * `@/lib/courses/roadmap-state` but `title` is already localized.
 */
export interface TimelineMilestone extends Omit<Milestone, "title"> {
  title: string;
}

const NODE_STYLES: Record<MilestoneState, string> = {
  done: "bg-emerald-300 text-background border-emerald-300",
  active: "bg-foreground text-background border-foreground",
  locked: "bg-background text-foreground/40 border-foreground/20",
};

const LINE_STYLES: Record<MilestoneState, string> = {
  done: "bg-emerald-300/70",
  active: "bg-foreground/60",
  locked: "bg-foreground/15",
};

function formatDate(d: Date, locale: "uk" | "ru"): string {
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "uk-UA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function RoadmapTimeline({ milestones, labels, locale }: RoadmapTimelineProps) {
  return (
    <div className="mt-10">
      {/* Horizontal track — collapses to a vertical list under sm. */}
      <ol className="relative grid gap-8 sm:grid-cols-3 sm:gap-0">
        {milestones.map((m, idx) => {
          const next = milestones[idx + 1];
          // The connector to the next node takes the colour of the *current*
          // milestone — once it's done, the path "lights up" to the next.
          const lineState: MilestoneState = m.state === "done" ? "done" : "locked";
          return (
            <li key={m.id} className="relative flex flex-col items-center text-center">
              {idx < milestones.length - 1 && (
                <span
                  aria-hidden="true"
                  className={
                    "absolute left-1/2 top-6 hidden h-px w-full sm:block " +
                    LINE_STYLES[lineState]
                  }
                />
              )}
              <span
                className={
                  "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 " +
                  NODE_STYLES[m.state]
                }
                aria-hidden="true"
              >
                {m.state === "done" ? (
                  <Check className="h-5 w-5" />
                ) : m.state === "locked" ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <span className="font-display text-sm">{idx + 1}</span>
                )}
              </span>
              <p className="mt-4 font-display text-lg leading-tight">{m.title}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-foreground/55">
                {labels[m.state]}
              </p>
              {m.date && m.state !== "locked" ? (
                <p className="mt-1 text-xs text-foreground/45">{formatDate(m.date, locale)}</p>
              ) : null}
              {m.lessonsTotal > 0 && m.state !== "locked" ? (
                <p className="mt-3 text-xs text-foreground/55">
                  {labels.progressOf
                    .replace("{done}", String(Math.min(m.lessonsUnlocked, m.lessonsTotal)))
                    .replace("{total}", String(m.lessonsTotal))}
                </p>
              ) : null}
              {m.lessonsTotal > 0 && m.state !== "locked" && next ? (
                <p className="mt-1 text-xs text-foreground/45">
                  {labels.homework
                    .replace("{done}", String(m.homeworkDone))
                    .replace("{total}", String(m.lessonsTotal))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
