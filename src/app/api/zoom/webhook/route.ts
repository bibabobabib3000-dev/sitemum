import { NextRequest, NextResponse } from "next/server";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { markAttendeeJoined } from "@/lib/events/repo";
import {
  buildValidationResponse,
  isZoomWebhookConfigured,
  verifyZoomSignature,
} from "@/lib/zoom/webhook";

export const runtime = "edge";

interface ZoomEnvelope {
  event?: string;
  payload?: {
    plainToken?: string;
    object?: {
      id?: string | number;
      participant?: {
        email?: string;
        user_email?: string;
      };
    };
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let body: ZoomEnvelope;
  try {
    body = JSON.parse(rawBody) as ZoomEnvelope;
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }

  // 1) URL validation handshake.
  if (body.event === "endpoint.url_validation") {
    const plain = body.payload?.plainToken;
    if (!plain) return jsonErr(400, "missing_plain_token", "plainToken missing");
    if (!isZoomWebhookConfigured()) {
      return jsonErr(
        503,
        "not_configured",
        "ZOOM_WEBHOOK_SECRET_TOKEN is not set"
      );
    }
    const resp = await buildValidationResponse(plain);
    return NextResponse.json(resp);
  }

  // 2) Regular event — verify signature first.
  const ok = await verifyZoomSignature({
    signatureHeader: req.headers.get("x-zm-signature"),
    timestampHeader: req.headers.get("x-zm-request-timestamp"),
    rawBody,
  });
  if (!ok) {
    return jsonErr(401, "invalid_signature", "Zoom signature does not match");
  }

  if (body.event === "meeting.participant_joined") {
    const meetingId = String(body.payload?.object?.id ?? "");
    const participant = body.payload?.object?.participant;
    const email = participant?.email ?? participant?.user_email;
    if (!meetingId || !email) {
      return jsonOk({ processed: false, reason: "missing_fields" });
    }
    try {
      const { updated } = await markAttendeeJoined({
        zoomMeetingId: meetingId,
        participantEmail: email,
      });
      return jsonOk({ processed: true, updated });
    } catch (err) {
      console.error("[zoom:webhook:db_error]", err);
      return jsonErr(500, "db_error", "Could not record participant");
    }
  }

  return jsonOk({ processed: false, reason: "event_ignored", event: body.event });
}
