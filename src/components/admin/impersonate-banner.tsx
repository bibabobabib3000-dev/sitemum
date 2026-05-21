import { getDb, isDbConfigured } from "@/lib/db";
import { getImpersonation } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { ImpersonateExitButton } from "./impersonate-exit-button";

/**
 * Server component that reads the `resoul_impersonate` cookie. When set
 * (and pointing at a non-expired payload), renders a sticky red banner
 * across the top of every page so the admin can never forget they're
 * acting as someone else.
 *
 * Mounted in `[locale]/layout.tsx` so it covers both `/dashboard/*` and
 * `/admin/*`. While impersonating, an admin would still see
 * `/admin/...` 404 (because their session uid now points at a non-admin
 * user) — this is intentional and surfaced in the banner copy.
 */
export async function ImpersonateBanner({ locale }: { locale: "uk" | "ru" }) {
  const imp = await getImpersonation();
  if (!imp) return null;

  const t = await getTranslations({ locale, namespace: "admin.impersonate" });
  let targetEmail: string | null = null;
  if (isDbConfigured()) {
    try {
      const sql = getDb()!;
      const rows = (await sql`
        select email from users where id = ${imp.targetUid}::uuid limit 1
      `) as { email: string }[];
      targetEmail = rows[0]?.email ?? null;
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-red-500/40 bg-red-500/15 px-4 py-2 text-sm text-red-100 backdrop-blur">
      <span className="font-medium">
        {t("banner")} <span className="font-semibold">{targetEmail ?? imp.targetUid}</span>
      </span>
      <ImpersonateExitButton label={t("exit")} />
    </div>
  );
}
