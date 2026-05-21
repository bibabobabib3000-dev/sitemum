import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminContext } from "@/lib/auth/admin";
import { AdminSidebar, type AdminSidebarItem } from "@/components/admin/sidebar";

/**
 * Server-gated admin layout. Renders only for `users.is_admin = true`.
 *
 * Failure modes:
 *  - No session                → redirect to `/[locale]/login`.
 *  - Signed-in but non-admin   → 404 (`notFound`) so the surface is
 *                                invisible to unauthorized eyes. We do
 *                                NOT leak the existence of `/admin` via
 *                                a 403 with copy.
 *
 * Side effect: on success, `last_seen_at` is touched (see
 * `src/lib/auth/admin.ts`).
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const check = await getAdminContext();
  if (check.kind === "unauthenticated") {
    redirect({ href: "/login", locale });
  }
  if (check.kind !== "ok") {
    // Non-admin signed-in user — hide the surface entirely.
    notFound();
  }
  const { ctx } = check;

  const t = await getTranslations({ locale, namespace: "admin" });

  const items: AdminSidebarItem[] = [
    { href: "/admin", label: t("nav.overview") },
    { href: "/admin/cases", label: t("nav.cases") },
    { href: "/admin/users", label: t("nav.users") },
    { href: "/admin/leads", label: t("nav.leads"), pending: true },
    { href: "/admin/payments", label: t("nav.payments"), pending: true },
    { href: "/admin/content", label: t("nav.content"), pending: true },
    { href: "/admin/telegram", label: t("nav.telegram"), pending: true },
    { href: "/admin/events", label: t("nav.events"), pending: true },
    { href: "/admin/audit", label: t("nav.audit"), pending: true },
    { href: "/admin/settings", label: t("nav.settings"), pending: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <AdminSidebar
        items={items}
        signedInAs={ctx.fullName ?? ctx.email}
        title={t("sidebar.title")}
        backToDashboardLabel={t("sidebar.backToDashboard")}
        pendingLabel={t("sidebar.pendingBadge")}
      />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
