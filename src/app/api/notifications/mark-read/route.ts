import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { markAllRead, markRead } from "@/lib/notifications/read";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Accepts either `{ id }` (single notification) or `{ all: true }`.
// Both shapes are common from the bell dropdown — single-click marks
// one row, "Mark all" clears them all.
const schema = z.union([
  z.object({ id: z.string().uuid(), all: z.literal(false).optional() }),
  z.object({ all: z.literal(true), id: z.never().optional() }),
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to update notifications");
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

  if ("all" in parsed.data && parsed.data.all) {
    const cleared = await markAllRead(session.uid);
    return jsonOk({ cleared, marked: null });
  }

  if ("id" in parsed.data && parsed.data.id) {
    const ok = await markRead(session.uid, parsed.data.id);
    return jsonOk({ cleared: ok ? 1 : 0, marked: parsed.data.id });
  }

  return jsonErr(422, "invalid_input", "Provide { id } or { all: true }");
}
