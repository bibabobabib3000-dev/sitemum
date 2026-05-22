import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getAdminContext, writeAuditLog } from "@/lib/auth/admin";
import { applyCaseDecision, getCaseDetail } from "@/lib/admin/cases";
import { notifyCaseDecision } from "@/lib/admin/notify-case";
import { notify } from "@/lib/notifications/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  user_id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(4000).optional().nullable(),
});

/**
 * Approve or reject a Level 2 case study.
 *
 * Flow:
 *  1. `getAdminContext` — 401/403 short-circuit.
 *  2. zod validation of body.
 *  3. `applyCaseDecision` — single UPDATE with reviewer + notes.
 *  4. `writeAuditLog` — append-only record of the decision.
 *  5. `revalidateTag('admin:overview')` — bust the overview-KPI cache so
 *     the "Кейси в перевірці" tile reflects the new state on next render.
 *  6. `notifyCaseDecision` — best-effort email + Telegram DM.
 *
 * Errors in step 4-6 are logged but never bubble up; the case-row mutation
 * (step 3) is the source of truth that drives the certificate gate.
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
    return jsonErr(
      422,
      "invalid_input",
      "Invalid payload",
      z.treeifyError(parsed.error),
    );
  }

  // Load the case + recipient identity once. We need this for both the
  // mutation (to know the recipient locale for notifications) and the
  // audit log (so we can diff old → new approved state).
  const before = await getCaseDetail(parsed.data.user_id);
  if (!before) {
    return jsonErr(404, "not_found", "Case study not found");
  }

  const result = await applyCaseDecision({
    userId: parsed.data.user_id,
    decision: parsed.data.decision,
    reviewerUserId: ctx.ctx.userId,
    notes: parsed.data.notes?.trim() || null,
  });
  if (!result) {
    return jsonErr(500, "persist_failed", "Could not persist decision");
  }

  // Audit log — never block the response on this.
  try {
    await writeAuditLog({
      actorUserId: ctx.ctx.userId,
      action: parsed.data.decision === "approve" ? "case.approve" : "case.reject",
      targetType: "case",
      targetId: parsed.data.user_id,
      payload: {
        previousApproved: before.approved,
        newApproved: result.approved,
        notesLength: parsed.data.notes?.length ?? 0,
        recipientEmail: before.email,
      },
    });
  } catch (err) {
    console.error("[admin:cases:audit_failed]", err);
  }

  // Invalidate the overview KPI cache so the pending-cases tile refreshes.
  try {
    revalidateTag("admin:overview");
  } catch (err) {
    console.error("[admin:cases:revalidate_failed]", err);
  }

  // Best-effort fan-out. We surface per-channel status in the response
  // so the UI can show "delivered via TG + email" / "TG only" etc.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://resoul.app";
  const dashboardUrl = `${baseUrl}/${before.locale}/dashboard`;
  const notifyResult = await notifyCaseDecision(
    {
      email: before.email,
      fullName: before.fullName,
      tgUsername: before.tgUsername,
      locale: before.locale,
    },
    {
      decision: parsed.data.decision,
      notes: parsed.data.notes?.trim() || null,
      dashboardUrl,
    },
  );

  // In-app notification — writes a row into `notifications` so the
  // student sees the bell badge update on their next dashboard visit.
  // Channels here are intentionally limited to `in_app` because the
  // existing notify-case helper already handled email/Telegram above.
  try {
    await notify({
      userId: parsed.data.user_id,
      kind:
        parsed.data.decision === "approve" ? "case.approved" : "case.rejected",
      channels: ["in_app"],
      payload: {
        notes: parsed.data.notes?.trim() || null,
        dashboardUrl,
      },
    });
  } catch (err) {
    console.error("[admin:cases:notify_failed]", err);
  }

  return jsonOk({
    approved: result.approved,
    approvedAt: result.approvedAt ? result.approvedAt.toISOString() : null,
    notify: notifyResult,
  });
}
