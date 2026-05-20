import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonErr } from "@/lib/api-response";
import { buildInvoice, isWfpConfigured } from "@/lib/payments/wayforpay/client";
import { getProduct, isProductSlug } from "@/lib/payments/catalog";
import { getUserContact } from "@/lib/payments/access";

// WayForPay signing uses HMAC-MD5 which is only available via node:crypto.
export const runtime = "nodejs";

const schema = z.object({
  productSlug: z.string().min(1).max(32),
  userId: z.string().uuid(),
});

function pickQuery(
  sp: URLSearchParams,
  name: string
): string | null {
  const v = sp.get(name);
  return v && v.length > 0 ? v : null;
}

function htmlForm(
  url: string,
  fields: Record<string, string>,
  locale: "uk" | "ru"
): string {
  const inputs = Object.entries(fields)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`
    )
    .join("");
  const message =
    locale === "ru"
      ? "Перенаправляю на WayForPay..."
      : "Перенаправляю на WayForPay...";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${message}</title></head><body><form id="f" method="post" action="${escapeHtml(
    url
  )}">${inputs}<noscript><button type="submit">${message}</button></noscript></form><script>document.getElementById('f').submit();</script></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
}

async function handle(req: NextRequest, body: z.infer<typeof schema>) {
  if (!isWfpConfigured()) {
    return jsonErr(503, "wfp_not_configured", "WayForPay is not configured");
  }
  if (!isProductSlug(body.productSlug)) {
    return jsonErr(404, "unknown_product", "Unknown product slug");
  }
  const product = getProduct(body.productSlug)!;
  const contact = await getUserContact(body.userId);
  if (!contact) {
    return jsonErr(404, "user_not_found", "User does not exist");
  }

  const ts = Math.floor(Date.now() / 1000);
  const orderReference = `${body.userId}_${product.slug}_${ts}`;
  const locale = contact.locale;
  const site = siteUrl();
  if (!site) {
    return jsonErr(500, "no_site_url", "NEXT_PUBLIC_SITE_URL is not set");
  }

  const invoice = buildInvoice({
    product,
    orderReference,
    userEmail: contact.email,
    returnUrl: `${site}/${locale}/event/paid?ref=${encodeURIComponent(orderReference)}`,
    serviceUrl: `${site}/api/pay/wfp/webhook`,
  });

  return new NextResponse(htmlForm(invoice.url, invoice.fields, locale), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const productSlug = pickQuery(sp, "p");
  const userId = pickQuery(sp, "u");
  const parsed = schema.safeParse({ productSlug, userId });
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
