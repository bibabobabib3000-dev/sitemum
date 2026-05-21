import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getAdminContext, writeAuditLog } from "@/lib/auth/admin";
import { adminRevokeAccess } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  user_id: z.string().uuid(),
  product_slug: z.enum(["level-0", "level-1", "level-2"]),
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

  const removed = await adminRevokeAccess({
    userId: parsed.data.user_id,
    productSlug: parsed.data.product_slug,
  });

  try {
    await writeAuditLog({
      actorUserId: ctx.ctx.userId,
      action: "access.revoke",
      targetType: "user",
      targetId: parsed.data.user_id,
      payload: { productSlug: parsed.data.product_slug, removed },
    });
  } catch (err) {
    console.error("[admin:users:access:revoke:audit_failed]", err);
  }

  return jsonOk({ revoked: removed, productSlug: parsed.data.product_slug });
}
