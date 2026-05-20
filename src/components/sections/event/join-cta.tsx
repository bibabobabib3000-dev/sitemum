"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface JoinCtaProps {
  joinUrl: string | null;
  startAtIso: string;
  endAtIso: string;
}

type Phase = "before" | "live" | "ended";

function currentPhase(startAtIso: string, endAtIso: string): Phase {
  const now = Date.now();
  const start = new Date(startAtIso).getTime();
  const end = new Date(endAtIso).getTime();
  if (now < start) return "before";
  if (now > end) return "ended";
  return "live";
}

export function JoinCta({ joinUrl, startAtIso, endAtIso }: JoinCtaProps) {
  const t = useTranslations("event.live");
  const [phase, setPhase] = useState<Phase>(() =>
    currentPhase(startAtIso, endAtIso)
  );

  useEffect(() => {
    function tick() {
      setPhase(currentPhase(startAtIso, endAtIso));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startAtIso, endAtIso]);

  if (phase !== "live") return null;
  if (!joinUrl) return null;

  return (
    <a href={joinUrl} target="_blank" rel="noopener noreferrer">
      <Button size="lg" className="gap-2">
        {t("joinCta")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </a>
  );
}
