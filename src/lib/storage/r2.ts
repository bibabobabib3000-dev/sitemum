/**
 * Cloudflare R2 presigned URLs.
 *
 * R2 is S3-compatible, so we implement AWS Signature V4 (query-string form)
 * in pure code on Web Crypto — no @aws-sdk dependency. Path-style URLs:
 *
 *   https://<account>.r2.cloudflarestorage.com/<bucket>/<key>?<sig-query>
 *
 * Spec references:
 *   https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 *   https://developers.cloudflare.com/r2/api/s3/presigned-urls/
 */

const REGION = "auto";
const SERVICE = "s3";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function getConfig(): R2Config | null {
  if (!isR2Configured()) return null;
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
  };
}

// ---------- hex / encoding ----------

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return toHex(buf);
}

/**
 * Coerce any `Uint8Array` into a fresh standalone `ArrayBuffer` so it
 * satisfies the strict `BufferSource` overload required by
 * `crypto.subtle.importKey` (which rejects `SharedArrayBuffer`-backed
 * views). We copy bytes — this is small (≤32 bytes for our use case).
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  value: string
): Promise<ArrayBuffer> {
  const keyBuffer: ArrayBuffer =
    key instanceof Uint8Array ? toArrayBuffer(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(value)
  );
}

async function signingKey(
  secret: string,
  date: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

// ---------- URI encoding (S3 SigV4 requires strict RFC 3986) ----------

function strictUriEncode(value: string, keepSlash = false): string {
  return value
    .split("")
    .map((ch) => {
      if (/[A-Za-z0-9_.~-]/.test(ch)) return ch;
      if (keepSlash && ch === "/") return ch;
      const bytes = new TextEncoder().encode(ch);
      let out = "";
      for (let i = 0; i < bytes.length; i += 1) {
        out += "%" + bytes[i].toString(16).toUpperCase().padStart(2, "0");
      }
      return out;
    })
    .join("");
}

function amzDate(now: Date): { iso: string; date: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());
  return {
    iso: `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`,
    date: `${yyyy}${mm}${dd}`,
  };
}

// ---------- presigner ----------

export interface PresignOptions {
  method: "GET" | "PUT";
  key: string;
  ttlSec: number;
  /**
   * For PUT, callers usually want to require the client to send a specific
   * Content-Type. When set, the header is added to the canonical request so
   * the upload only succeeds if the client sets the matching header.
   */
  contentType?: string;
  /**
   * Optional now() override — useful for tests.
   */
  now?: Date;
}

function endpointHost(accountId: string): string {
  return `${accountId}.r2.cloudflarestorage.com`;
}

export async function presign(opts: PresignOptions): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg) return null;
  if (opts.ttlSec < 1 || opts.ttlSec > 60 * 60 * 24 * 7) {
    throw new Error(`ttlSec out of bounds: ${opts.ttlSec}`);
  }

  const now = opts.now ?? new Date();
  const { iso, date } = amzDate(now);
  const credentialScope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const credential = `${cfg.accessKeyId}/${credentialScope}`;

  const host = endpointHost(cfg.accountId);
  const path = `/${cfg.bucket}/${opts.key.replace(/^\/+/, "")}`;
  const canonicalUri = strictUriEncode(path, true);

  // Headers: host is always signed; for PUT with contentType we also sign it.
  const headers: Array<[string, string]> = [["host", host]];
  if (opts.method === "PUT" && opts.contentType) {
    headers.push(["content-type", opts.contentType]);
  }
  const sortedHeaders = [...headers].sort((a, b) => a[0].localeCompare(b[0]));
  const signedHeaders = sortedHeaders.map(([k]) => k).join(";");
  const canonicalHeaders =
    sortedHeaders.map(([k, v]) => `${k}:${v}`).join("\n") + "\n";

  // Query: sigv4 params (alphabetical).
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": iso,
    "X-Amz-Expires": String(opts.ttlSec),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map(
      (k) =>
        `${strictUriEncode(k)}=${strictUriEncode(query[k])}`
    )
    .join("&");

  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    iso,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kSign = await signingKey(cfg.secretAccessKey, date, REGION, SERVICE);
  const signature = toHex(await hmac(kSign, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function r2SignedGet(
  key: string,
  ttlSec: number
): Promise<string | null> {
  return presign({ method: "GET", key, ttlSec });
}

export async function r2SignedPut(
  key: string,
  ttlSec: number,
  contentType: string
): Promise<string | null> {
  return presign({ method: "PUT", key, ttlSec, contentType });
}

/**
 * Public URL helper. R2_PUBLIC_DOMAIN is optional: when set, we return
 * `https://<domain>/<key>` so the asset can be served without signing
 * (useful for images that are not access-controlled).
 */
export function r2PublicUrl(key: string): string | null {
  const domain = process.env.R2_PUBLIC_DOMAIN;
  if (!domain) return null;
  return `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/${key.replace(/^\/+/, "")}`;
}
