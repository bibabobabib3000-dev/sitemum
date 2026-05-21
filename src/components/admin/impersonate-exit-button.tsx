"use client";

import * as React from "react";

export function ImpersonateExitButton({ label }: { label: string }) {
  const [pending, setPending] = React.useState(false);

  async function exit() {
    setPending(true);
    try {
      const res = await fetch("/api/admin/users/impersonate/exit", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      // Regardless of success/failure we hard-reload the page so the
      // server can re-read the (now restored or absent) cookie.
      window.location.assign("/");
      void res;
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exit}
      disabled={pending}
      className="rounded-md border border-red-300/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-50 transition hover:bg-red-500/30 disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}
