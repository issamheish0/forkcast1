// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: montypay-callback
// Webhook handler for MontyPay payment notifications
// Validates hash signature, saves card tokens to payment_methods
// Logs all transactions to payment_transactions table

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MONTYPAY_PASSWORD = Deno.env.get("MONTYPAY_PASSWORD")!;
const MONTYPAY_MERCHANT_KEY = Deno.env.get("MONTYPAY_MERCHANT_KEY")!;
const MONTYPAY_API_BASE = "https://checkout.montypay.com/api/v1";

interface MontyPayCallback {
  // Transaction identification
  payment_id: string;
  order: {
    number: string;
    amount: string;
    currency: string;
    description: string;
  };

  // Status
  status: "SUCCESS" | "FAIL" | "WAITING" | "UNDEFINED";
  reason?: string;

  // Card tokens (only on SUCCESS)
  card_token?: string; // 64-char token for displaying card
  recurring_token?: string; // Token for recurring charges
  recurring_init_trans_id?: string; // Initial transaction ID for recurring

  // Card details
  card?: {
    number?: string; // Masked card number e.g., "411111******1111"
    card?: string; // Alternative field for masked number
    expiry_month?: string;
    expiry_year?: string;
    bank?: string;
    type?: string; // VISA, MASTERCARD, etc.
  };

  // Hash for validation
  hash: string;

  // Transaction type
  type?:
    | "sale"
    | "3ds"
    | "capture"
    | "refund"
    | "void"
    | "recurring"
    | "chargeback";
}

// MontyPay Checkout Integration callback payload
// See: https://docs.montypay.com/docs/guides/checkout_integration/#callback-parameters
interface MontyPayCheckoutCallback {
  id: string; // payment_public_id
  order_number: string;
  order_amount: string;
  order_currency: string;
  order_description: string;
  order_status?: string; // prepare, settled, pending, 3ds, redirect, decline, refund, reversal, chargeback
  type?: string; // sale, 3ds, redirect, capture, refund, void, chargeback, debit, transfer
  status: string; // success, fail, waiting, undefined
  reason?: string;
  brand?: string;
  card?: string; // masked card, e.g. 411111******1111
  card_expiration_date?: string; // e.g. 12/2022
  card_token?: string;
  recurring_token?: string;
  recurring_init_trans_id?: string;
  custom_data?: Record<string, unknown>;
  hash: string;
  rrn?: string;
  approval_code?: string;
  trans_date?: string;
  date?: string; // Alternative date field used by some callbacks
  payer_name?: string;
  payer_email?: string;
  payer_ip?: string;
  // Alternative field names used by some MontyPay callbacks
  customer_name?: string;
  customer_email?: string;
  customer_ip?: string;
}

// MontyPay S2S callback payload (application/x-www-form-urlencoded)
// See: https://docs.montypay.com/docs/guides/s2s_card/#callback-parameters
interface MontyPayS2SCallback {
  action?: string; // SALE, RECURRING_SALE, etc.
  result?: string; // SUCCESS, DECLINED, REDIRECT, UNDEFINED
  status?: string; // SETTLED, PENDING, PREPARE, DECLINED, 3DS, REDIRECT, etc.

  order_id?: string;
  trans_id?: string;

  hash?: string;
  recurring_token?: string;
  schedule_id?: string;
  card_token?: string;

  // Optional extended data
  brand?: string;
  card?: string; // masked card number
  card_expiration_date?: string; // usually MM/YYYY
  trans_date?: string;
  amount?: string;
  currency?: string;
  decline_reason?: string;
  rrn?: string;
  approval_code?: string;

  // May be present depending on Protocol Mapping settings
  payer_email?: string;
  email?: string;
  payer_name?: string;
  payer_ip?: string;

  // In form-urlencoded, custom_data often comes as custom_data[key]=value
  custom_data?: Record<string, unknown>;
}

type NormalizedCallback = {
  // Identification
  orderNumber: string | null;
  paymentId: string | null; // legacy payment_id
  transId: string | null; // S2S trans_id

  // Status
  action: string | null;
  result: string | null;
  status: string | null;

  // Tokens
  cardToken: string | null;
  recurringToken: string | null;

  // Card
  cardMask: string | null;
  cardBrand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardExpirationDate: string | null;

  // Hash
  hash: string | null;

  // Type (sale, 3ds, void, refund, etc.)
  type: string | null;

  // Additional transaction data
  orderAmount: string | null;
  orderCurrency: string | null;
  orderDescription: string | null;
  orderStatus: string | null;
  reason: string | null;
  rrn: string | null;
  approvalCode: string | null;
  transDate: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerIp: string | null;
  recurringInitTransId: string | null;
  customData: Record<string, unknown> | null;

  // Raw payloads
  legacy?: MontyPayCallback;
  s2s?: MontyPayS2SCallback;
  checkout?: MontyPayCheckoutCallback;
};

