import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getAdminContext, writeAuditLog } from "@/lib/auth/admin";
import { setBanState } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(["ban", "unban"]),
});

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
    return jsonErr(400, "self_ban", "Cannot ban your own account");
  }

  const updated = await setBanState(parsed.data.user_id, parsed.data.action);
  if (!updated) {
    return jsonErr(404, "not_found", "User not found");
  }

  try {
    await writeAuditLog({
      actorUserId: ctx.ctx.userId,
      action: parsed.data.action === "ban" ? "user.ban" : "user.unban",
      targetType: "user",
      targetId: parsed.data.user_id,
      payload: {},
    });
  } catch (err) {
    console.error("[admin:users:ban:audit_failed]", err);
  }

  return jsonOk({ banned: parsed.data.action === "ban" });
}
