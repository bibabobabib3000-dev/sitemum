import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { verifyMonoSignature } from "@/lib/payments/mono/sign";
import { isProductSlug } from "@/lib/payments/catalog";
import {
  getUserContact,
  grantAccess,
  recordPayment,
} from "@/lib/payments/access";
import { notifyPurchase } from "@/lib/telegram/notify";
import { sendCapiEvent } from "@/lib/analytics/capi";
import { isCapiConfigured } from "@/lib/analytics/pixel";

export const runtime = "edge";

const callbackSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  reference: z.string().optional(),
  amount: z.number(),
  ccy: z.number(),
  finalAmount: z.number().optional(),
  modifiedDate: z.string().optional(),
});

type Callback = z.infer<typeof callbackSchema>;

function ccyFromNumeric(n: number): string {
  switch (n) {
    case 980:
      return "UAH";
    case 840:
      return "USD";
    case 978:
      return "EUR";
    default:
      return String(n);
  }
}

function parseRef(ref: string): {
  userId: string | null;
  productSlug: string | null;
} {
  const parts = ref.split("_");
  if (parts.length < 3) return { userId: null, productSlug: null };
  return { userId: parts[0], productSlug: parts.slice(1, -1).join("_") };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-sign");

  const ok = await verifyMonoSignature({
    rawBody,
    signatureBase64: sigHeader,
  });
  if (!ok) {
    return jsonErr(401, "invalid_signature", "MonoPay signature mismatch");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }

  const cbParsed = callbackSchema.safeParse(parsed);
  if (!cbParsed.success) {
    return jsonErr(
      422,
      "invalid_callback",
      "Unexpected MonoPay payload",
      z.treeifyError(cbParsed.error)
    );
  }
  const cb = cbParsed.data;

  if (cb.status !== "success") {
    await safeRecord(cb, cb.status);
    return jsonOk({ processed: false, reason: "status_not_success" });
  }

  await onSuccess(cb);
  return jsonOk({ processed: true });
}

async function onSuccess(cb: Callback) {
  const ref = cb.reference ?? cb.invoiceId;
  const { userId, productSlug } = parseRef(ref);
  if (!userId || !productSlug || !isProductSlug(productSlug)) {
    console.warn("[mono:webhook:unparseable_reference]", ref);
    return;
  }

  const { persisted } = await safeRecord(cb, "approved");
  if (!persisted) return;

  await grantAccess(userId, productSlug);

  const currency = ccyFromNumeric(cb.ccy);
  const contact = await getUserContact(userId);
  if (contact?.tgId) {
    await notifyPurchase({
      tgChatId: contact.tgId,
      locale: contact.locale,
      productTitle: productSlug,
      amount: (cb.amount / 100).toFixed(2),
      currency,
    });
  }
  if (isCapiConfigured()) {
    try {
      await sendCapiEvent({
        eventName: "Purchase",
        eventId: `mono_${cb.invoiceId}`,
        email: contact?.email,
        value: cb.amount / 100,
        currency,
      });
    } catch (err) {
      console.warn("[mono:capi_error]", err);
    }
  }
}

async function safeRecord(
  cb: Callback,
  status: string
): Promise<{ persisted: boolean }> {
  const ref = cb.reference ?? cb.invoiceId;
  const { userId, productSlug } = parseRef(ref);
  if (!userId || !productSlug || !isProductSlug(productSlug)) {
    return { persisted: false };
  }
  return recordPayment({
    userId,
    provider: "mono",
    providerRef: cb.invoiceId,
    productSlug,
    amountCents: cb.amount,
    currency: ccyFromNumeric(cb.ccy),
    status,
    raw: cb,
  });
}
