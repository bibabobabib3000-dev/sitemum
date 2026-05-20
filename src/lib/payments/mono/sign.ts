/**
 * MonoPay webhook signature verification.
 *
 * Each callback carries `X-Sign: <base64>` whose value is an ECDSA-SHA256
 * signature over the raw request body. The signing key is MonoPay's
 * publicly published ECDSA P-256 key, fetched from
 * `https://api.monobank.ua/api/merchant/pubkey`.
 *
 * Everything here is Edge-compatible (Web Crypto only).
 */

const PUBKEY_URL = "https://api.monobank.ua/api/merchant/pubkey";

let cachedKey: { key: CryptoKey; fetchedAt: number } | null = null;
const PUBKEY_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function pemToDer(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchPubKey(): Promise<CryptoKey> {
  const res = await fetch(PUBKEY_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch MonoPay pubkey: ${res.status}`);
  }
  const { key } = (await res.json()) as { key: string };
  const der = pemToDer(key);
  // Copy into a fresh ArrayBuffer to satisfy the BufferSource signature on
  // all TS lib targets (Web Crypto rejects SharedArrayBuffer).
  const spki = new ArrayBuffer(der.byteLength);
  new Uint8Array(spki).set(der);
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

async function getPubKey(): Promise<CryptoKey> {
  const now = Date.now();
  if (cachedKey && now - cachedKey.fetchedAt < PUBKEY_TTL_MS) {
    return cachedKey.key;
  }
  const key = await fetchPubKey();
  cachedKey = { key, fetchedAt: now };
  return key;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Convert ASN.1 DER ECDSA signature (SEQUENCE of two INTEGERs) to the IEEE
 * P1363 (r || s, fixed 32-byte each) format that Web Crypto's
 * `crypto.subtle.verify` expects. MonoPay returns DER, so we always convert.
 */
function derToP1363(der: Uint8Array): Uint8Array {
  // Expected: 0x30 len 0x02 lenR rBytes 0x02 lenS sBytes
  if (der[0] !== 0x30) throw new Error("Invalid DER signature");
  // Skip SEQUENCE header.
  let offset = 2;
  if (der[1] & 0x80) {
    // Long-form length
    offset = 2 + (der[1] & 0x7f);
  }
  if (der[offset] !== 0x02) throw new Error("Invalid DER signature (r)");
  const rLen = der[offset + 1];
  let r = der.slice(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;
  if (der[offset] !== 0x02) throw new Error("Invalid DER signature (s)");
  const sLen = der[offset + 1];
  let s = der.slice(offset + 2, offset + 2 + sLen);

  // Trim leading zero byte (ASN.1 sign-bit guard) and left-pad to 32 bytes.
  while (r.length > 32 && r[0] === 0x00) r = r.slice(1);
  while (s.length > 32 && s[0] === 0x00) s = s.slice(1);
  const rPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  const sPadded = new Uint8Array(32);
  sPadded.set(s, 32 - s.length);
  const out = new Uint8Array(64);
  out.set(rPadded, 0);
  out.set(sPadded, 32);
  return out;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(view.byteLength);
  new Uint8Array(buf).set(view);
  return buf;
}

export async function verifyMonoSignature(opts: {
  rawBody: string;
  signatureBase64: string | null;
}): Promise<boolean> {
  if (!opts.signatureBase64) return false;
  try {
    const key = await getPubKey();
    const sigDer = base64ToBytes(opts.signatureBase64);
    // MonoPay docs document DER-encoded signatures. Convert to P1363 for WebCrypto.
    let sig: Uint8Array;
    try {
      sig = derToP1363(sigDer);
    } catch {
      // Fallback: maybe the bytes are already raw P1363 (some sandboxes).
      if (sigDer.length === 64) sig = sigDer;
      else throw new Error("invalid signature encoding");
    }
    const data = new TextEncoder().encode(opts.rawBody);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      toArrayBuffer(sig),
      toArrayBuffer(data)
    );
  } catch (err) {
    console.warn("[mono:verify_error]", err);
    return false;
  }
}

export function isMonoConfigured(): boolean {
  return Boolean(process.env.MONO_TOKEN);
}
