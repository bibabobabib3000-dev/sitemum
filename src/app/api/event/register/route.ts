import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { isDbConfigured } from "@/lib/db";
import { getEventBySlug, registerAttendee } from "@/lib/events/repo";

export const runtime = "edge";

const bodySchema = z.object({
  eventSlug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric/dash"),
  userId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(
      422,
      "invalid_input",
      "Invalid registration payload",
      z.treeifyError(parsed.error)
    );
  }

  if (!isDbConfigured()) {
    console.log("[event:register:stub]", parsed.data);
    return jsonOk({ alreadyRegistered: false, mode: "stub" as const });
  }

  const event = await getEventBySlug(parsed.data.eventSlug);
  if (!event) {
    return jsonErr(404, "event_not_found", "Event slug is unknown");
  }

  try {
    const { alreadyRegistered } = await registerAttendee({
      eventId: event.id,
      userId: parsed.data.userId,
    });
    return jsonOk({ alreadyRegistered, mode: "db" as const });
  } catch (err) {
    console.error("[event:register:db_error]", err);
    return jsonErr(500, "db_error", "Could not register attendee");
  }
}
