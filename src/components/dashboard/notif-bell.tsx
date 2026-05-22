"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface NotificationItem {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface ListResponse {
  ok: true;
  data: {
    unread: number;
    items: NotificationItem[];
  };
}

interface ErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

interface NotifBellProps {
  /** Initial unread count rendered server-side so the badge is correct on first paint. */
  initialUnread: number;
}

const POLL_INTERVAL_MS = 60_000; // 1 min — cheap, edge-only call.

function fmt(dateIso: string, locale: string): string {
  try {
    const d = new Date(dateIso);
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uk-UA", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateIso.slice(0, 16).replace("T", " ");
  }
}

function readableBody(
  item: NotificationItem,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const p = item.payload;
  switch (item.kind) {
    case "case.approved":
      return t("kinds.caseApproved");
    case "case.rejected":
      return typeof p.notes === "string" && p.notes
        ? t("kinds.caseRejectedWithNotes", { notes: String(p.notes) })
        : t("kinds.caseRejected");
    case "payment.success":
      return t("kinds.paymentSuccess");
    case "lesson.unlocked":
      return typeof p.lessonTitle === "string" && p.lessonTitle
        ? t("kinds.lessonUnlockedNamed", { title: String(p.lessonTitle) })
        : t("kinds.lessonUnlocked");
    default:
      return typeof p.body === "string" ? p.body : t("kinds.system");
  }
}

export function NotifBell({ initialUnread }: NotifBellProps) {
  const t = useTranslations("notifications");
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/list?limit=20", {
        cache: "no-store",
      });
      const json = (await res.json()) as ListResponse | ErrorResponse;
      if (!res.ok || !json.ok) {
        setError(!json.ok ? json.error.message : t("error"));
        return;
      }
      setUnread(json.data.unread);
      setItems(json.data.items);
      setError(null);
      setLoaded(true);
    } catch {
      setError(t("error"));
    }
  }, [t]);

  // Cheap background polling. The interval keeps the badge fresh even
  // when the dropdown is closed (so the user notices when something new
  // arrives without refreshing the page).
  useEffect(() => {
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [refresh]);

  // Fetch fresh data the first time the dropdown opens.
  useEffect(() => {
    if (open && !loaded) {
      void refresh();
    }
  }, [open, loaded, refresh]);

  // Click outside to close.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
    return undefined;
  }, [open]);

  async function markOne(id: string) {
    const next = items.map((n) =>
      n.id === id && !n.readAt
        ? { ...n, readAt: new Date().toISOString() }
        : n,
    );
    setItems(next);
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Best-effort — let the poll reconcile on next tick.
    }
  }

  async function markAll() {
    setItems((arr) => arr.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // ignore
    }
  }

  const locale =
    typeof document !== "undefined"
      ? document.documentElement.lang || "uk"
      : "uk";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("buttonAria", { count: unread })}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        <svg aria-hidden viewBox="0 0 20 20" width="16" height="16">
          <path
            d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v2.382L4.146 11.74A.75.75 0 0 0 4.75 13h10.5a.75.75 0 0 0 .604-1.26L14.5 9.383V7A4.5 4.5 0 0 0 10 2.5Zm-1.75 12a1.75 1.75 0 0 0 3.5 0Z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("dialogAria")}
          className="absolute right-0 top-11 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-foreground/10 bg-background/95 p-3 shadow-2xl backdrop-blur"
        >
          <header className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="text-xs uppercase tracking-widest text-foreground/55">
              {t("title")}
            </span>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="text-xs text-foreground/55 underline decoration-foreground/30 underline-offset-2 hover:text-foreground disabled:opacity-40"
            >
              {t("markAll")}
            </button>
          </header>

          {error ? (
            <p className="px-2 py-3 text-xs text-red-300">{error}</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-foreground/55">
              {loaded ? t("empty") : t("loading")}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const isUnread = n.readAt === null;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isUnread) void markOne(n.id);
                      }}
                      className={
                        "block w-full rounded-xl px-2 py-2 text-left transition-colors " +
                        (isUnread
                          ? "bg-foreground/5 hover:bg-foreground/10"
                          : "hover:bg-foreground/5")
                      }
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={
                            "text-sm " +
                            (isUnread
                              ? "font-medium text-foreground"
                              : "text-foreground/70")
                          }
                        >
                          {readableBody(n, t as unknown as (
                            key: string,
                            values?: Record<string, string | number>,
                          ) => string)}
                        </span>
                        <span className="shrink-0 text-[10px] text-foreground/45">
                          {fmt(n.createdAt, locale)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
