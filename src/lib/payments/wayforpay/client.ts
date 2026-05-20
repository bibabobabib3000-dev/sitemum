import { buildInvoiceSignature } from "./sign";
import { amountUah, type Product } from "../catalog";

/**
 * Builds the parameters that need to be POSTed (as an HTML form) to
 * `https://secure.wayforpay.com/pay`. The redirect API route renders this
 * as an auto-submitting form because WayForPay does not accept GET params.
 */

const PAY_URL = "https://secure.wayforpay.com/pay";

export function isWfpConfigured(): boolean {
  return Boolean(
    process.env.WFP_MERCHANT_LOGIN &&
      process.env.WFP_MERCHANT_SECRET &&
      process.env.WFP_DOMAIN
  );
}

export interface BuildInvoiceOpts {
  product: Product;
  /** Internal reference — we use `${userId}_${productSlug}_${ts}`. */
  orderReference: string;
  userEmail: string;
  /** Where WayForPay redirects user after success/decline. */
  returnUrl: string;
  /** Where WayForPay POSTs the callback (must be public). */
  serviceUrl: string;
}

export interface InvoicePayload {
  url: string;
  fields: Record<string, string>;
}

export function buildInvoice(opts: BuildInvoiceOpts): InvoicePayload {
  if (!isWfpConfigured()) {
    throw new Error("WayForPay not configured");
  }
  const login = process.env.WFP_MERCHANT_LOGIN!;
  const secret = process.env.WFP_MERCHANT_SECRET!;
  const domain = process.env.WFP_DOMAIN!;

  const orderDate = Math.floor(Date.now() / 1000);
  const amount = Number(amountUah(opts.product.amountCents));
  const productName = [opts.product.titleUk];
  const productCount = [1];
  const productPrice = [amount];

  const signature = buildInvoiceSignature(secret, {
    merchantAccount: login,
    merchantDomainName: domain,
    orderReference: opts.orderReference,
    orderDate,
    amount,
    currency: opts.product.currency,
    productName,
    productCount,
    productPrice,
  });

  const fields: Record<string, string> = {
    merchantAccount: login,
    merchantDomainName: domain,
    orderReference: opts.orderReference,
    orderDate: String(orderDate),
    amount: String(amount),
    currency: opts.product.currency,
    productName: productName.join("|"),
    productCount: productCount.join("|"),
    productPrice: productPrice.join("|"),
    clientEmail: opts.userEmail,
    returnUrl: opts.returnUrl,
    serviceUrl: opts.serviceUrl,
    language: "UA",
    merchantSignature: signature,
  };

  return { url: PAY_URL, fields };
}
