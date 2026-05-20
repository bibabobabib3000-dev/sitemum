import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { issueMagicLink } from "@/lib/auth/magic-link";
import { isAuthConfigured } from "@/lib/auth/session";
import { isResendConfigured, sendEmail } from "@/lib/email/resend";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link";

// Edge: Web Crypto + cookies API are available.
export const runtime = "edge";

const schema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(["uk", "ru"]).default("uk"),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
}

export async function POST(req: NextRequest) {
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
  if (!isAuthConfigured()) {
    return jsonErr(
      503,
      "auth_not_configured",
      "AUTH_COOKIE_SECRET is not set on this deploy"
    );
  }
  const site = siteUrl();
  if (!site) {
    return jsonErr(500, "no_site_url", "NEXT_PUBLIC_SITE_URL is not set");
  }

  const issued = await issueMagicLink({
    email: parsed.data.email,
    locale: parsed.data.locale,
  });
  if (!issued) {
    // Either DB is not configured or the upsert returned nothing — we
    // intentionally do not distinguish in the response to avoid leaking
    // whether an email exists in our system.
    return jsonOk({ sent: false, reason: "no_db" });
  }

  const url = `${site}/api/auth/verify?token=${encodeURIComponent(issued.token)}&locale=${parsed.data.locale}`;
  const rendered = renderMagicLinkEmail({ locale: parsed.data.locale, url });

  if (!isResendConfigured()) {
    // In dev / before Resend is wired we log the link so a developer can
    // copy it from Vercel logs. Never expose it in the HTTP response.
    console.warn("[auth:request_link:stub]", { url });
    return jsonOk({ sent: false, reason: "resend_not_configured" });
  }

  const result = await sendEmail({
    to: parsed.data.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  if (!result.ok) {
    console.warn("[auth:request_link:send_failed]", result.error);
    return jsonOk({ sent: false, reason: "send_failed" });
  }
  return jsonOk({ sent: true });
}
