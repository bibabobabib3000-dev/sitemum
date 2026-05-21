import { jsonErr, jsonOk } from "@/lib/api-response";
import { exitImpersonation, getImpersonation } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restore the original admin session from an in-flight impersonation.
 * No admin gate on this route — it only reads the signed impersonate
 * cookie. If the cookie is missing/expired, returns 400 and the UI
 * surfaces "session already restored".
 */
export async function POST() {
  const imp = await getImpersonation();
  if (!imp) {
    return jsonErr(400, "no_impersonation", "No active impersonation");
  }
  const actorUid = await exitImpersonation();
  if (!actorUid) {
    return jsonErr(400, "no_impersonation", "No active impersonation");
  }

  try {
    await writeAuditLog({
      actorUserId: actorUid,
      action: "user.impersonate_exit",
      targetType: "user",
      targetId: imp.targetUid,
      payload: {},
    });
  } catch (err) {
    console.error("[admin:users:impersonate_exit:audit_failed]", err);
  }

  return jsonOk({ exited: true });
}
