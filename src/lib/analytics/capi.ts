import {
  capiAccessToken,
  isCapiConfigured,
  pixelId,
  pixelTestCode,
} from "./pixel";

export type CapiEventName = "Lead" | "PageView" | "Purchase";

export interface CapiInput {
  /** Pixel event name. Must match the browser-side fbq('track', ...) call. */
  eventName: CapiEventName;
  /** Same uuid that was passed as `eventID` on the browser side (dedup key). */
  eventId: string;
  /** URL where the event originated, e.g. https://resoul.app/uk#form */
  eventSourceUrl?: string;
  email?: string;
  phone?: string;
  /** _fbp cookie (Facebook browser id). */
  fbp?: string;
  /** _fbc cookie (Facebook click id, fbclid → _fbc). */
  fbc?: string;
  /** Client IP address (X-Forwarded-For first hop). */
  clientIp?: string;
  /** Client user-agent header. */
  clientUserAgent?: string;
  /** Optional value/currency for Purchase events. */
  value?: number;
  currency?: string;
}

/**
 * SHA-256 of a normalized user identifier. Meta requires lowercased + trimmed
 * input for emails; phone numbers must be digits-only with country code.
 */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export async function hashUserData(input: {
  email?: string;
  phone?: string;
}): Promise<{ em?: string; ph?: string }> {
  const out: { em?: string; ph?: string } = {};
  if (input.email) out.em = await sha256Hex(normalizeEmail(input.email));
  if (input.phone) out.ph = await sha256Hex(normalizePhone(input.phone));
  return out;
}

/**
 * Send a single event to the Meta Conversions API.
 *
 * Returns `{ ok: false, skipped: true }` when CAPI is not configured so the
 * caller can stay agnostic about whether Meta is wired up.
 */
export async function sendCapiEvent(input: CapiInput): Promise<
  | { ok: true; skipped?: false }
  | { ok: false; skipped: true; reason: "not_configured" }
  | { ok: false; skipped?: false; status: number; body: string }
> {
  if (!isCapiConfigured()) {
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  const id = pixelId()!;
  const token = capiAccessToken()!;

  const user = await hashUserData({ email: input.email, phone: input.phone });
  const userData: Record<string, string> = { ...user };
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  const customData: Record<string, unknown> = {};
  if (typeof input.value === "number") customData.value = input.value;
  if (input.currency) customData.currency = input.currency;

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;
  if (Object.keys(customData).length > 0) event.custom_data = customData;

  const payload: Record<string, unknown> = { data: [event] };
  const testCode = pixelTestCode();
  if (testCode) payload.test_event_code = testCode;

  const url = `https://graph.facebook.com/v18.0/${id}/events?access_token=${encodeURIComponent(
    token
  )}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[capi:network_error]", err);
    return { ok: false, status: 0, body: String(err) };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("[capi:non_ok]", { status: res.status, body });
    return { ok: false, status: res.status, body };
  }

  return { ok: true };
}
