import type { Product } from "../catalog";

const BASE = "https://api.monobank.ua/api";

export interface MonoInvoiceOpts {
  product: Product;
  /** Internal order id passed back via webhook as `reference`. */
  reference: string;
  /** Where MonoPay redirects after successful payment. */
  redirectUrl: string;
  /** Public URL for MonoPay to POST callbacks to. */
  webHookUrl: string;
  userEmail?: string;
}

export interface MonoInvoice {
  invoiceId: string;
  pageUrl: string;
}

export async function createMonoInvoice(opts: MonoInvoiceOpts): Promise<MonoInvoice> {
  const token = process.env.MONO_TOKEN;
  if (!token) throw new Error("MONO_TOKEN is not set");

  const res = await fetch(`${BASE}/merchant/invoice/create`, {
    method: "POST",
    headers: {
      "X-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: opts.product.amountCents,
      ccy: ccyToNumeric(opts.product.currency),
      merchantPaymInfo: {
        reference: opts.reference,
        destination: opts.product.titleUk,
        comment: opts.product.titleUk,
      },
      redirectUrl: opts.redirectUrl,
      webHookUrl: opts.webHookUrl,
      ...(opts.userEmail ? { paymentType: "debit", customer: opts.userEmail } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MonoPay invoice create ${res.status}: ${body}`);
  }
  return (await res.json()) as MonoInvoice;
}

function ccyToNumeric(currency: "UAH" | "USD" | "EUR"): number {
  // ISO 4217 numeric codes — MonoPay accepts numeric.
  switch (currency) {
    case "UAH":
      return 980;
    case "USD":
      return 840;
    case "EUR":
      return 978;
  }
}