function okText(): Response {
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

function errorText(status: number): Response {
  return new Response("ERROR", {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Compute MontyPay hash signature: SHA1(MD5(uppercase(data)))
 */
async function computeMontyPayHash(data: string): Promise<string> {
  const encoder = new TextEncoder();

  // Compute MD5 hash
  const md5Buffer = await crypto.subtle.digest(
    "MD5",
    encoder.encode(data.toUpperCase()),
  );
  const md5Hex = encodeHex(new Uint8Array(md5Buffer));

  // Compute SHA-1 hash of the MD5 hex string
  const sha1Buffer = await crypto.subtle.digest(
    "SHA-1",
    encoder.encode(md5Hex),
  );
  return encodeHex(new Uint8Array(sha1Buffer));
}

/**
 * Refund a transaction via MontyPay API
 */
async function refundTransaction(
  paymentId: string,
  amount: string,
): Promise<boolean> {
  try {
    console.log(
      `[montypay-refund] Initiating refund for payment ${paymentId}, amount ${amount}`,
    );

    const hash = await computeMontyPayHash(
      paymentId + amount + MONTYPAY_PASSWORD,
    );

    const payload = {
      merchant_key: MONTYPAY_MERCHANT_KEY,
      payment_id: paymentId,
      amount: amount,
      hash: hash,
    };

    const response = await fetch(`${MONTYPAY_API_BASE}/payment/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`[montypay-refund] MontyPay response:`, JSON.stringify(data));

    if (!response.ok || data.result !== "accepted") {
      console.error(
        `[montypay-refund] Refund failed:`,
        data.error_message || data.message || "Unknown error",
      );
      return false;
    }

    console.log(`[montypay-refund] ✅ Refund accepted successfully`);
    return true;
  } catch (error) {
    console.error(`[montypay-refund] ❌ Refund error:`, error);
    return false;
  }
}

/**
 * Void a transaction via MontyPay API
 * (Used for same-day reversal of settled transactions)
 */
async function voidTransaction(paymentId: string): Promise<boolean> {
  try {
    console.log(`[montypay-void] Initiating void for payment ${paymentId}`);

    const hash = await computeMontyPayHash(paymentId + MONTYPAY_PASSWORD);

    const payload = {
      merchant_key: MONTYPAY_MERCHANT_KEY,
      payment_id: paymentId,
      hash: hash,
    };

    const response = await fetch(`${MONTYPAY_API_BASE}/payment/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`[montypay-void] MontyPay response:`, JSON.stringify(data));

    // For void, MontyPay returns status: "void" or "VOID"
    const status = (data.status || "").toUpperCase();
    if (!response.ok || status !== "VOID") {
      console.error(
        `[montypay-void] Void failed:`,
        data.error_message || data.message || "Unknown error",
      );
      return false;
    }

    console.log(`[montypay-void] ✅ Void successful`);
    return true;
  } catch (error) {
    console.error(`[montypay-void] ❌ Void error:`, error);
    return false;
  }
}

/**
 * Triggers reversal (Void/Refund) for card verification charges
 */
async function processReversal(callback: NormalizedCallback): Promise<void> {
  // Process reversal for TOKEN-, WIDGET-GUARANTEE-, and MANUAL-GUARANTEE- orders (all are $1.00 card verifications)
  const isVerificationOrder = callback.orderNumber?.startsWith("TOKEN-") || 
    callback.orderNumber?.startsWith("WIDGET-GUARANTEE-") ||
    callback.orderNumber?.startsWith("MANUAL-GUARANTEE-");
    
  if (isVerificationOrder && callback.paymentId) {
    // Only attempt reversal on the final successful status (sale or settled)
    // to avoid double attempts during 3DS steps.
    const isFinalStatus = callback.checkout?.order_status === "settled" ||
      callback.checkout?.type === "sale" ||
      callback.legacy?.type === "sale";

    if (isFinalStatus) {
      const amount = callback.legacy?.order.amount ||
        callback.checkout?.order_amount ||
        callback.s2s?.amount ||
        "1.00";

      console.log(
        `[montypay-callback] Card verification success (final state). Reversing ${amount}...`,
      );

      // Try VOID first as it's specifically for same-day reversals of SETTLED transactions per MontyPay docs
      const voidSuccess = await voidTransaction(callback.paymentId);

      if (!voidSuccess) {
        console.log(
          `[montypay-callback] Void failed, trying Refund as fallback...`,
        );
        await refundTransaction(callback.paymentId, amount);
      }
    } else {
      console.log(
        `[montypay-callback] Skipping reversal for non-final status: ${
          callback.checkout?.type || callback.legacy?.type
        }`,
      );
    }
  }
}

// Validate MontyPay callback hash signature
// hash = SHA1(MD5(uppercase(payment_id + order.number + order.amount + order.currency + order.description + PASSWORD)))
async function validateHash(callback: MontyPayCallback): Promise<boolean> {
  const data = callback.payment_id +
    callback.order.number +
    callback.order.amount +
    callback.order.currency +
    callback.order.description +
    MONTYPAY_PASSWORD;

  const expectedHash = await computeMontyPayHash(data);
  return expectedHash.toLowerCase() === callback.hash.toLowerCase();
}

function reverseString(input: string): string {
  // Avoid [...str].reverse() because of surrogate pairs; emails and digits are ASCII
  return input.split("").reverse().join("");
}

function extractFirst6Last4FromMask(
  cardMask: string,
): { first6: string; last4: string } | null {
  const digits = cardMask.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return { first6: digits.slice(0, 6), last4: digits.slice(-4) };
}

function parseExpiry(
  cardExpirationDate: string | null,
): { month: number; year: number } | null {
  if (!cardExpirationDate) return null;
  // Most commonly: "MM/YYYY". Sometimes: "MM/YY".
  const match = cardExpirationDate.match(/^(\d{2})\/(\d{2,4})$/);
  if (!match) return null;
  const month = Number.parseInt(match[1], 10);
  let year = Number.parseInt(match[2], 10);
  if (Number.isNaN(month) || month < 1 || month > 12) return null;
  if (Number.isNaN(year)) return null;
  if (year < 100) year = 2000 + year;
  return { month, year };
}

async function computeMd5HexUppercase(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("MD5", encoder.encode(input));
  return encodeHex(new Uint8Array(buffer));
}

// Appendix A (Hash) Formula 2:
// md5(strtoupper(strrev(email).PASSWORD.trans_id.strrev(substr(card_number,0,6).substr(card_number,-4))))
async function validateHashFormula2(args: {
  email: string;
  transId: string;
  cardMask: string;
  providedHash: string;
}): Promise<boolean> {
  const extracted = extractFirst6Last4FromMask(args.cardMask);
  if (!extracted) return false;
  const first6Last4 = extracted.first6 + extracted.last4;

  const data = (
    reverseString(args.email) +
    MONTYPAY_PASSWORD +
    args.transId +
    reverseString(first6Last4)
  ).toUpperCase();

  const expected = await computeMd5HexUppercase(data);
  return expected.toLowerCase() === args.providedHash.toLowerCase();
}

function getS2SCardBrand(brand?: string, cardMask?: string): string {
  if (brand && typeof brand === "string") return brand.toLowerCase();
  return getCardBrand(undefined, cardMask);
}

function normalizeCallback(payload: unknown): NormalizedCallback {
  const anyPayload = payload as any;

  const looksLikeCheckoutIntegration = typeof anyPayload?.id === "string" &&
    typeof anyPayload?.order_number === "string" &&
    typeof anyPayload?.order_amount === "string" &&
    typeof anyPayload?.order_currency === "string" &&
    typeof anyPayload?.order_description === "string" &&
    typeof anyPayload?.hash === "string";

  if (looksLikeCheckoutIntegration) {
    const checkout = anyPayload as MontyPayCheckoutCallback;

    const expiry = parseExpiry(
      typeof checkout.card_expiration_date === "string"
        ? checkout.card_expiration_date
        : null,
    );

    const normalizedStatus = typeof checkout.status === "string"
      ? checkout.status.toUpperCase()
      : "";

    // Bridge to legacy validation/signature formula (Checkout Integration callback uses the same SHA1(MD5(...)) signature)
    const legacyForHash: MontyPayCallback = {
      payment_id: checkout.id,
      order: {
        number: checkout.order_number,
        amount: checkout.order_amount,
        currency: checkout.order_currency,
        description: checkout.order_description,
      },
      status: (normalizedStatus as MontyPayCallback["status"]) || "UNDEFINED",
      reason: checkout.reason,
      card_token: checkout.card_token,
      recurring_token: checkout.recurring_token,
      recurring_init_trans_id: checkout.recurring_init_trans_id,
      card: {
        number: checkout.card,
      },
      hash: checkout.hash,
      type: (checkout.type as MontyPayCallback["type"]) || undefined,
    };

    return {
      orderNumber: checkout.order_number,
      paymentId: checkout.id,
      transId: null,

      action: null,
      result: null,
      status: normalizedStatus || null,

      cardToken: typeof checkout.card_token === "string"
        ? checkout.card_token
        : null,
      recurringToken: typeof checkout.recurring_token === "string"
        ? checkout.recurring_token
        : null,

      cardMask: typeof checkout.card === "string" ? checkout.card : null,
      cardBrand: getS2SCardBrand(
        typeof checkout.brand === "string" ? checkout.brand : undefined,
        typeof checkout.card === "string" ? checkout.card : undefined,
      ),
      expiryMonth: expiry?.month ?? null,
      expiryYear: expiry?.year ?? null,
      cardExpirationDate: typeof checkout.card_expiration_date === "string"
        ? checkout.card_expiration_date
        : null,

      hash: typeof checkout.hash === "string" ? checkout.hash : null,
      type: typeof checkout.type === "string"
        ? checkout.type.toLowerCase()
        : null,

      // Additional transaction data
      orderAmount: checkout.order_amount,
      orderCurrency: checkout.order_currency,
      orderDescription: checkout.order_description,
      orderStatus: typeof checkout.order_status === "string"
        ? checkout.order_status
        : null,
      reason: typeof checkout.reason === "string" ? checkout.reason : null,
      rrn: typeof checkout.rrn === "string" ? checkout.rrn : null,
      approvalCode: typeof checkout.approval_code === "string"
        ? checkout.approval_code
        : null,
      transDate: typeof checkout.trans_date === "string"
        ? checkout.trans_date
        : (typeof checkout.date === "string" ? checkout.date : null),
      customerName: typeof checkout.payer_name === "string"
        ? checkout.payer_name
        : (typeof checkout.customer_name === "string" ? checkout.customer_name : null),
      customerEmail: typeof checkout.payer_email === "string"
        ? checkout.payer_email
        : (typeof checkout.customer_email === "string" ? checkout.customer_email : null),
      customerIp: typeof checkout.payer_ip === "string"
        ? checkout.payer_ip
        : (typeof checkout.customer_ip === "string" ? checkout.customer_ip : null),
      recurringInitTransId: typeof checkout.recurring_init_trans_id === "string"
        ? checkout.recurring_init_trans_id
        : null,
      customData: checkout.custom_data || null,

      legacy: legacyForHash,
      checkout,
    };
  }

  // Prefer legacy shape when it clearly matches, even if S2S-like fields are present.
  // This avoids misclassifying mixed payloads and applying the wrong hash algorithm.
  const looksLikeLegacy = typeof anyPayload?.payment_id === "string" &&
    typeof anyPayload?.order?.number === "string";

  if (looksLikeLegacy) {
    const legacy = anyPayload as MontyPayCallback;
    const cardMask = legacy.card?.number || legacy.card?.card || null;
    const expiryMonth = legacy.card?.expiry_month
      ? Number.parseInt(legacy.card.expiry_month, 10)
      : null;
    const expiryYear = legacy.card?.expiry_year
      ? Number.parseInt(legacy.card.expiry_year, 10)
      : null;

    return {
      orderNumber: typeof legacy.order?.number === "string"
        ? legacy.order.number
        : null,
      paymentId: typeof legacy.payment_id === "string"
        ? legacy.payment_id
        : null,
      transId: null,

      action: null,
      result: null,
      status: typeof legacy.status === "string" ? legacy.status : null,

      cardToken: typeof legacy.card_token === "string"
        ? legacy.card_token
        : null,
      recurringToken: typeof legacy.recurring_token === "string"
        ? legacy.recurring_token
        : null,

      cardMask,
      cardBrand: getCardBrand(legacy.card?.type, cardMask || undefined),
      expiryMonth: Number.isFinite(expiryMonth as number)
        ? (expiryMonth as number)
        : null,
      expiryYear: Number.isFinite(expiryYear as number)
        ? (expiryYear as number)
        : null,
      cardExpirationDate: legacy.card?.expiry_month && legacy.card?.expiry_year
        ? `${legacy.card.expiry_month}/${legacy.card.expiry_year}`
        : null,

      hash: typeof legacy.hash === "string" ? legacy.hash : null,
      type: typeof legacy.type === "string" ? legacy.type.toLowerCase() : null,

      // Additional transaction data
      orderAmount: typeof legacy.order?.amount === "string"
        ? legacy.order.amount
        : null,
      orderCurrency: typeof legacy.order?.currency === "string"
        ? legacy.order.currency
        : null,
      orderDescription: typeof legacy.order?.description === "string"
        ? legacy.order.description
        : null,
      orderStatus: null,
      reason: typeof legacy.reason === "string" ? legacy.reason : null,
      rrn: null,
      approvalCode: null,
      transDate: null,
      customerName: null,
      customerEmail: null,
      customerIp: null,
      recurringInitTransId: typeof legacy.recurring_init_trans_id === "string"
        ? legacy.recurring_init_trans_id
        : null,
      customData: null,

      legacy,
    };
  }

  // Heuristic: S2S uses order_id/trans_id/result/action. Legacy checkout uses payment_id/order.number/status.
  const looksLikeS2S = typeof anyPayload?.trans_id === "string" ||
    typeof anyPayload?.order_id === "string" ||
    typeof anyPayload?.result === "string" ||
    typeof anyPayload?.action === "string";

  if (looksLikeS2S) {
    const s2s = anyPayload as MontyPayS2SCallback;
    const expiry = parseExpiry(
      typeof s2s.card_expiration_date === "string"
        ? s2s.card_expiration_date
        : null,
    );
    const cardMask = typeof s2s.card === "string" ? s2s.card : null;
    const brand = getS2SCardBrand(
      typeof s2s.brand === "string" ? s2s.brand : undefined,
      cardMask || undefined,
    );

    return {
      orderNumber: typeof s2s.order_id === "string" ? s2s.order_id : null,
      paymentId: null,
      transId: typeof s2s.trans_id === "string" ? s2s.trans_id : null,

      action: typeof s2s.action === "string" ? s2s.action : null,
      result: typeof s2s.result === "string" ? s2s.result : null,
      status: typeof s2s.status === "string" ? s2s.status : null,

      cardToken: typeof s2s.card_token === "string" ? s2s.card_token : null,
      recurringToken: typeof s2s.recurring_token === "string"
        ? s2s.recurring_token
        : null,

      cardMask,
      cardBrand: brand,
      expiryMonth: expiry?.month ?? null,
      expiryYear: expiry?.year ?? null,
      cardExpirationDate: typeof s2s.card_expiration_date === "string"
        ? s2s.card_expiration_date
        : null,

      hash: typeof s2s.hash === "string" ? s2s.hash : null,
      type: typeof s2s.action === "string" ? s2s.action.toLowerCase() : null,

      // Additional transaction data
      orderAmount: typeof s2s.amount === "string" ? s2s.amount : null,
      orderCurrency: typeof s2s.currency === "string" ? s2s.currency : null,
      orderDescription: null,
      orderStatus: typeof s2s.status === "string" ? s2s.status : null,
      reason: typeof s2s.decline_reason === "string"
        ? s2s.decline_reason
        : null,
      rrn: typeof s2s.rrn === "string" ? s2s.rrn : null,
      approvalCode: typeof s2s.approval_code === "string"
        ? s2s.approval_code
        : null,
      transDate: typeof s2s.trans_date === "string" ? s2s.trans_date : null,
      customerName: typeof s2s.payer_name === "string" ? s2s.payer_name : null,
      customerEmail: typeof s2s.payer_email === "string"
        ? s2s.payer_email
        : (typeof s2s.email === "string" ? s2s.email : null),
      customerIp: typeof s2s.payer_ip === "string" ? s2s.payer_ip : null,
      recurringInitTransId: null,
      customData: s2s.custom_data || null,

      s2s,
    };
  }

  const legacy = anyPayload as MontyPayCallback;
  const cardMask = legacy.card?.number || legacy.card?.card || null;
  const expiryMonth = legacy.card?.expiry_month
    ? Number.parseInt(legacy.card.expiry_month, 10)
    : null;
  const expiryYear = legacy.card?.expiry_year
    ? Number.parseInt(legacy.card.expiry_year, 10)
    : null;

  return {
    orderNumber: typeof legacy.order?.number === "string"
      ? legacy.order.number
      : null,
    paymentId: typeof legacy.payment_id === "string" ? legacy.payment_id : null,
    transId: null,

    action: null,
    result: null,
    status: typeof legacy.status === "string" ? legacy.status : null,

    cardToken: typeof legacy.card_token === "string" ? legacy.card_token : null,
    recurringToken: typeof legacy.recurring_token === "string"
      ? legacy.recurring_token
      : null,

    cardMask,
    cardBrand: getCardBrand(legacy.card?.type, cardMask || undefined),
    expiryMonth: Number.isFinite(expiryMonth as number)
      ? (expiryMonth as number)
      : null,
    expiryYear: Number.isFinite(expiryYear as number)
      ? (expiryYear as number)
      : null,
    cardExpirationDate: legacy.card?.expiry_month && legacy.card?.expiry_year
      ? `${legacy.card.expiry_month}/${legacy.card.expiry_year}`
      : null,

    hash: typeof legacy.hash === "string" ? legacy.hash : null,
    type: typeof legacy.type === "string" ? legacy.type.toLowerCase() : null,

    // Additional transaction data
    orderAmount: typeof legacy.order?.amount === "string"
      ? legacy.order.amount
      : null,
    orderCurrency: typeof legacy.order?.currency === "string"
      ? legacy.order.currency
      : null,
    orderDescription: typeof legacy.order?.description === "string"
      ? legacy.order.description
      : null,
    orderStatus: null,
    reason: typeof legacy.reason === "string" ? legacy.reason : null,
    rrn: null,
    approvalCode: null,
    transDate: null,
    customerName: null,
    customerEmail: null,
    customerIp: null,
    recurringInitTransId: typeof legacy.recurring_init_trans_id === "string"
      ? legacy.recurring_init_trans_id
      : null,
    customData: null,

    legacy,
  };
}

function parseFormIntoObject(formData: FormData): Record<string, unknown> {
  const data: Record<string, any> = {};

  for (const [key, value] of formData.entries()) {
    // Handle bracket notation like custom_data[email]
    const bracketMatch = key.match(/^([^[\]]+)\[([^\]]+)\]$/);
    if (bracketMatch) {
      const root = bracketMatch[1];
      const inner = bracketMatch[2];
      if (!data[root]) data[root] = {};
      data[root][inner] = value;
      continue;
    }

    // Handle nested objects like order.number
    if (key.includes(".")) {
      const parts = key.split(".");
      if (!data[parts[0]]) data[parts[0]] = {};
      data[parts[0]][parts[1]] = value;
      continue;
    }

    data[key] = value;
  }

  return data;
}

// Extract card brand from card type or number
function getCardBrand(cardType?: string, cardNumber?: string): string {
  if (cardType) {
    return cardType.toLowerCase();
  }

  if (cardNumber) {
    const firstDigit = cardNumber.charAt(0);
    const firstTwo = cardNumber.substring(0, 2);

    if (firstDigit === "4") return "visa";
    if (firstTwo >= "51" && firstTwo <= "55") return "mastercard";
    if (firstTwo === "34" || firstTwo === "37") return "amex";
    if (firstTwo === "60" || firstTwo === "65") return "discover";
  }

  return "unknown";
}

/**
 * Save transaction to payment_transactions table
 * This is called for every callback to maintain a complete audit trail
 */
async function savePaymentTransaction(
  supabase: any,
  callback: NormalizedCallback,
  rawPayload: unknown,
  isValidHash: boolean,
  userId: string | null,
  bookingId: string | null,
  paymentMethodId: string | null,
  processingNotes: string | null,
): Promise<string | null> {
  try {
    // Determine callback type
    const callbackType = callback.checkout
      ? "checkout_integration"
      : callback.s2s
        ? "s2s"
        : callback.legacy
          ? "legacy"
          : "unknown";

    // Parse transaction date
    let transactionDate: string | null = null;
    if (callback.transDate) {
      try {
        transactionDate = new Date(callback.transDate).toISOString();
      } catch {
        // Keep as null if parsing fails
      }
    }

    // Build the transaction record
    const transactionRecord = {
      payment_id: callback.paymentId || callback.transId || "unknown",
      order_number: callback.orderNumber || "unknown",
      trans_id: callback.transId,
      order_amount: callback.orderAmount
        ? parseFloat(callback.orderAmount)
        : 0,
      order_currency: callback.orderCurrency || "USD",
      order_description: callback.orderDescription,
      order_status: callback.orderStatus,
      transaction_type: callback.type,
      status: callback.status || "UNKNOWN",
      result: callback.result,
      action: callback.action,
      reason: callback.reason,
      card_mask: callback.cardMask,
      card_brand: callback.cardBrand,
      card_expiration_date: callback.cardExpirationDate,
      card_token: callback.cardToken,
      recurring_token: callback.recurringToken,
      recurring_init_trans_id: callback.recurringInitTransId,
      rrn: callback.rrn,
      approval_code: callback.approvalCode,
      transaction_date: transactionDate,
      customer_name: callback.customerName,
      customer_email: callback.customerEmail,
      customer_ip: callback.customerIp,
      hash: callback.hash || "",
      hash_validated: isValidHash,
      user_id: userId,
      booking_id: bookingId,
      payment_method_id: paymentMethodId,
      custom_data: callback.customData,
      raw_payload: rawPayload,
      callback_type: callbackType,
      processing_notes: processingNotes,
    };

    // Try to insert, or update if duplicate (payment_id + order_number)
    const { data, error } = await supabase
      .from("payment_transactions")
      .upsert(transactionRecord, {
        onConflict: "payment_id,order_number",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error(
        "[montypay-callback] Failed to save payment transaction:",
        error,
      );
      return null;
    }

    console.log(
      "[montypay-callback] Payment transaction saved:",
      data?.id,
      "type:",
      callbackType,
    );
    return data?.id || null;
  } catch (error) {
    console.error(
      "[montypay-callback] Error saving payment transaction:",
      error,
    );
    return null;
  }
}

Deno.serve(async (req) => {
  // MontyPay sends callbacks as POST
  if (req.method !== "POST") {
    return errorText(405);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Parse callback data
    // MontyPay may send as application/x-www-form-urlencoded (S2S) or JSON
    let rawPayload: unknown;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      rawPayload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      rawPayload = parseFormIntoObject(formData);
    } else {
      // Try JSON as default
      rawPayload = await req.json();
    }

    // DEBUG: Log raw payload to understand what MontyPay is actually sending
    console.log("MontyPay raw callback payload:", JSON.stringify(rawPayload));

    const callback = normalizeCallback(rawPayload);

    console.log("MontyPay callback received:", {
      order_number: callback.orderNumber,
      payment_id: callback.paymentId,
      trans_id: callback.transId,
      action: callback.action,
      result: callback.result,
      status: callback.status,
      has_card_token: !!callback.cardToken,
      has_recurring_token: !!callback.recurringToken,
      card_token_value: callback.cardToken
        ? `${callback.cardToken.substring(0, 10)}...`
        : null,
      recurring_token_value: callback.recurringToken
        ? `${callback.recurringToken.substring(0, 10)}...`
        : null,
      callback_type: callback.checkout
        ? "checkout_integration"
        : callback.s2s
        ? "s2s"
        : callback.legacy
        ? "legacy"
        : "unknown",
    });

    if (!callback.orderNumber) {
      console.error("Missing order identifier in callback");
      return errorText(400);
    }

    // Ignore recurring charge callbacks here (penalties are handled elsewhere)
    // S2S: action=RECURRING_SALE, Legacy: type="recurring"
    if (
      callback.action === "RECURRING_SALE" ||
      callback.legacy?.type === "recurring"
    ) {
      console.log("Recurring callback ignored by montypay-callback");
      // Still save to payment_transactions for audit trail
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        false, // Not validating hash for ignored callbacks
        null,
        null,
        null,
        "Recurring callback - ignored by montypay-callback, handled elsewhere",
      );
      return okText();
    }

    // Identify the user (needed for Formula 2 because email isn't always included in callback payload)
    const orderParts = callback.orderNumber.split("-");
    const userIdPrefix = orderParts.length >= 2 ? orderParts[1] : null;

    const { data: pendingMethod } = await supabase
      .from("payment_methods")
      .select("id, user_id")
      .eq("card_token", `pending:${callback.orderNumber}`)
      .single();

    let userId: string | null = null;
    let existingMethodId: string | null = null;
    let existingMethodNeedsRecurringToken: string | null = null;

    if (pendingMethod) {
      userId = pendingMethod.user_id;
      existingMethodId = pendingMethod.id;
    } else {
      // No pending record found - this might be a second callback (e.g., after 3DS)
      // Try to find an existing payment method that was created from the first callback
      // and may need the recurring_token updated
      if (callback.paymentId && callback.recurringToken) {
        const { data: existingByTransId } = await supabase
          .from("payment_methods")
          .select("id, user_id, recurring_token")
          .eq("recurring_init_trans_id", callback.paymentId)
          .eq("is_active", true)
          .single();

        if (existingByTransId) {
          userId = existingByTransId.user_id;
          // Flag for update if the callback has a different recurring_token
          // This handles the case where the first callback saved card_token as recurring_token
          // but the second callback has the real recurring_token
          if (existingByTransId.recurring_token !== callback.recurringToken) {
            existingMethodNeedsRecurringToken = existingByTransId.id;
            console.log(
              "Found existing payment method needing recurring_token update:",
              existingByTransId.id,
              "current:",
              existingByTransId.recurring_token?.substring(0, 10) + "...",
              "new:",
              callback.recurringToken?.substring(0, 10) + "...",
            );
          } else {
            console.log(
              "Payment method already has the correct recurring_token",
            );
          }
        }
      }

      // Fallback: try to identify user by order number prefix
      if (!userId && userIdPrefix) {
        const { data: users } = await supabase
          .from("profiles")
          .select("id")
          .ilike("id", `${userIdPrefix}%`)
          .limit(1);
        if (users && users.length > 0) userId = users[0].id;
      }
    }

    // Validate hash signature
    // Prefer S2S Formula 2 if this looks like S2S, otherwise use legacy hash.
    let isValidHash = false;
    let processingNotes: string | null = null;

    if (callback.s2s && callback.transId && callback.hash) {
      if (!userId) {
        console.error(
          "Could not identify user for S2S callback order:",
          callback.orderNumber,
        );
        // Save transaction with error note
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          false,
          null,
          null,
          null,
          "Failed: Could not identify user for S2S callback",
        );
        return errorText(400);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      const emailFromCallback = (typeof callback.s2s.payer_email === "string"
        ? callback.s2s.payer_email
        : null) ||
        (typeof callback.s2s.email === "string" ? callback.s2s.email : null) ||
        (typeof (callback.s2s.custom_data as any)?.email === "string"
          ? (callback.s2s.custom_data as any).email
          : null) ||
        (typeof profile?.email === "string" ? profile.email : null);

      const cardMask = callback.cardMask;
      if (!emailFromCallback || !cardMask) {
        console.error("Missing email/card mask for Formula 2 validation", {
          hasEmail: !!emailFromCallback,
          hasCard: !!cardMask,
        });
        // Save transaction with error note
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          false,
          userId,
          null,
          null,
          "Failed: Missing email/card mask for Formula 2 hash validation",
        );
        return errorText(400);
      }

      isValidHash = await validateHashFormula2({
        email: emailFromCallback,
        transId: callback.transId,
        cardMask,
        providedHash: callback.hash,
      });
    } else if (callback.legacy) {
      isValidHash = await validateHash(callback.legacy);
    }

    if (!isValidHash) {
      console.error(
        "Invalid hash signature for callback order:",
        callback.orderNumber,
        "\nExpected hash components:",
        callback.legacy
          ? {
            payment_id: callback.legacy.payment_id,
            order_number: callback.legacy.order?.number,
            order_amount: callback.legacy.order?.amount,
            order_currency: callback.legacy.order?.currency,
            order_description:
              callback.legacy.order?.description?.substring(0, 20) + "...",
            // Don't log password!
          }
          : "No legacy callback data",
        "\nProvided hash:",
        callback.hash,
      );
      // Save transaction with invalid hash note
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        false,
        userId,
        null,
        null,
        "Failed: Invalid hash signature",
      );
      return errorText(400);
    }

    // Extract booking_id from custom_data if present
    let bookingId: string | null = null;
    if (callback.orderNumber?.startsWith("EVENT-")) {
      bookingId =
        (typeof (callback.checkout?.custom_data as any)?.booking_id === "string"
          ? (callback.checkout?.custom_data as any).booking_id
          : null) ||
        (typeof (callback.s2s?.custom_data as any)?.booking_id === "string"
          ? (callback.s2s?.custom_data as any).booking_id
          : null) ||
        (typeof (callback.customData as any)?.booking_id === "string"
          ? (callback.customData as any).booking_id
          : null);
    }

    // Only process successful tokenization callbacks
    const resultUpper = (callback.result || "").toUpperCase();
    const statusUpper = (callback.status || "").toUpperCase();
    const isSuccess = resultUpper === "SUCCESS" || statusUpper === "SUCCESS";

    if (!isSuccess) {
      console.log("Non-success callback:", {
        order: callback.orderNumber,
        action: callback.action,
        result: callback.result,
        status: callback.status,
      });

      // Save transaction even for non-success callbacks
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        bookingId,
        null,
        `Non-success callback: result=${callback.result}, status=${callback.status}`,
      );

      // Clean up pending payment method if exists
      await supabase
        .from("payment_methods")
        .delete()
        .eq("card_token", `pending:${callback.orderNumber}`);

      return okText();
    }

    // Validate we have at least one token
    // MontyPay Checkout Integration sends recurring_token (not card_token)
    // We use recurring_token as the primary token for both display and charges
    const effectiveCardToken = callback.cardToken || callback.recurringToken ||
      null;

    if (!effectiveCardToken) {
      // If this is a void or refund callback, we don't expect card tokens
      if (callback.type === "void" || callback.type === "refund") {
        console.log(
          `[montypay-callback] Acknowledging reversal callback (${callback.type}) for order: ${callback.orderNumber}`,
        );
        // Save transaction
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          bookingId,
          null,
          `Reversal callback acknowledged: type=${callback.type}`,
        );
        return okText();
      }

      // If this is a penalty payment, we don't expect tokens as it uses an existing card
      if (callback.orderNumber?.startsWith("PENALTY-")) {
        console.log(
          `[montypay-callback] Acknowledging penalty payment callback for order: ${callback.orderNumber}`,
        );
        // Save transaction
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          bookingId,
          null,
          "Penalty payment callback acknowledged",
        );
        return okText();
      }

      // If this is an event payment, we don't expect tokens (actual charge, not tokenization)
      // Event bookings start with status='pending_payment' (not visible to restaurants)
      // On successful payment, we transition to status='confirmed' (now visible to restaurants)
      if (callback.orderNumber?.startsWith("EVENT-")) {
        console.log(
          `[montypay-callback] Processing event payment: ${callback.orderNumber}`,
        );

        // CRITICAL: Check if this is the FINAL payment callback (settled), not an intermediate one (3ds, redirect)
        // MontyPay sends multiple callbacks: during 3DS/OTP auth, and when payment actually settles
        // We only confirm the booking when order_status is "settled" (payment complete)
        const orderStatus = callback.checkout?.order_status?.toLowerCase() || 
                           callback.orderStatus?.toLowerCase() || 
                           callback.s2s?.status?.toLowerCase() || "";
        const callbackType = callback.checkout?.type?.toLowerCase() || 
                            callback.legacy?.type?.toLowerCase() || 
                            callback.type || "";
        
        // Only proceed if this is the final settled/sale callback
        const isFinalPayment = orderStatus === "settled" || 
                               (callbackType === "sale" && orderStatus !== "3ds" && orderStatus !== "redirect" && orderStatus !== "pending");
        
        console.log(`[montypay-callback] EVENT payment callback state:`, {
          orderStatus,
          callbackType,
          isFinalPayment,
          status: callback.status,
        });

        if (!isFinalPayment) {
          console.log(
            `[montypay-callback] Ignoring intermediate EVENT callback (${orderStatus}/${callbackType}), waiting for settled state`,
          );
          // Save transaction for audit but don't confirm booking yet
          await savePaymentTransaction(
            supabase,
            callback,
            rawPayload,
            isValidHash,
            userId,
            bookingId,
            null,
            `Event payment - intermediate callback (${orderStatus}/${callbackType}), awaiting settlement`,
          );
          return okText();
        }

        // Extract booking_id from custom_data
        const eventBookingId =
          (typeof (callback.checkout?.custom_data as any)?.booking_id ===
              "string"
            ? (callback.checkout?.custom_data as any).booking_id
            : null) ||
          (typeof (callback.s2s?.custom_data as any)?.booking_id === "string"
            ? (callback.s2s?.custom_data as any).booking_id
            : null) ||
          (typeof (callback.customData as any)?.booking_id === "string"
            ? (callback.customData as any).booking_id
            : null);

        if (!eventBookingId) {
          console.error(
            "[montypay-callback] No booking_id in EVENT payment custom_data",
          );
          // Still save transaction and acknowledge - payment succeeded
          await savePaymentTransaction(
            supabase,
            callback,
            rawPayload,
            isValidHash,
            userId,
            null,
            null,
            "Event payment - no booking_id in custom_data",
          );
          return okText();
        }

        const amount = callback.orderAmount || "0";

        const description = callback.orderDescription || "Event Booking";

        // Extract event name (assumes format "Name - N guest(s)")
        const eventName = description.split(" - ")[0] || "Special Event";

        // Update booking: pending_payment → confirmed
        // This makes the booking visible to restaurants and clears the payment expiration
        const { error: updateError } = await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            is_event_booking: true,
            payment_status: "paid",
            payment_amount: amount,
            occasion: `Event: ${eventName}`,
            source: "event_widget",
            payment_expires_at: null, // Clear expiration since payment succeeded
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventBookingId);

        if (updateError) {
          console.error(
            "[montypay-callback] Failed to confirm booking:",
            updateError,
          );
          processingNotes = `Event payment - booking update failed: ${updateError.message}`;
        } else {
          console.log("[montypay-callback] ✅ Booking confirmed:", eventBookingId);
          processingNotes = "Event payment - booking confirmed successfully (payment settled)";
        }

        // Save transaction
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          eventBookingId,
          null,
          processingNotes,
        );

        return okText();
      }

      // ========================================================================
      // MANUAL-DEPOSIT: Deposit payment for manual bookings created by restaurant staff
      // Similar to EVENT- but confirms the manual booking
      // ========================================================================
      if (callback.orderNumber?.startsWith("MANUAL-DEPOSIT-")) {
        console.log(
          `[montypay-callback] Processing manual deposit payment: ${callback.orderNumber}`,
        );

        // Check if this is the FINAL payment callback
        const orderStatus = callback.checkout?.order_status?.toLowerCase() || 
                           callback.orderStatus?.toLowerCase() || 
                           callback.s2s?.status?.toLowerCase() || "";
        const callbackType = callback.checkout?.type?.toLowerCase() || 
                            callback.legacy?.type?.toLowerCase() || 
                            callback.type || "";
        
        const isFinalPayment = orderStatus === "settled" || 
                               (callbackType === "sale" && orderStatus !== "3ds" && orderStatus !== "redirect" && orderStatus !== "pending");
        
        console.log(`[montypay-callback] MANUAL-DEPOSIT payment callback state:`, {
          orderStatus,
          callbackType,
          isFinalPayment,
          status: callback.status,
        });

        if (!isFinalPayment) {
          console.log(
            `[montypay-callback] Ignoring intermediate MANUAL-DEPOSIT callback (${orderStatus}/${callbackType}), waiting for settled state`,
          );
          await savePaymentTransaction(
            supabase,
            callback,
            rawPayload,
            isValidHash,
            userId,
            bookingId,
            null,
            `Manual deposit - intermediate callback (${orderStatus}/${callbackType}), awaiting settlement`,
          );
          return okText();
        }

        // Extract booking_id from custom_data
        const customData = callback.checkout?.custom_data || callback.s2s?.custom_data || callback.customData || {};
        const manualDepositBookingId = (customData as any).booking_id;

        if (!manualDepositBookingId) {
          console.error(
            "[montypay-callback] No booking_id in MANUAL-DEPOSIT payment custom_data",
          );
          await savePaymentTransaction(
            supabase,
            callback,
            rawPayload,
            isValidHash,
            userId,
            null,
            null,
            "Manual deposit - no booking_id in custom_data",
          );
          return okText();
        }

        const amount = callback.orderAmount || "0";

        // Update booking: pending_payment → confirmed
        // This makes the booking visible and confirms it since deposit was paid
        const { error: updateError } = await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            payment_status: "paid",
            payment_amount: amount,
            payment_expires_at: null, // Clear expiration since payment succeeded
            updated_at: new Date().toISOString(),
          })
          .eq("id", manualDepositBookingId);

        if (updateError) {
          console.error(
            "[montypay-callback] Failed to confirm manual booking:",
            updateError,
          );
          processingNotes = `Manual deposit - booking update failed: ${updateError.message}`;
        } else {
          console.log("[montypay-callback] ✅ Manual booking confirmed with deposit:", manualDepositBookingId);
          processingNotes = "Manual deposit - booking confirmed successfully (payment settled)";
        }

        // Save transaction
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          manualDepositBookingId,
          null,
          processingNotes,
        );

        return okText();
      }

      console.error("No card_token or recurring_token in successful callback", {
        type: callback.type,
        status: callback.status,
        order: callback.orderNumber,
      });
      // Save transaction with error
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        bookingId,
        null,
        "Failed: No card_token or recurring_token in successful callback",
      );
      return errorText(400);
    }

    // ========================================================================
    // WIDGET-GUARANTEE: Card tokenization for widget guest bookings
    // This must be BEFORE the TOKEN- check because WIDGET-GUARANTEE orders
    // have tokens but don't start with TOKEN-
    // ========================================================================
    if (callback.orderNumber?.startsWith("WIDGET-GUARANTEE-")) {
      console.log(
        `[montypay-callback] Processing widget guarantee: ${callback.orderNumber}`,
      );

      // Extract data from custom_data
      const customData = callback.checkout?.custom_data || callback.s2s?.custom_data || callback.customData || {};
      const widgetBookingId = (customData as any).booking_id;
      const noShowFee = parseFloat((customData as any).no_show_fee || "0");
      const cancellationFee = parseFloat((customData as any).cancellation_fee || "0");
      const feeType = (customData as any).fee_type || "per_cover";
      const partySize = parseInt((customData as any).party_size || "1", 10);
      const guestName = (customData as any).guest_name || null;

      if (!widgetBookingId) {
        console.error(
          "[montypay-callback] No booking_id in WIDGET-GUARANTEE custom_data",
        );
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          null,
          null,
          "Failed: No booking_id in WIDGET-GUARANTEE custom_data",
        );
        return errorText(400);
      }

      // We need card tokens for widget guarantees (they're tokenization flows)
      if (!effectiveCardToken) {
        console.error(
          "[montypay-callback] No card_token for WIDGET-GUARANTEE",
        );
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          widgetBookingId,
          null,
          "Failed: No card_token for WIDGET-GUARANTEE",
        );
        return errorText(400);
      }

      // Determine if this is the final callback (settled) or intermediate (3ds)
      const orderStatus = callback.checkout?.order_status?.toLowerCase() ||
        callback.orderStatus?.toLowerCase() ||
        callback.s2s?.status?.toLowerCase() || "";
      const callbackType = callback.checkout?.type?.toLowerCase() ||
        callback.legacy?.type?.toLowerCase() ||
        callback.type || "";
      const isFinalCallback = orderStatus === "settled" ||
        (callbackType === "sale" && orderStatus !== "3ds" && orderStatus !== "redirect" && orderStatus !== "pending");

      console.log(`[montypay-callback] WIDGET-GUARANTEE callback state:`, {
        orderStatus,
        callbackType,
        isFinalCallback,
        hasRecurringToken: !!callback.recurringToken,
      });

      // Check if payment_method already exists for this booking (follow-up callback scenario)
      const { data: existingWidgetPM } = await supabase
        .from("payment_methods")
        .select("id, recurring_token, card_token")
        .eq("booking_id", widgetBookingId)
        .eq("is_active", true)
        .single();

      if (existingWidgetPM) {
        // Follow-up callback - update existing payment_method if we have a new recurring_token
        console.log(`[montypay-callback] Found existing payment_method for booking: ${existingWidgetPM.id}`);

        if (callback.recurringToken && existingWidgetPM.recurring_token !== callback.recurringToken) {
          const { error: updatePmError } = await supabase
            .from("payment_methods")
            .update({
              recurring_token: callback.recurringToken,
              // Use recurring_token as card_token for consistency (it's the chargeable token)
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingWidgetPM.id);

          if (updatePmError) {
            console.error("[montypay-callback] Failed to update payment_method recurring_token:", updatePmError);
          } else {
            console.log("[montypay-callback] ✅ Updated payment_method with recurring_token");
          }
        }

        // Save transaction
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          widgetBookingId,
          existingWidgetPM.id,
          `Widget guarantee follow-up callback (${orderStatus}/${callbackType})`,
        );

        // Only trigger reversal and make booking visible on final callback
        if (isFinalCallback) {
          // Make booking visible to restaurant now that card verification is complete
          const { error: confirmError } = await supabase
            .from("bookings")
            .update({
              status: "pending", // Transition from pending_payment - now visible to restaurant (awaiting their action)
              payment_status: "pending", // Guarantee is held
              payment_expires_at: null, // Clear expiration
              updated_at: new Date().toISOString(),
            })
            .eq("id", widgetBookingId);

          if (confirmError) {
            console.error("[montypay-callback] Failed to update booking status on follow-up:", confirmError);
          } else {
            console.log(`[montypay-callback] ✅ Booking visible to restaurant on follow-up callback: ${widgetBookingId}`);
          }

          await processReversal(callback);
        }

        console.log(
          `[montypay-callback] ✅ Widget guarantee follow-up processed for booking: ${widgetBookingId}`,
        );
        return okText();
      }

      // First callback - create new payment_method and booking_guarantee
      // Extract card details
      const widgetCardMask = callback.cardMask || "****************";
      const widgetCardBrand = callback.cardBrand || getCardBrand(undefined, widgetCardMask);
      const widgetExpiryMonth = callback.expiryMonth ?? 1;
      const widgetExpiryYear = callback.expiryYear ?? 2099;

      // Create payment_methods record for the guest (user_id = null, booking_id = widgetBookingId)
      const { data: widgetPaymentMethod, error: widgetPmError } = await supabase
        .from("payment_methods")
        .insert({
          user_id: null, // Guest booking - no user
          booking_id: widgetBookingId,
          card_token: effectiveCardToken,
          recurring_token: callback.recurringToken || null,
          recurring_init_trans_id: callback.transId || callback.paymentId || null,
          card_mask: widgetCardMask,
          card_brand: widgetCardBrand,
          expiry_month: widgetExpiryMonth,
          expiry_year: widgetExpiryYear,
          is_default: false,
          is_active: true,
          name: guestName ? `${guestName}'s Card` : "Guest Card",
        })
        .select("id")
        .single();

      if (widgetPmError) {
        console.error(
          "[montypay-callback] Failed to create payment_method for widget guarantee:",
          widgetPmError,
        );
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          widgetBookingId,
          null,
          `Failed to create payment_method for widget guarantee: ${widgetPmError.message}`,
        );
        return errorText(500);
      }

      console.log(
        "[montypay-callback] ✅ Payment method created:",
        widgetPaymentMethod.id,
      );

      // Get the booking's restaurant_id for card_guarantee_settings lookup
      const { data: widgetBooking, error: widgetBookingError } = await supabase
        .from("bookings")
        .select("restaurant_id, party_size")
        .eq("id", widgetBookingId)
        .single();

      if (widgetBookingError || !widgetBooking) {
        console.error(
          "[montypay-callback] Failed to fetch booking for guarantee:",
          widgetBookingError,
        );
        // Still continue - payment method was created
      }

      // Get card_guarantee_settings for the restaurant
      let widgetGuaranteeSettingId: string | null = null;
      if (widgetBooking?.restaurant_id) {
        const { data: widgetSettings } = await supabase
          .from("card_guarantee_settings")
          .select("id")
          .eq("restaurant_id", widgetBooking.restaurant_id)
          .single();
        
        widgetGuaranteeSettingId = widgetSettings?.id || null;
      }

      // Create booking_guarantees record
      const { data: widgetGuarantee, error: widgetBgError } = await supabase
        .from("booking_guarantees")
        .insert({
          booking_id: widgetBookingId,
          payment_method_id: widgetPaymentMethod.id,
          guarantee_setting_id: widgetGuaranteeSettingId,
          no_show_fee: noShowFee,
          cancellation_fee: cancellationFee,
          fee_type: feeType,
          party_size: partySize || widgetBooking?.party_size || 1,
          status: "held",
        })
        .select("id")
        .single();

      if (widgetBgError) {
        console.error(
          "[montypay-callback] Failed to create booking_guarantee:",
          widgetBgError,
        );
        // Don't fail - payment method exists
      } else {
        console.log(
          "[montypay-callback] ✅ Booking guarantee created:",
          widgetGuarantee.id,
        );
      }

      // Update booking: transition from pending_payment to pending
      // and set payment_status to indicate guarantee is held
      // This makes the booking visible to restaurants now that card is verified
      // Status remains 'pending' so restaurant can accept/decline (not auto-confirmed)
      // IMPORTANT: Only transition on final callback to prevent premature visibility
      // before user completes OTP/3DS
      if (isFinalCallback) {
        const { error: widgetUpdateError } = await supabase
          .from("bookings")
          .update({
            status: "pending", // Transition from pending_payment - now visible to restaurant (awaiting their action)
            payment_status: "pending", // Using 'pending' as guarantee_held is not in check constraint
            payment_expires_at: null, // Clear the expiration since verification is complete
            updated_at: new Date().toISOString(),
          })
          .eq("id", widgetBookingId);

        if (widgetUpdateError) {
          console.error(
            "[montypay-callback] Failed to update booking status to pending:",
            widgetUpdateError,
          );
        } else {
          console.log(
            "[montypay-callback] ✅ Booking visible to restaurant (pending their action):",
            widgetBookingId,
          );
        }
      } else {
        console.log(`[montypay-callback] Booking will be made pending on final callback (current: ${orderStatus})`);
      }

      // Save transaction
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        widgetBookingId,
        widgetPaymentMethod.id,
        "Widget guarantee processed successfully (first callback)",
      );

      // Only trigger reversal on final callback (settled), not on intermediate 3DS
      if (isFinalCallback) {
        await processReversal(callback);
      } else {
        console.log(`[montypay-callback] Skipping reversal for intermediate callback (${orderStatus})`);
      }

      console.log(
        "[montypay-callback] ✅ Widget guarantee processed successfully for booking:",
        widgetBookingId,
      );
      return okText();
    }

    // ========================================================================
    // MANUAL-GUARANTEE: Card tokenization for manual bookings created by restaurant staff
    // Similar to WIDGET-GUARANTEE but for manual bookings
    // ========================================================================
    if (callback.orderNumber?.startsWith("MANUAL-GUARANTEE-")) {
      console.log(
        `[montypay-callback] Processing manual guarantee: ${callback.orderNumber}`,
      );

      // Extract data from custom_data
      const customData = callback.checkout?.custom_data || callback.s2s?.custom_data || callback.customData || {};
      const manualBookingId = (customData as any).booking_id;
      const noShowFee = parseFloat((customData as any).no_show_fee || "0");
      const cancellationFee = parseFloat((customData as any).cancellation_fee || "0");
      const feeType = (customData as any).fee_type || "per_cover";
      const partySize = parseInt((customData as any).party_size || "1", 10);
      const guestName = (customData as any).guest_name || null;

      if (!manualBookingId) {
        console.error(
          "[montypay-callback] No booking_id in MANUAL-GUARANTEE custom_data",
        );
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          null,
          null,
          "Failed: No booking_id in MANUAL-GUARANTEE custom_data",
        );
        return errorText(400);
      }

      // We need card tokens for manual guarantees (they're tokenization flows)
      if (!effectiveCardToken) {
        console.error(
          "[montypay-callback] No card_token for MANUAL-GUARANTEE",
        );
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          manualBookingId,
          null,
          "Failed: No card_token for MANUAL-GUARANTEE",
        );
        return errorText(400);
      }

      // Determine if this is the final callback (settled) or intermediate (3ds)
      const orderStatus = callback.checkout?.order_status?.toLowerCase() ||
        callback.orderStatus?.toLowerCase() ||
        callback.s2s?.status?.toLowerCase() || "";
      const callbackType = callback.checkout?.type?.toLowerCase() ||
        callback.legacy?.type?.toLowerCase() ||
        callback.type || "";
      const isFinalCallback = orderStatus === "settled" ||
        (callbackType === "sale" && orderStatus !== "3ds" && orderStatus !== "redirect" && orderStatus !== "pending");

      console.log(`[montypay-callback] MANUAL-GUARANTEE callback state:`, {
        orderStatus,
        callbackType,
        isFinalCallback,
        hasRecurringToken: !!callback.recurringToken,
      });

      // Check if payment_method already exists for this booking (follow-up callback scenario)
      const { data: existingManualPM } = await supabase
        .from("payment_methods")
        .select("id, recurring_token, card_token")
        .eq("booking_id", manualBookingId)
        .eq("is_active", true)
        .single();

      if (existingManualPM) {
        // Follow-up callback - update existing payment_method if we have a new recurring_token
        console.log(`[montypay-callback] Found existing payment_method for manual booking: ${existingManualPM.id}`);

        if (callback.recurringToken && existingManualPM.recurring_token !== callback.recurringToken) {
          const { error: updatePmError } = await supabase
            .from("payment_methods")
            .update({
              recurring_token: callback.recurringToken,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingManualPM.id);

          if (updatePmError) {
            console.error("[montypay-callback] Failed to update payment_method recurring_token:", updatePmError);
          } else {
            console.log("[montypay-callback] ✅ Updated manual payment_method with recurring_token");
          }
        }

        // Save transaction
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          manualBookingId,
          existingManualPM.id,
          `Manual guarantee follow-up callback (${orderStatus}/${callbackType})`,
        );

        // Only trigger reversal and confirm booking on final callback
        if (isFinalCallback) {
          // Confirm the booking now that card verification is complete
          const { error: confirmError } = await supabase
            .from("bookings")
            .update({
              status: "confirmed", // Manual bookings go straight to confirmed (restaurant already created it)
              payment_status: null, // No payment amount for card guarantees - card is just held
              payment_expires_at: null, // Clear expiration
              updated_at: new Date().toISOString(),
            })
            .eq("id", manualBookingId);

          if (confirmError) {
            console.error("[montypay-callback] Failed to confirm manual booking on follow-up:", confirmError);
          } else {
            console.log(`[montypay-callback] ✅ Manual booking confirmed on follow-up callback: ${manualBookingId}`);
          }

          await processReversal(callback);
        }

        console.log(
          `[montypay-callback] ✅ Manual guarantee follow-up processed for booking: ${manualBookingId}`,
        );
        return okText();
      }

      // First callback - create new payment_method and booking_guarantee
      // Extract card details
      const manualCardMask = callback.cardMask || "****************";
      const manualCardBrand = callback.cardBrand || getCardBrand(undefined, manualCardMask);
      const manualExpiryMonth = callback.expiryMonth ?? 1;
      const manualExpiryYear = callback.expiryYear ?? 2099;

      // Create payment_methods record for the guest (user_id = null, booking_id = manualBookingId)
      const { data: manualPaymentMethod, error: manualPmError } = await supabase
        .from("payment_methods")
        .insert({
          user_id: null, // Manual booking guest - no user
          booking_id: manualBookingId,
          card_token: effectiveCardToken,
          recurring_token: callback.recurringToken || null,
          recurring_init_trans_id: callback.transId || callback.paymentId || null,
          card_mask: manualCardMask,
          card_brand: manualCardBrand,
          expiry_month: manualExpiryMonth,
          expiry_year: manualExpiryYear,
          is_default: false,
          is_active: true,
          name: guestName ? `${guestName}'s Card` : "Guest Card",
        })
        .select("id")
        .single();

      if (manualPmError) {
        console.error(
          "[montypay-callback] Failed to create payment_method for manual guarantee:",
          manualPmError,
        );
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          manualBookingId,
          null,
          `Failed to create payment_method for manual guarantee: ${manualPmError.message}`,
        );
        return errorText(500);
      }

      console.log(
        "[montypay-callback] ✅ Manual payment method created:",
        manualPaymentMethod.id,
      );

      // Get the booking's restaurant_id for card_guarantee_settings lookup
      const { data: manualBooking, error: manualBookingError } = await supabase
        .from("bookings")
        .select("restaurant_id, party_size")
        .eq("id", manualBookingId)
        .single();

      if (manualBookingError || !manualBooking) {
        console.error(
          "[montypay-callback] Failed to fetch manual booking for guarantee:",
          manualBookingError,
        );
        // Still continue - payment method was created
      }

      // Get card_guarantee_settings for the restaurant
      let manualGuaranteeSettingId: string | null = null;
      if (manualBooking?.restaurant_id) {
        const { data: manualSettings } = await supabase
          .from("card_guarantee_settings")
          .select("id")
          .eq("restaurant_id", manualBooking.restaurant_id)
          .single();
        
        manualGuaranteeSettingId = manualSettings?.id || null;
      }

      // Create booking_guarantees record
      const { data: manualGuarantee, error: manualBgError } = await supabase
        .from("booking_guarantees")
        .insert({
          booking_id: manualBookingId,
          payment_method_id: manualPaymentMethod.id,
          guarantee_setting_id: manualGuaranteeSettingId,
          no_show_fee: noShowFee,
          cancellation_fee: cancellationFee,
          fee_type: feeType,
          party_size: partySize || manualBooking?.party_size || 1,
          status: "held",
        })
        .select("id")
        .single();

      if (manualBgError) {
        console.error(
          "[montypay-callback] Failed to create booking_guarantee for manual booking:",
          manualBgError,
        );
        // Don't fail - payment method exists
      } else {
        console.log(
          "[montypay-callback] ✅ Manual booking guarantee created:",
          manualGuarantee.id,
        );
      }

      // Update booking: transition from pending_payment to confirmed
      // Manual bookings go straight to confirmed since restaurant created it
      // IMPORTANT: Only transition on final callback to prevent premature confirmation
      if (isFinalCallback) {
        const { error: manualUpdateError } = await supabase
          .from("bookings")
          .update({
            status: "confirmed", // Manual bookings are confirmed once card is verified
            payment_status: null, // No payment amount for card guarantees - card is just held
            payment_expires_at: null, // Clear the expiration since verification is complete
            updated_at: new Date().toISOString(),
          })
          .eq("id", manualBookingId);

        if (manualUpdateError) {
          console.error(
            "[montypay-callback] Failed to confirm manual booking:",
            manualUpdateError,
          );
        } else {
          console.log(
            "[montypay-callback] ✅ Manual booking confirmed:",
            manualBookingId,
          );
        }
      } else {
        console.log(`[montypay-callback] Manual booking will be confirmed on final callback (current: ${orderStatus})`);
      }

      // Save transaction
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        manualBookingId,
        manualPaymentMethod.id,
        "Manual guarantee processed successfully (first callback)",
      );

      // Only trigger reversal on final callback (settled), not on intermediate 3DS
      if (isFinalCallback) {
        await processReversal(callback);
      } else {
        console.log(`[montypay-callback] Skipping reversal for intermediate callback (${orderStatus})`);
      }

      console.log(
        "[montypay-callback] ✅ Manual guarantee processed successfully for booking:",
        manualBookingId,
      );
      return okText();
    }

    // Require TOKEN-* order format for our tokenization flow
    // Non-TOKEN orders (e.g., MontyPay test callbacks) are acknowledged but not processed
    if (orderParts.length < 3 || orderParts[0] !== "TOKEN") {
      console.log(
        "Ignoring non-TOKEN order (test/external callback):",
        callback.orderNumber,
      );
      // Save transaction
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        bookingId,
        null,
        "Ignored: Non-TOKEN order (test/external callback)",
      );
      return okText();
    }

    if (!userId) {
      console.error("Could not identify user for order:", callback.orderNumber);
      // Save transaction with error
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        null,
        bookingId,
        null,
        "Failed: Could not identify user for TOKEN order",
      );
      return errorText(400);
    }

    // Extract card details
    const cardMask = callback.cardMask || "****************";
    const cardBrand = callback.cardBrand || getCardBrand(undefined, cardMask);
    const expiryMonth = callback.expiryMonth ?? 1;
    const expiryYear = callback.expiryYear ?? 2099;

    // Check if user already has a card with this token (avoid duplicates)
    const { data: existingCard } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("card_token", effectiveCardToken)
      .eq("is_active", true)
      .single();

    if (existingCard) {
      console.log("Card token already exists for user, updating last_used");
      await supabase
        .from("payment_methods")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", existingCard.id);

      processingNotes = "Card token already exists - updated last_used";

      // Clean up pending if exists
      if (existingMethodId) {
        await supabase
          .from("payment_methods")
          .delete()
          .eq("id", existingMethodId);
      }

      // Save transaction
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        bookingId,
        existingCard.id,
        processingNotes,
      );

      await processReversal(callback);
      return okText();
    }

    // Handle follow-up callbacks (e.g., second 3DS callback with recurring_token)
    // If we found an existing payment method that needs the recurring_token, update it
    if (existingMethodNeedsRecurringToken && callback.recurringToken) {
      console.log("Updating existing payment method with recurring_token:", {
        methodId: existingMethodNeedsRecurringToken,
        recurringToken: callback.recurringToken.substring(0, 10) + "...",
      });

      const { error: updateError } = await supabase
        .from("payment_methods")
        .update({
          recurring_token: callback.recurringToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMethodNeedsRecurringToken);

      if (updateError) {
        console.error("Failed to update recurring_token:", updateError);
        // Save transaction with error
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          bookingId,
          existingMethodNeedsRecurringToken,
          `Failed to update recurring_token: ${updateError.message}`,
        );
        return errorText(500);
      }

      console.log("Recurring token updated successfully");
      // Save transaction
      await savePaymentTransaction(
        supabase,
        callback,
        rawPayload,
        isValidHash,
        userId,
        bookingId,
        existingMethodNeedsRecurringToken,
        "Follow-up callback - recurring_token updated successfully",
      );
      await processReversal(callback);
      return okText();
    }

    // Check if user has any active default card
    const { data: defaultCard } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    const shouldBeDefault = !defaultCard;

    // Update or insert the payment method
    // Extract recurring_init_trans_id from checkout callback or fallback to legacy/transId/paymentId
    const recurringInitTransId =
      (typeof callback.checkout?.recurring_init_trans_id === "string"
        ? callback.checkout.recurring_init_trans_id
        : null) ||
      (typeof callback.legacy?.recurring_init_trans_id === "string"
        ? callback.legacy.recurring_init_trans_id
        : null) ||
      callback.transId ||
      callback.paymentId ||
      null;

    // Use the recurring_token for recurring charges
    // In Checkout Integration, recurring_token is the primary token
    const effectiveRecurringToken = callback.recurringToken ||
      effectiveCardToken;

    console.log("Saving payment method tokens:", {
      hasCardToken: !!callback.cardToken,
      hasRecurringToken: !!callback.recurringToken,
      effectiveCardToken,
      effectiveRecurringToken,
      recurringInitTransId,
    });

    // Extract card name from custom_data
    const cardName =
      (typeof (callback.checkout?.custom_data as any)?.card_name === "string"
        ? (callback.checkout?.custom_data as any).card_name
        : null) ||
      (typeof (callback.s2s?.custom_data as any)?.card_name === "string"
        ? (callback.s2s?.custom_data as any).card_name
        : null) ||
      (typeof (callback.customData as any)?.card_name === "string"
        ? (callback.customData as any).card_name
        : null) ||
      null;

    let paymentMethodId: string | null = null;

    if (existingMethodId) {
      // Update the pending record
      // If cardName exists in callback, update it. Otherwise keep existing.
      const updatePayload: any = {
        card_token: effectiveCardToken,
        recurring_token: effectiveRecurringToken,
        recurring_init_trans_id: recurringInitTransId,
        card_mask: cardMask,
        card_brand: cardBrand,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        is_default: shouldBeDefault,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (cardName) {
        updatePayload.name = cardName;
      }

      const { error: updateError } = await supabase
        .from("payment_methods")
        .update(updatePayload)
        .eq("id", existingMethodId);

      if (updateError) {
        console.error("Failed to update payment method:", updateError);
        // Save transaction with error
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          bookingId,
          existingMethodId,
          `Failed to update payment method: ${updateError.message}`,
        );
        return errorText(500);
      }

      paymentMethodId = existingMethodId;
      processingNotes = "Payment method updated from pending to active";
    } else {
      // Insert new record
      const { data: insertedMethod, error: insertError } = await supabase
        .from("payment_methods")
        .insert({
          user_id: userId,
          card_token: effectiveCardToken,
          recurring_token: effectiveRecurringToken,
          recurring_init_trans_id: recurringInitTransId,
          card_mask: cardMask,
          card_brand: cardBrand,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          is_default: shouldBeDefault,
          is_active: true,
          name: cardName, // Save card name
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert payment method:", insertError);
        // Save transaction with error
        await savePaymentTransaction(
          supabase,
          callback,
          rawPayload,
          isValidHash,
          userId,
          bookingId,
          null,
          `Failed to insert payment method: ${insertError.message}`,
        );
        return errorText(500);
      }

      paymentMethodId = insertedMethod?.id || null;
      processingNotes = "New payment method created successfully";
    }

    console.log("Payment method saved successfully for user:", userId);

    // Save transaction with success
    await savePaymentTransaction(
      supabase,
      callback,
      rawPayload,
      isValidHash,
      userId,
      bookingId,
      paymentMethodId,
      processingNotes,
    );

    // If this was a card verification charge (TOKEN-), initiate a reversal (Void or Refund)
    await processReversal(callback);

    return okText();
  } catch (error) {
    console.error("montypay-callback error:", error);
    return errorText(500);
  }
});
