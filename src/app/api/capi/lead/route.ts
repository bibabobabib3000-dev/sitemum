import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { sendCapiEvent } from "@/lib/analytics/capi";
import { isCapiConfigured } from "@/lib/analytics/pixel";

export const runtime = "edge";

const bodySchema = z.object({
  eventName: z.enum(["Lead", "PageView", "Purchase"]).default("Lead"),
  eventId: z.string().min(1).max(64),
  eventSourceUrl: z.string().url().max(2048).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(40).optional(),
  value: z.number().nonnegative().max(1_000_000).optional(),
  currency: z.string().length(3).optional(),
});

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function readCookie(req: NextRequest, name: string): string | undefined {
  const c = req.cookies.get(name)?.value;
  return c && c.length > 0 ? c : undefined;
}

/**
 * Server-side Conversions API endpoint. Designed to be invoked from the
 * browser as a "second leg" of an fbq() call, sharing the same event_id so
 * Meta can deduplicate. When CAPI is not configured we return a 204-ish
 * `{ skipped: true }` instead of failing.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      422,
      "invalid_input",
      "Invalid CAPI event payload",
      z.treeifyError(parsed.error)
    );
  }

  if (!isCapiConfigured()) {
    return jsonOk({ skipped: true as const, reason: "not_configured" });
  }

  const input = parsed.data;
  const result = await sendCapiEvent({
    eventName: input.eventName,
    eventId: input.eventId,
    eventSourceUrl: input.eventSourceUrl,
    email: input.email,
    phone: input.phone,
    fbp: readCookie(req, "_fbp"),
    fbc: readCookie(req, "_fbc"),
    clientIp: clientIp(req) ?? undefined,
    clientUserAgent: req.headers.get("user-agent") ?? undefined,
    value: input.value,
    currency: input.currency,
  });

  if (!result.ok && !result.skipped) {
    return jsonErr(502, "capi_upstream", "Meta CAPI upstream error", {
      status: result.status,
    });
  }

  return jsonOk({ sent: result.ok === true });
}
