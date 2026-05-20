import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonErr } from "@/lib/api-response";
import { createMonoInvoice } from "@/lib/payments/mono/client";
import { isMonoConfigured } from "@/lib/payments/mono/sign";
import { getProduct, isProductSlug } from "@/lib/payments/catalog";
import { getUserContact } from "@/lib/payments/access";

export const runtime = "edge";

const schema = z.object({
  productSlug: z.string().min(1).max(32),
  userId: z.string().uuid(),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
}

async function handle(_req: NextRequest, body: z.infer<typeof schema>) {
  if (!isMonoConfigured()) {
    return jsonErr(503, "mono_not_configured", "MONO_TOKEN is not set");
  }
  if (!isProductSlug(body.productSlug)) {
    return jsonErr(404, "unknown_product", "Unknown product slug");
  }
  const product = getProduct(body.productSlug)!;
  const contact = await getUserContact(body.userId);
  if (!contact) {
    return jsonErr(404, "user_not_found", "User does not exist");
  }
  const site = siteUrl();
  if (!site) {
    return jsonErr(500, "no_site_url", "NEXT_PUBLIC_SITE_URL is not set");
  }
  const ts = Math.floor(Date.now() / 1000);
  const reference = `${body.userId}_${product.slug}_${ts}`;

  try {
    const invoice = await createMonoInvoice({
      product,
      reference,
      redirectUrl: `${site}/${contact.locale}/event/paid?ref=${encodeURIComponent(reference)}`,
      webHookUrl: `${site}/api/pay/mono/webhook`,
      userEmail: contact.email,
    });
    return NextResponse.redirect(invoice.pageUrl, { status: 303 });
  } catch (err) {
    console.error("[mono:create_error]", err);
    return jsonErr(502, "mono_create_failed", "MonoPay invoice creation failed");
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = schema.safeParse({
    productSlug: sp.get("p") ?? undefined,
    userId: sp.get("u") ?? undefined,
  });
  if (!parsed.success) {
    return jsonErr(
      422,
      "invalid_input",
      "Missing or invalid p/u query params",
      z.treeifyError(parsed.error)
    );
  }
  return handle(req, parsed.data);
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
  return handle(req, parsed.data);
}
