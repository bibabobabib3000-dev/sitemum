/**
 * Helpers for Zoom webhook verification.
 *
 * Two flows:
 *
 * 1. URL validation: Zoom posts an `endpoint.url_validation` event with
 *    `{ plainToken }`. We must respond with
 *    `{ plainToken, encryptedToken: hex(HMAC-SHA256(SECRET, plainToken)) }`.
 *
 * 2. Event delivery: each request carries `x-zm-signature: v0=<hex>` and
 *    `x-zm-request-timestamp: <unix-seconds>`. Signature is over
 *    `v0:<ts>:<raw-body>` with HMAC-SHA256 keyed by the secret token.
 *
 * Both use Web Crypto so the route stays Edge-compatible.
 */

const ENC = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isZoomWebhookConfigured(): boolean {
  const v = process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim();
  return Boolean(v && v.length > 0);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(message));
  return toHex(sig);
}

export async function buildValidationResponse(plainToken: string): Promise<{
  plainToken: string;
  encryptedToken: string;
} | null> {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim();
  if (!secret) return null;
  return {
    plainToken,
    encryptedToken: await hmacHex(secret, plainToken),
  };
}

/**
 * Verify Zoom event signature. Returns true when signature matches OR when no
 * webhook secret is configured (allowing local development). Production
 * environments MUST set ZOOM_WEBHOOK_SECRET_TOKEN.
 */
export async function verifyZoomSignature(opts: {
  signatureHeader: string | null;
  timestampHeader: string | null;
  rawBody: string;
}): Promise<boolean> {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim();
  if (!secret) return true; // dev-mode bypass

  const sig = opts.signatureHeader;
  const ts = opts.timestampHeader;
  if (!sig || !ts) return false;

  const expected = `v0=${await hmacHex(secret, `v0:${ts}:${opts.rawBody}`)}`;
  return timingSafeEqual(sig, expected);
}

/**
 * Constant-time string compare. crypto.subtle does not expose a timing-safe
 * compare primitive in the Edge runtime, so we implement it ourselves over
 * UTF-8 bytes — for hex/base64 signatures this is equivalent to byte compare.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
