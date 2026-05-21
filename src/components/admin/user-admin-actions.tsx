"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export type AccessProductSlug = "level-0" | "level-1" | "level-2";

export interface UserAdminActionsCopy {
  heading: string;
  accessHeading: string;
  grant: string;
  revoke: string;
  banHeading: string;
  ban: string;
  unban: string;
  impersonateHeading: string;
  impersonate: string;
  impersonateDisabledSelf: string;
  impersonateDisabledAdmin: string;
  busy: string;
  successGrant: string;
  successRevoke: string;
  successBan: string;
  successUnban: string;
  error: string;
}

interface Props {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
  banned: boolean;
  accessSlugs: string[];
  copy: UserAdminActionsCopy;
}

const SLUGS: AccessProductSlug[] = ["level-0", "level-1", "level-2"];

type PendingKey =
  | { kind: "grant"; slug: AccessProductSlug }
  | { kind: "revoke"; slug: AccessProductSlug }
  | { kind: "ban" }
  | { kind: "unban" }
  | { kind: "impersonate" };

function pendingMatches(a: PendingKey | null, b: PendingKey): boolean {
  if (!a) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "grant" || a.kind === "revoke") {
    return (
      (b.kind === "grant" || b.kind === "revoke") && a.slug === (b as typeof a).slug
    );
  }
  return true;
}

export function UserAdminActions({
  userId,
  isAdmin,
  isSelf,
  banned,
  accessSlugs,
  copy,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PendingKey | null>(null);
  const [flash, setFlash] = React.useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const slugsSet = new Set(accessSlugs);

  async function call(
    url: string,
    body: Record<string, unknown>,
    successText: string,
    nextPending: PendingKey,
  ) {
    setPending(nextPending);
    setFlash(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setFlash({
          kind: "err",
          text: json?.error?.message ?? copy.error,
        });
        return;
      }
      setFlash({ kind: "ok", text: successText });
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : copy.error;
      setFlash({ kind: "err", text });
    } finally {
      setPending(null);
    }
  }

  async function impersonate() {
    setPending({ kind: "impersonate" });
    setFlash(null);
    try {
      const res = await fetch("/api/admin/users/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; data?: { redirectTo?: string }; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setFlash({ kind: "err", text: json?.error?.message ?? copy.error });
        setPending(null);
        return;
      }
      window.location.assign(json.data?.redirectTo ?? "/uk/dashboard");
    } catch (err) {
      const text = err instanceof Error ? err.message : copy.error;
      setFlash({ kind: "err", text });
      setPending(null);
    }
  }

  return (
    <div className="rounded-3xl border border-foreground/10 bg-muted/30 p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-foreground/55">
        {copy.heading}
      </h2>

      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-foreground/55">
          {copy.accessHeading}
        </p>
        <ul className="flex flex-col gap-2">
          {SLUGS.map((slug) => {
            const has = slugsSet.has(slug);
            const grantPending = pendingMatches(pending, { kind: "grant", slug });
            const revokePending = pendingMatches(pending, { kind: "revoke", slug });
            return (
              <li
                key={slug}
                className="flex items-center justify-between gap-2 rounded-2xl border border-foreground/10 bg-background/40 px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{slug}</span>
                {has ? (
                  <button
                    type="button"
                    onClick={() =>
                      call(
                        "/api/admin/users/access/revoke",
                        { user_id: userId, product_slug: slug },
                        copy.successRevoke,
                        { kind: "revoke", slug },
                      )
                    }
                    disabled={pending !== null}
                    className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/75 transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {revokePending ? copy.busy : copy.revoke}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      call(
                        "/api/admin/users/access/grant",
                        { user_id: userId, product_slug: slug },
                        copy.successGrant,
                        { kind: "grant", slug },
                      )
                    }
                    disabled={pending !== null}
                    className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {grantPending ? copy.busy : copy.grant}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-foreground/55">
          {copy.banHeading}
        </p>
        {banned ? (
          <button
            type="button"
            onClick={() =>
              call(
                "/api/admin/users/ban",
                { user_id: userId, action: "unban" },
                copy.successUnban,
                { kind: "unban" },
              )
            }
            disabled={pending !== null || isSelf}
            className="rounded-full border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {pendingMatches(pending, { kind: "unban" }) ? copy.busy : copy.unban}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              call(
                "/api/admin/users/ban",
                { user_id: userId, action: "ban" },
                copy.successBan,
                { kind: "ban" },
              )
            }
            disabled={pending !== null || isSelf}
            className="rounded-full border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {pendingMatches(pending, { kind: "ban" }) ? copy.busy : copy.ban}
          </button>
        )}
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-foreground/55">
          {copy.impersonateHeading}
        </p>
        <button
          type="button"
          onClick={impersonate}
          disabled={pending !== null || isSelf || isAdmin}
          className="rounded-full border border-violet-400/40 px-3 py-2 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/10 disabled:opacity-50"
        >
          {pendingMatches(pending, { kind: "impersonate" }) ? copy.busy : copy.impersonate}
        </button>
        {isSelf ? (
          <p className="text-xs text-foreground/55">{copy.impersonateDisabledSelf}</p>
        ) : isAdmin ? (
          <p className="text-xs text-foreground/55">{copy.impersonateDisabledAdmin}</p>
        ) : null}
      </section>

      {flash ? (
        <p
          role={flash.kind === "err" ? "alert" : "status"}
          className={
            "mt-4 rounded-2xl border px-3 py-2 text-xs " +
            (flash.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200")
          }
        >
          {flash.text}
        </p>
      ) : null}
    </div>
  );
}
