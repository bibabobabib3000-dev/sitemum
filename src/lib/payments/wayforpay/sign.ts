import { createHmac } from "node:crypto";

/**
 * WayForPay uses HMAC-MD5 over `;`-joined fields. MD5 is not available in
 * the Edge runtime's Web Crypto, so the routes that import this module set
 * `runtime = "nodejs"`.
 *
 * Two signature schemes are used:
 *
 *  - Invoice (create): `merchantAccount;merchantDomainName;orderReference;
 *    orderDate;amount;currency;productName(;...);productCount(;...);
 *    productPrice(;...)`. Each array field is expanded inline.
 *
 *  - Callback/response: `merchantAccount;orderReference;amount;currency;
 *    authCode;cardPan;transactionStatus;reasonCode`. The acknowledgement we
 *    POST back signs `orderReference;status;time`.
 */

export function hmacMd5(secret: string, value: string): string {
  return createHmac("md5", secret).update(value, "utf-8").digest("hex");
}

export interface InvoiceSignInput {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number; // unix seconds
  amount: number; // major units, fractional allowed (e.g. 199.00)
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: number[];
}

export function buildInvoiceSignature(
  secret: string,
  input: InvoiceSignInput
): string {
  if (
    input.productName.length === 0 ||
    input.productName.length !== input.productCount.length ||
    input.productName.length !== input.productPrice.length
  ) {
    throw new Error("productName / productCount / productPrice must align");
  }
  const parts: string[] = [
    input.merchantAccount,
    input.merchantDomainName,
    input.orderReference,
    String(input.orderDate),
    String(input.amount),
    input.currency,
    ...input.productName,
    ...input.productCount.map(String),
    ...input.productPrice.map(String),
  ];
  return hmacMd5(secret, parts.join(";"));
}

export interface CallbackSignInput {
  merchantAccount: string;
  orderReference: string;
  amount: number | string;
  currency: string;
  authCode: string;
  cardPan: string;
  transactionStatus: string;
  reasonCode: number | string;
}

export function buildCallbackSignature(
  secret: string,
  input: CallbackSignInput
): string {
  const parts: string[] = [
    input.merchantAccount,
    input.orderReference,
    String(input.amount),
    input.currency,
    input.authCode,
    input.cardPan,
    input.transactionStatus,
    String(input.reasonCode),
  ];
  return hmacMd5(secret, parts.join(";"));
}

export interface AcknowledgementSignInput {
  orderReference: string;
  status: "accept" | "decline";
  time: number; // unix seconds
}

export function buildAcknowledgementSignature(
  secret: string,
  input: AcknowledgementSignInput
): string {
  return hmacMd5(
    secret,
    [input.orderReference, input.status, String(input.time)].join(";")
  );
}

export function verifyCallbackSignature(
  secret: string,
  input: CallbackSignInput,
  provided: string
): boolean {
  const expected = buildCallbackSignature(secret, input);
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}
