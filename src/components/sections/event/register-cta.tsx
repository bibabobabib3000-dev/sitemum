"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface RegisterCtaProps {
  eventSlug: string;
  userId: string | null;
}

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "registered" }
  | { kind: "already" }
  | { kind: "needs-user" }
  | { kind: "error" };

export function RegisterCta({ eventSlug, userId }: RegisterCtaProps) {
  const t = useTranslations("event.live");
  const [state, setState] = useState<State>(
    userId ? { kind: "idle" } : { kind: "needs-user" }
  );

  async function onClick() {
    if (!userId) {
      setState({ kind: "needs-user" });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/event/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, userId }),
      });
      const json = (await res.json()) as
        | {
            ok: true;
            data: { alreadyRegistered: boolean };
          }
        | { ok: false; error: { code: string; message: string } };
      if (!res.ok || !json.ok) {
        setState({ kind: "error" });
        return;
      }
      setState({
        kind: json.data.alreadyRegistered ? "already" : "registered",
      });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "registered" || state.kind === "already") {
    return (
      <p className="text-base text-foreground/80">
        {state.kind === "registered" ? t("registered") : t("alreadyRegistered")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        onClick={onClick}
        disabled={state.kind === "submitting" || !userId}
      >
        {t("registerCta")}
      </Button>
      {state.kind === "needs-user" ? (
        <p className="max-w-md text-sm text-foreground/60">
          {t("registerNeedsUser")}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-red-300/90">
          {t("registerError")}
        </p>
      ) : null}
    </div>
  );
}
