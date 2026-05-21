"use client";

import * as React from "react";
import { usePathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface AdminSidebarItem {
  /** Locale-relative path, e.g. `/admin/cases`. Must NOT include the locale prefix. */
  href: string;
  label: string;
  /** Optional planned-for-later marker so the UI can show "soon". */
  pending?: boolean;
}

export interface AdminSidebarProps {
  items: AdminSidebarItem[];
  signedInAs: string;
  /** Header tagline shown above the nav (e.g. "Адмін-панель"). */
  title: string;
  /** Label for the "back to dashboard" link. */
  backToDashboardLabel: string;
  pendingLabel: string;
}

/**
 * Sidebar shown on every `/admin/*` route. Renders inside the admin
 * layout (which already gates by `is_admin`). All links are
 * locale-aware via next-intl navigation.
 *
 * Implemented as a client component so the active-route highlight is
 * driven by `usePathname()` without a full re-render of the layout
 * shell on each navigation.
 */
export function AdminSidebar({
  items,
  signedInAs,
  title,
  backToDashboardLabel,
  pendingLabel,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col gap-6 border-b border-foreground/10 bg-muted/30 p-6 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.18em] text-foreground/55">
          {title}
        </span>
        <span className="truncate text-sm text-foreground/80" title={signedInAs}>
          {signedInAs}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={item.pending ? "true" : undefined}
              onClick={(e) => {
                if (item.pending) e.preventDefault();
              }}
              className={cn(
                "group flex items-center justify-between rounded-2xl px-3 py-2 transition-colors",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground",
                item.pending && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.pending ? (
                <span className="ms-2 rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/55">
                  {pendingLabel}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/dashboard"
        className="rounded-2xl border border-foreground/15 px-3 py-2 text-center text-xs text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        ← {backToDashboardLabel}
      </Link>
    </aside>
  );
}
