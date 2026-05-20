import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonErr } from "@/lib/api-response";
import {
  buildAcknowledgementSignature,
  verifyCallbackSignature,
} from "@/lib/payments/wayforpay/sign";
import { isProductSlug } from "@/lib/payments/catalog";
import {
  getUserContact,
  grantAccess,
  recordPayment,
} from "@/lib/payments/access";
import { notifyPurchase } from "@/lib/telegram/notify";
import { sendCapiEvent } from "@/lib/analytics/capi";
import { isCapiConfigured } from "@/lib/analytics/pixel";

export const runtime = "nodejs";

// WayForPay sends two slightly different content types (form-urlencoded and
// JSON), and the body can sometimes be wrapped in a `[ ... ]` array. We
// accept all three.

const callbackSchema = z.object({
  merchantAccount: z.string(),
  orderReference: z.string(),
  amount: z.coerce.number(),
  currency: z.string(),
  authCode: z.string().default(""),
  cardPan: z.string().default(""),
  transactionStatus: z.string(),
  reasonCode: z.coerce.number(),
  merchantSignature: z.string(),
  email: z.string().optional(),
});

type Callback = z.infer<typeof callbackSchema>;

async function readBody(req: NextRequest): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  const raw = await req.text();
  if (!raw) return {};
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    return {};
  }
}

function ackBody(secret: string, orderReference: string) {
  const time = Math.floor(Date.now() / 1000);
  const signature = buildAcknowledgementSignature(secret, {
    orderReference,
    status: "accept",
    time,
  });
  return { orderReference, status: "accept", time, signature };
}

function parseOrderRef(ref: string): {
  userId: string | null;
  productSlug: string | null;
} {
  // Format from /api/pay/wfp/create: `${userId}_${productSlug}_${ts}`
  const parts = ref.split("_");
  if (parts.length < 3) return { userId: null, productSlug: null };
  const userId = parts[0];
  const productSlug = parts.slice(1, -1).join("_");
  return { userId, productSlug };
}

export async function POST(req: NextRequest) {
  const secret = process.env.WFP_MERCHANT_SECRET;
  if (!secret) {
    return jsonErr(503, "wfp_not_configured", "WFP_MERCHANT_SECRET is not set");
  }

  const raw = await readBody(req);
  const parsed = callbackSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(
      422,
      "invalid_callback",
      "Unparseable WayForPay payload",
      z.treeifyError(parsed.error)
    );
  }
  const cb = parsed.data;

  const ok = verifyCallbackSignature(
    secret,
    {
      merchantAccount: cb.merchantAccount,
      orderReference: cb.orderReference,
      amount: cb.amount,
      currency: cb.currency,
      authCode: cb.authCode,
      cardPan: cb.cardPan,
      transactionStatus: cb.transactionStatus,
      reasonCode: cb.reasonCode,
    },
    cb.merchantSignature
  );

  if (!ok) {
    return jsonErr(401, "invalid_signature", "WayForPay signature mismatch");
  }

  if (cb.transactionStatus === "Approved") {
    try {
      await onApproved(cb);
    } catch (err) {
      console.error("[wfp:webhook:post_processing_error]", err);
    }
  } else {
    // Still log unsuccessful attempts for audit but don't grant access.
    try {
      await recordPaymentForCallback(cb, "denied");
    } catch (err) {
      console.error("[wfp:webhook:denied_log_error]", err);
    }
  }

  // WayForPay expects this exact JSON body so it stops retrying the webhook.
  return NextResponse.json(ackBody(secret, cb.orderReference), { status: 200 });
}

async function onApproved(cb: Callback) {
  const { userId, productSlug } = parseOrderRef(cb.orderReference);
  if (!userId || !productSlug) return;
  if (!isProductSlug(productSlug)) return;

  const { persisted } = await recordPaymentForCallback(cb, "approved");
  if (!persisted) {
    // Webhook replay — payment already processed.
    return;
  }

  await grantAccess(userId, productSlug);

  const contact = await getUserContact(userId);
  if (contact?.tgId) {
    await notifyPurchase({
      tgChatId: contact.tgId,
      locale: contact.locale,
      productTitle: productSlug,
      amount: cb.amount.toFixed(2),
      currency: cb.currency,
    });
  }

  if (isCapiConfigured()) {
    try {
      await sendCapiEvent({
        eventName: "Purchase",
        eventId: `wfp_${cb.orderReference}`,
        email: contact?.email,
        value: cb.amount,
        currency: cb.currency,
      });
    } catch (err) {
      console.warn("[wfp:capi_error]", err);
    }
  }
}

async function recordPaymentForCallback(
  cb: Callback,
  status: "approved" | "denied"
): Promise<{ persisted: boolean }> {
  const { userId, productSlug } = parseOrderRef(cb.orderReference);
  if (!userId || !productSlug || !isProductSlug(productSlug)) {
    return { persisted: false };
  }
  return recordPayment({
    userId,
    provider: "wfp",
    providerRef: cb.orderReference,
    productSlug,
    amountCents: Math.round(cb.amount * 100),
    currency: cb.currency,
    status,
    raw: cb,
  });
}
