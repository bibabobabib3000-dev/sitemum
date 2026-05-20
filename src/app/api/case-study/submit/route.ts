import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { hasAccess } from "@/lib/payments/access";
import { recordCaseStudy } from "@/lib/courses/certificate";

export const runtime = "edge";

const schema = z.object({
  body: z.string().min(200).max(20000),
  videoUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to submit a case study");
  }

  // Case studies are part of the Level 2 graduation flow — gate the
  // endpoint on owning the Level 2 product so we don't collect anything
  // from random users.
  const owns = await hasAccess(session.uid, "level-2");
  if (!owns) {
    return jsonErr(403, "no_access", "Level 2 access required");
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
      z.treeifyError(parsed.error)
    );
  }

  const cs = await recordCaseStudy({
    userId: session.uid,
    bodyUk: parsed.data.body.trim(),
    videoUrl: parsed.data.videoUrl?.trim() || null,
  });
  if (!cs) {
    return jsonErr(500, "no_persist", "Could not persist case study");
  }
  return jsonOk({
    submittedAt: cs.submittedAt.toISOString(),
    approved: cs.approved,
  });
}
