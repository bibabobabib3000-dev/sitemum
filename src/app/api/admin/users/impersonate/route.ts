import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getAdminContext, writeAuditLog } from "@/lib/auth/admin";
import { enterImpersonation } from "@/lib/auth/session";
import { getUserDetail } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  user_id: z.string().uuid(),
});

/**
 * Begin a short (1h) impersonation. The session cookie is rewritten to the
 * target user; a separate `resoul_impersonate` cookie remembers the admin
 * so `/api/admin/users/impersonate/exit` can restore the original session.
 */
export async function POST(req: NextRequest) {
  const ctx = await getAdminContext();
  if (ctx.kind === "unauthenticated") {
    return jsonErr(401, "unauthorized", "Sign in to use the admin API");
  }
  if (ctx.kind !== "ok") {
    return jsonErr(403, "forbidden", "Admin role required");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(422, "invalid_input", "Invalid payload", z.treeifyError(parsed.error));
  }

  if (parsed.data.user_id === ctx.ctx.userId) {
    return jsonErr(400, "self_impersonate", "Cannot impersonate yourself");
  }

  const target = await getUserDetail(parsed.data.user_id);
  if (!target) {
    return jsonErr(404, "not_found", "User not found");
  }
  if (target.isAdmin) {
    return jsonErr(403, "impersonate_admin", "Cannot impersonate another admin");
  }

  await enterImpersonation(ctx.ctx.userId, target.id);

  try {
    await writeAuditLog({
      actorUserId: ctx.ctx.userId,
      action: "user.impersonate",
      targetType: "user",
      targetId: target.id,
      payload: { targetEmail: target.email },
    });
  } catch (err) {
    console.error("[admin:users:impersonate:audit_failed]", err);
  }

  return jsonOk({ impersonating: target.id, redirectTo: `/${target.locale}/dashboard` });
}
