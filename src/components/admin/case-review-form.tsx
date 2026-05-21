"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";

export interface CaseReviewFormCopy {
  notesLabel: string;
  notesPlaceholder: string;
  notesHelp: string;
  approve: string;
  reject: string;
  submitting: string;
  emailDelivered: string;
  emailFailed: string;
  tgDelivered: string;
  tgFailed: string;
  successApprove: string;
  successReject: string;
  errorGeneric: string;
  alreadyApproved: string;
}

export interface CaseReviewFormProps {
  userId: string;
  /** Current approved state — used to pre-fill the form + show "already approved" hint. */
  approved: boolean;
  /** Existing private review note from a prior decision. */
  defaultNotes: string;
  copy: CaseReviewFormCopy;
}

interface NotifyChannel {
  sent: boolean;
  error?: string;
}

interface ApiOk {
  ok: true;
  data: {
    approved: boolean;
    approvedAt: string | null;
    notify: { email: NotifyChannel; telegram: NotifyChannel };
  };
}

interface ApiErr {
  ok: false;
  error: { code: string; message: string };
}

type ApiResponse = ApiOk | ApiErr;

interface ResultState {
  approved: boolean;
  email: NotifyChannel;
  telegram: NotifyChannel;
}

export function CaseReviewForm({
  userId,
  approved,
  defaultNotes,
  copy,
}: CaseReviewFormProps) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(defaultNotes);
  const [submitting, setSubmitting] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ResultState | null>(null);

  async function submit(decision: "approve" | "reject") {
    setSubmitting(decision);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/cases/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          decision,
          notes: notes.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body || !body.ok) {
        setError(body && !body.ok ? body.error.message : copy.errorGeneric);
        return;
      }
      setResult({
        approved: body.data.approved,
        email: body.data.notify.email,
        telegram: body.data.notify.telegram,
      });
      // Re-fetch the server component so the badge + counters refresh.
      router.refresh();
    } catch {
      setError(copy.errorGeneric);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-foreground">{copy.notesLabel}</span>
        <textarea
          name="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.notesPlaceholder}
          className="resize-y rounded-2xl border border-foreground/15 bg-background px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-foreground/40 focus:outline-none"
          maxLength={4000}
        />
        <span className="text-xs text-foreground/55">{copy.notesHelp}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => submit("approve")}
          disabled={submitting !== null}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-500/15 px-5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "approve" ? copy.submitting : copy.approve}
        </button>
        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={submitting !== null}
          className="inline-flex h-10 items-center justify-center rounded-full bg-amber-500/15 px-5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "reject" ? copy.submitting : copy.reject}
        </button>
        {approved ? (
          <span className="text-xs text-foreground/55">{copy.alreadyApproved}</span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            {result.approved ? copy.successApprove : copy.successReject}
          </span>
          <ul className="flex flex-col gap-1 text-xs text-foreground/70">
            <li>
              {result.email.sent ? "✓" : "✗"}{" "}
              {result.email.sent ? copy.emailDelivered : copy.emailFailed}
              {result.email.error ? ` (${result.email.error})` : ""}
            </li>
            <li>
              {result.telegram.sent ? "✓" : "✗"}{" "}
              {result.telegram.sent ? copy.tgDelivered : copy.tgFailed}
              {result.telegram.error ? ` (${result.telegram.error})` : ""}
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
