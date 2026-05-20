import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { isR2Configured, r2SignedPut } from "@/lib/storage/r2";

export const runtime = "edge";

const TTL_SEC = 15 * 60;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_PREFIXES = ["image/", "audio/", "video/", "application/pdf"];

const schema = z.object({
  filename: z.string().min(1).max(120),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
});

function isAllowedType(ct: string): boolean {
  return ALLOWED_PREFIXES.some((p) =>
    p.endsWith("/") ? ct.startsWith(p) : ct === p
  );
}

function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "file";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in first");
  }

  if (!isR2Configured()) {
    return jsonErr(503, "r2_not_configured", "Uploads are not configured");
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
      z.treeifyError(parsed.error)
    );
  }
  if (!isAllowedType(parsed.data.contentType)) {
    return jsonErr(415, "bad_type", "Content-Type not allowed");
  }

  const key = `homework/${session.uid}/${Date.now()}_${safeFilename(parsed.data.filename)}`;
  const url = await r2SignedPut(key, TTL_SEC, parsed.data.contentType);
  if (!url) {
    return jsonErr(500, "sign_failed", "Could not sign upload URL");
  }

  return jsonOk({
    key,
    url,
    method: "PUT",
    headers: { "Content-Type": parsed.data.contentType },
    ttlSec: TTL_SEC,
  });
}
