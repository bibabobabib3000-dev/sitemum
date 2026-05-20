/**
 * Zoom Server-to-Server OAuth token loader.
 *
 * Reads ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET, requests an
 * access token from https://zoom.us/oauth/token (grant_type=account_credentials)
 * and caches it in module memory until ~5 minutes before expiry.
 *
 * No-op when any of the three env vars are missing — `isZoomConfigured()`
 * returns false so the caller can degrade gracefully.
 */

interface CachedToken {
  token: string;
  expiresAt: number; // ms epoch
}

let cached: CachedToken | null = null;

function env(name: string): string | null {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : null;
}

export function isZoomConfigured(): boolean {
  return (
    env("ZOOM_ACCOUNT_ID") !== null &&
    env("ZOOM_CLIENT_ID") !== null &&
    env("ZOOM_CLIENT_SECRET") !== null
  );
}

function basicAuth(clientId: string, clientSecret: string): string {
  // Edge-runtime safe base64 (btoa is available, Buffer is not).
  const raw = `${clientId}:${clientSecret}`;
  if (typeof btoa === "function") return btoa(raw);
  // Fallback for older Node runtimes during local CLI scripts.
  return Buffer.from(raw, "utf-8").toString("base64");
}

/**
 * Returns a usable bearer token. Throws if Zoom is not configured — callers
 * should gate on `isZoomConfigured()` first.
 */
export async function getZoomAccessToken(): Promise<string> {
  if (!isZoomConfigured()) {
    throw new Error("Zoom not configured: missing ZOOM_* env vars");
  }

  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const accountId = env("ZOOM_ACCOUNT_ID")!;
  const clientId = env("ZOOM_CLIENT_ID")!;
  const clientSecret = env("ZOOM_CLIENT_SECRET")!;

  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
    accountId
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zoom OAuth failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Buffer ~5 minutes before real expiry to avoid edge-of-window flakiness.
  cached = {
    token: json.access_token,
    expiresAt: now + Math.max(0, json.expires_in - 300) * 1000,
  };
  return cached.token;
}

/**
 * Test-only: clear the in-memory token cache.
 */
export function _resetZoomTokenCache(): void {
  cached = null;
}
