import { cookies } from "next/headers";

/**
 * Stateless cookie session.
 *
 * Cookie value layout:  `<base64url payload>.<base64url signature>`
 *  - payload = JSON.stringify({ uid, exp })  (exp in unix seconds)
 *  - signature = HMAC-SHA256(payload, AUTH_COOKIE_SECRET)
 *
 * No DB session table — we trust the signature.
 */

const COOKIE_NAME = "resoul_session";
const IMPERSONATE_COOKIE_NAME = "resoul_impersonate";
const TTL_DAYS = 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;
const IMPERSONATE_TTL_SECONDS = 60 * 60; // 1h — short by design

export interface SessionPayload {
  uid: string;
  /** Unix seconds. */
  exp: number;
}

export interface ImpersonatePayload {
  /** The real admin's user id — what we restore on exit. */
  actorUid: string;
  /** The user being impersonated — what the session cookie was rewritten to. */
  targetUid: string;
  /** Unix seconds. */
  exp: number;
}

function isConfigured(): boolean {
  const v = process.env.AUTH_COOKIE_SECRET;
  return typeof v === "string" && v.length >= 16;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(value: string): Promise<string> {
  const secret = process.env.AUTH_COOKIE_SECRET!;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return b64urlEncode(new Uint8Array(buf));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function encode(payload: SessionPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const body = b64urlEncode(new TextEncoder().encode(json));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

async function decode(token: string): Promise<SessionPayload | null> {
  if (!isConfigured()) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmac(body);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const raw = new TextDecoder().decode(b64urlDecode(body));
    const parsed = JSON.parse(raw) as Partial<SessionPayload>;
    if (typeof parsed.uid !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: parsed.uid, exp: parsed.exp };
  } catch {
    return null;
  }
}

/**
 * Reads the cookie and returns the session if it's still valid.
 */
export async function getSession(): Promise<SessionPayload | null> {
  if (!isConfigured()) return null;
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  if (!c?.value) return null;
  return decode(c.value);
}

export async function setSession(userId: string): Promise<void> {
  if (!isConfigured()) return;
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = await encode({ uid: userId, exp });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function isAuthConfigured(): boolean {
  return isConfigured();
}

// ---------------------------------------------------------------------------
// Impersonation
//
// `enterImpersonation(actorUid, targetUid)` swaps the session cookie to
// the target user AND writes a separate signed `resoul_impersonate`
// cookie that remembers who the original admin was. While the
// impersonate cookie is present, `getImpersonation()` returns its
// payload — the dashboard layout renders a banner and the exit route
// restores the original session.
//
// Why two cookies? Keeping impersonation separate from the main
// session means existing `getSession()` callers don't need to learn
// about it — they just see the target uid and behave exactly as the
// target user would. Only code that opts in (the banner, the exit
// route, the audit log) needs to read the second cookie.
// ---------------------------------------------------------------------------

async function encodeImpersonate(payload: ImpersonatePayload): Promise<string> {
  const json = JSON.stringify(payload);
  const body = b64urlEncode(new TextEncoder().encode(json));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

async function decodeImpersonate(token: string): Promise<ImpersonatePayload | null> {
  if (!isConfigured()) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmac(body);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const raw = new TextDecoder().decode(b64urlDecode(body));
    const parsed = JSON.parse(raw) as Partial<ImpersonatePayload>;
    if (
      typeof parsed.actorUid !== "string" ||
      typeof parsed.targetUid !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      actorUid: parsed.actorUid,
      targetUid: parsed.targetUid,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Returns the active impersonation payload, if any. Cheap (cookie + HMAC) —
 * call freely from server components.
 */
export async function getImpersonation(): Promise<ImpersonatePayload | null> {
  if (!isConfigured()) return null;
  const store = await cookies();
  const c = store.get(IMPERSONATE_COOKIE_NAME);
  if (!c?.value) return null;
  return decodeImpersonate(c.value);
}

/**
 * Swap the session cookie to `targetUid` and remember the original admin
 * in the impersonate cookie. The session cookie keeps its normal 30-day
 * TTL so the user-facing flows don't notice anything special; the
 * impersonate cookie is short-lived (1h) so an admin can't leave it
 * armed accidentally.
 */
export async function enterImpersonation(
  actorUid: string,
  targetUid: string,
): Promise<void> {
  if (!isConfigured()) return;
  const exp = Math.floor(Date.now() / 1000) + IMPERSONATE_TTL_SECONDS;
  const token = await encodeImpersonate({ actorUid, targetUid, exp });
  const store = await cookies();
  // Re-issue the main session cookie to point at the target user.
  await setSession(targetUid);
  store.set(IMPERSONATE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATE_TTL_SECONDS,
  });
}

/**
 * Restore the session to the actor and clear the impersonate cookie.
 * Returns the actor's uid if a valid impersonation was found, otherwise null
 * (e.g. the cookie expired between enter and exit).
 */
export async function exitImpersonation(): Promise<string | null> {
  const imp = await getImpersonation();
  if (!imp) return null;
  await setSession(imp.actorUid);
  const store = await cookies();
  store.set(IMPERSONATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return imp.actorUid;
}
