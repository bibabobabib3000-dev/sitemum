import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getAdminContext, writeAuditLog } from "@/lib/auth/admin";
import { adminGrantAccess } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  user_id: z.string().uuid(),
  product_slug: z.enum(["level-0", "level-1", "level-2"]),
});

/**
 * Admin grant of L0/L1/L2 — equivalent to a payment-webhook grant but
 * stamped with the granting admin and audit-logged.
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

  const ok = await adminGrantAccess({
    userId: parsed.data.user_id,
    productSlug: parsed.data.product_slug,
    grantedByUserId: ctx.ctx.userId,
  });
  if (!ok) {
    return jsonErr(500, "persist_failed", "Could not grant access");
  }

  try {
    await writeAuditLog({
      actorUserId: ctx.ctx.userId,
      action: "access.grant",
      targetType: "user",
      targetId: parsed.data.user_id,
      payload: { productSlug: parsed.data.product_slug },
    });
  } catch (err) {
    console.error("[admin:users:access:grant:audit_failed]", err);
  }

  return jsonOk({ granted: true, productSlug: parsed.data.product_slug });
}
