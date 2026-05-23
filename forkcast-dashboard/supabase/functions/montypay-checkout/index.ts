// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: montypay-checkout
// Creates a MontyPay hosted checkout session for card tokenization
// Returns the redirect URL to open in expo-web-browser

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// MontyPay configuration
const MONTYPAY_API_URL = "https://checkout.montypay.com/api/v1/session";
const MONTYPAY_MERCHANT_KEY = Deno.env.get("MONTYPAY_MERCHANT_KEY")!;
const MONTYPAY_PASSWORD = Deno.env.get("MONTYPAY_PASSWORD")!;

// App deep link for redirect after checkout
const APP_DEEP_LINK_BASE = Deno.env.get("APP_DEEP_LINK_BASE") || "plate://";

interface CheckoutRequest {
  booking_id?: string; // Optional - if adding card during booking
  return_path?: string; // Optional - custom return path after checkout
  amount?: string; // Optional - custom amount for event payments
  description?: string; // Optional - custom description for event payments
  guest_name?: string; // Optional - guest name for event payments
  guest_email?: string; // Optional - guest email for event payments
  guest_phone?: string; // Optional - guest phone for manual bookings
  is_event_payment?: boolean; // Flag to indicate event payment (no card tokenization)
  is_widget_guarantee?: boolean; // Flag to indicate widget card guarantee (tokenization for guest)
  no_show_fee?: number; // No-show fee amount for widget guarantee
  cancellation_fee?: number; // Cancellation fee amount for widget guarantee
  fee_type?: "per_cover" | "fixed"; // Fee type for widget guarantee
  party_size?: number; // Party size for widget guarantee
  card_name?: string; // Optional - card name for tokenization
  source?: "manual"; // Optional - indicates manual booking from restaurant dashboard
}

interface MontyPaySessionRequest {
  merchant_key: string;
  operation: string;
  cancel_url: string;
  success_url: string;
  notification_url: string;
  order: {
    number: string;
    amount: string;
    currency: string;
    description: string;
  };
  customer?: {
    name?: string;
    email?: string;
  };
  req_token: boolean;
  recurring_init: boolean;
  hash: string;
}

function json(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

// Compute MontyPay hash signature
// hash = SHA1(MD5(uppercase(order.number + order.amount + order.currency + order.description + PASSWORD)))
async function computeHash(
  orderNumber: string,
  amount: string,
  currency: string,
  description: string,
  password: string,
): Promise<string> {
  const data = (
    orderNumber +
    amount +
    currency +
    description +
    password
  ).toUpperCase();

  // Compute MD5 hash
  const encoder = new TextEncoder();
  const md5Data = encoder.encode(data);
  const md5Buffer = await crypto.subtle.digest("MD5", md5Data);
  const md5Hex = encodeHex(new Uint8Array(md5Buffer));

  // Compute SHA-1 hash of the MD5 hex string
  const sha1Data = encoder.encode(md5Hex);
  const sha1Buffer = await crypto.subtle.digest("SHA-1", sha1Data);
  const sha1Hex = encodeHex(new Uint8Array(sha1Buffer));

  return sha1Hex;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // Log environment configuration (masked)
    console.log("[montypay-checkout] Environment check:");
    console.log("- SUPABASE_URL:", SUPABASE_URL ? "✓ Set" : "✗ Missing");
    console.log(
      "- SERVICE_ROLE_KEY:",
      SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing",
    );
    console.log(
      "- MONTYPAY_MERCHANT_KEY:",
      MONTYPAY_MERCHANT_KEY ? "✓ Set" : "✗ Missing",
    );
    console.log(
      "- MONTYPAY_PASSWORD:",
      MONTYPAY_PASSWORD ? "✓ Set" : "✗ Missing",
    );
    console.log("- APP_DEEP_LINK_BASE:", APP_DEEP_LINK_BASE);

    // Check for missing required environment variables
    if (!MONTYPAY_MERCHANT_KEY || !MONTYPAY_PASSWORD) {
      console.error(
        "[montypay-checkout] ❌ Missing required MontyPay credentials",
      );
      return json(500, {
        error: "Payment configuration error",
        details:
          "Missing payment provider credentials. Please contact support.",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Parse request body first to check for event payment
    const body: CheckoutRequest = await req.json().catch(() => ({}));

    // Determine if this is a guest event payment or authenticated user
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    let userId: string | null = null;
    let customerName: string | null = null;
    let customerEmail: string | null = null;

    if (jwt) {
      // Authenticated user flow
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(jwt);

      if (!authError && user) {
        userId = user.id;
        console.log("[montypay-checkout] ✓ User authenticated:", user.id);

        // Get user profile for customer info
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();

        customerName = profile?.full_name || null;
        customerEmail = profile?.email || null;
      }
    }

    // Check if this is an event payment (guest allowed)
    const isEventPayment = body.is_event_payment === true && body.booking_id;
    
    // Check if this is a widget guarantee (guest card tokenization)
    const isWidgetGuarantee = body.is_widget_guarantee === true && body.booking_id;
    
    // Check if this is a manual booking from restaurant dashboard
    const isManualBooking = body.source === "manual" && body.booking_id;

    if (!userId && !isEventPayment && !isWidgetGuarantee && !isManualBooking) {
      console.error(
        "[montypay-checkout] ❌ No authorized user and not an event payment, widget guarantee, or manual booking",
      );
      return json(401, { error: "Authorization required" });
    }

    // For event payments, use guest info
    if (isEventPayment) {
      customerName = body.guest_name || null;
      customerEmail = body.guest_email || null;
      console.log(
        "[montypay-checkout] ✓ Guest event payment for booking:",
        body.booking_id,
      );
    }
    
    // For widget guarantee, use guest info
    if (isWidgetGuarantee) {
      customerName = body.guest_name || null;
      customerEmail = body.guest_email || null;
      console.log(
        "[montypay-checkout] ✓ Widget guarantee for booking:",
        body.booking_id,
      );
    }
    
    // For manual booking, use guest info
    if (isManualBooking) {
      customerName = body.guest_name || null;
      customerEmail = body.guest_email || null;
      console.log(
        "[montypay-checkout] ✓ Manual booking payment for booking:",
        body.booking_id,
        "type:",
        isEventPayment ? "deposit" : "guarantee",
      );
    }

    // Generate unique order number
    // Use different prefixes based on payment type and source:
    // - MANUAL-DEPOSIT-: Manual booking deposit payment (actual charge)
    // - MANUAL-GUARANTEE-: Manual booking card guarantee (tokenization, will be voided)
    // - EVENT-: Widget event deposit payment (actual charge)
    // - WIDGET-GUARANTEE-: Widget card guarantee (tokenization, will be voided)
    // - TOKEN-: App user card tokenization (will be voided)
    let orderPrefix: string;
    if (isManualBooking) {
      // Manual booking: use MANUAL-DEPOSIT- for deposits, MANUAL-GUARANTEE- for card guarantees
      orderPrefix = isEventPayment ? "MANUAL-DEPOSIT" : "MANUAL-GUARANTEE";
    } else if (isEventPayment) {
      orderPrefix = "EVENT";
    } else if (isWidgetGuarantee) {
      orderPrefix = "WIDGET-GUARANTEE";
    } else {
      orderPrefix = "TOKEN";
    }
    const orderIdentifier = userId
      ? userId.substring(0, 8)
      : body.booking_id?.substring(0, 8) || "GUEST";
    const orderNumber = `${orderPrefix}-${orderIdentifier}-${Date.now()}`;

    // Determine amount and description
    // For deposit payments (event or manual), use provided amount
    // For card guarantees (widget or manual) and tokenization, use $1.00 (will be voided)
    let amount: string;
    let description: string;

    if (isManualBooking && isEventPayment && body.amount) {
      // Manual deposit payment - actual charge
      const amountNum = parseFloat(body.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return json(400, { error: "Invalid amount" });
      }
      amount = amountNum.toFixed(2);
      description = body.description || "Booking deposit payment";
    } else if (isManualBooking && !isEventPayment) {
      // Manual card guarantee - card verification (will be voided)
      amount = "1.00";
      description = "Card verification for booking guarantee";
    } else if (isEventPayment && body.amount) {
      // Widget event deposit payment - actual charge
      const amountNum = parseFloat(body.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return json(400, { error: "Invalid amount" });
      }
      amount = amountNum.toFixed(2);
      description = body.description || "Event booking payment";
    } else if (isWidgetGuarantee) {
      // Widget guarantee - card verification (will be voided)
      amount = "1.00";
      description = "Card verification for booking guarantee";
    } else {
      // Card tokenization - minimal amount (will be voided)
      amount = "1.00";
      description = "Card verification for Plate";
    }

    const currency = "USD";

    // Compute hash signature
    const hash = await computeHash(
      orderNumber,
      amount,
      currency,
      description,
      MONTYPAY_PASSWORD,
    );

    // Build redirect URLs - using plate-app.com for reliable HTML rendering
    const returnPath = body.booking_id
      ? `booking/${body.booking_id}`
      : body.return_path || "profile/payment-methods";

    // Use custom domain for redirect pages (Supabase edge functions have HTML rendering issues)
    // Dynamic pages based on payment type
    let SUCCESS_PAGE: string;
    let FAILED_PAGE: string;
    
    if (isManualBooking) {
      // Manual bookings use plate-app.com pages for consistency
      // isEventPayment = true means deposit, otherwise it's a card guarantee
      if (isEventPayment) {
        SUCCESS_PAGE = "https://plate-app.com/manual-deposit-success";
        FAILED_PAGE = "https://plate-app.com/manual-deposit-failed";
      } else {
        SUCCESS_PAGE = "https://plate-app.com/manual-guarantee-success";
        FAILED_PAGE = "https://plate-app.com/manual-guarantee-failed";
      }
    } else if (isEventPayment) {
      SUCCESS_PAGE = "https://plate-app.com/event-payment-success";
      FAILED_PAGE = "https://plate-app.com/event-payment-failed";
    } else if (isWidgetGuarantee) {
      SUCCESS_PAGE = "https://plate-app.com/widget-guarantee-success";
      FAILED_PAGE = "https://plate-app.com/widget-guarantee-failed";
    } else {
      SUCCESS_PAGE = "https://plate-app.com/card-success";
      FAILED_PAGE = "https://plate-app.com/card-failed";
    }

    // Pass status and path parameters so the pages can construct the deep link back to the app
    // For widget guarantees, include booking_id and guest/restaurant names for confirmation display
    let successUrl: string;
    let cancelUrl: string;
    
    if (isManualBooking) {
      // Manual booking - redirect to web confirmation page with booking details
      const paymentType = isEventPayment ? "deposit" : "guarantee";
      const successParams = new URLSearchParams({
        status: "success",
        booking_id: body.booking_id || "",
        type: paymentType,
      });
      const failedParams = new URLSearchParams({
        status: "cancelled",
        booking_id: body.booking_id || "",
        type: paymentType,
      });
      
      successUrl = `${SUCCESS_PAGE}?${successParams.toString()}`;
      cancelUrl = `${FAILED_PAGE}?${failedParams.toString()}`;
    } else if (isWidgetGuarantee) {
      // Get restaurant name for display on success page
      let restaurantName = "Restaurant";
      if (body.booking_id) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("restaurant:restaurants(name)")
          .eq("id", body.booking_id)
          .single();
        restaurantName = (booking?.restaurant as any)?.name || "Restaurant";
      }
      
      const successParams = new URLSearchParams({
        status: "success",
        restaurant: restaurantName,
        guest: customerName || "Guest",
      });
      const failedParams = new URLSearchParams({
        status: "cancelled",
        restaurantId: body.booking_id ? body.booking_id.substring(0, 36) : "",
      });
      
      successUrl = `${SUCCESS_PAGE}?${successParams.toString()}`;
      cancelUrl = `${FAILED_PAGE}?${failedParams.toString()}`;
    } else {
      successUrl = `${SUCCESS_PAGE}?status=success&path=${encodeURIComponent(returnPath)}`;
      cancelUrl = `${FAILED_PAGE}?status=cancelled&path=${encodeURIComponent(returnPath)}`;
    }


    // Callback URL for MontyPay to send token data
    const notificationUrl = `${SUPABASE_URL}/functions/v1/montypay-callback`;

    // Build MontyPay session request
    // For deposit payments (event or manual deposit), we don't need recurring tokens (actual charge)
    // For card guarantees (widget or manual guarantee) and tokenization, we need tokens
    const isDepositPayment = isEventPayment; // true for both EVENT- and MANUAL-DEPOSIT-
    const needsTokenization = !isDepositPayment; // TOKEN-, WIDGET-GUARANTEE-, and MANUAL-GUARANTEE- need tokens
    
    const sessionRequest: MontyPaySessionRequest & {
      custom_data?: Record<string, string>;
    } = {
      merchant_key: MONTYPAY_MERCHANT_KEY,
      operation: "purchase",
      cancel_url: cancelUrl,
      success_url: successUrl,
      notification_url: notificationUrl,
      order: {
        number: orderNumber,
        amount: amount,
        currency: currency,
        description: description,
      },
      req_token: needsTokenization, // Request token for card tokenization and widget guarantees
      recurring_init: needsTokenization, // Init recurring for card tokenization and widget guarantees
      hash: hash,
    };

    // Add custom data for callback processing
    sessionRequest.custom_data = {};

    if (body.booking_id) {
      sessionRequest.custom_data.booking_id = body.booking_id;
    }

    if (isEventPayment) {
      sessionRequest.custom_data.is_event_payment = "true";
    }
    
    if (isWidgetGuarantee) {
      sessionRequest.custom_data.is_widget_guarantee = "true";
      // Include fee information for booking_guarantees record
      sessionRequest.custom_data.no_show_fee = String(body.no_show_fee || 0);
      sessionRequest.custom_data.cancellation_fee = String(body.cancellation_fee || 0);
      sessionRequest.custom_data.fee_type = body.fee_type || "per_cover";
      sessionRequest.custom_data.party_size = String(body.party_size || 1);
      // Include guest info for payment_methods record
      if (customerName) sessionRequest.custom_data.guest_name = customerName;
      if (customerEmail) sessionRequest.custom_data.guest_email = customerEmail;
    }
    
    if (isManualBooking) {
      sessionRequest.custom_data.source = "manual";
      sessionRequest.custom_data.payment_type = isEventPayment ? "deposit" : "guarantee";
      // Include fee information for manual guarantees
      if (!isEventPayment) {
        sessionRequest.custom_data.no_show_fee = String(body.no_show_fee || 0);
        sessionRequest.custom_data.cancellation_fee = String(body.cancellation_fee || 0);
        sessionRequest.custom_data.fee_type = body.fee_type || "per_cover";
        sessionRequest.custom_data.party_size = String(body.party_size || 1);
      }
      // Include guest info
      if (customerName) sessionRequest.custom_data.guest_name = customerName;
      if (customerEmail) sessionRequest.custom_data.guest_email = customerEmail;
      if (body.guest_phone) sessionRequest.custom_data.guest_phone = body.guest_phone;
    }

    // Add card name to custom_data if provided (for tokenization)
    if (body.card_name) {
      sessionRequest.custom_data.card_name = body.card_name;
    }

    // Add customer info if available
    if (customerName || customerEmail) {
      sessionRequest.customer = {
        name: customerName || undefined,
        email: customerEmail || undefined,
      };
    }

    console.log("[montypay-checkout] Creating MontyPay session:");
    console.log("- User ID:", userId || "Guest");
    console.log("- Order number:", orderNumber);
    console.log("- Is event payment:", isEventPayment);
    console.log("- Is widget guarantee:", isWidgetGuarantee);
    console.log("- Is manual booking:", isManualBooking);
    console.log("- Amount:", amount);
    console.log("- Needs tokenization:", needsTokenization);
    console.log("- Request payload:", JSON.stringify(sessionRequest, null, 2));

    // Call MontyPay API
    console.log("[montypay-checkout] Calling MontyPay API:", MONTYPAY_API_URL);
    const montyPayResponse = await fetch(MONTYPAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionRequest),
    });

    console.log(
      "[montypay-checkout] MontyPay response status:",
      montyPayResponse.status,
    );
    const montyPayData = await montyPayResponse.json();
    console.log(
      "[montypay-checkout] MontyPay response data:",
      JSON.stringify(montyPayData, null, 2),
    );

    // Check for success - MontyPay returns redirect_url on success, or error_code on failure
    const isSuccess = montyPayResponse.ok && montyPayData.redirect_url;

    if (!isSuccess) {
      console.error("[montypay-checkout] ❌ MontyPay session creation failed:");
      return json(400, {
        error: "Failed to create payment session",
        details: montyPayData.error_message ||
          montyPayData.message ||
          "Unknown error from payment provider",
      });
    }

    console.log("[montypay-checkout] ✅ MontyPay session created successfully");

    // Only create pending payment method record for authenticated user tokenization 
    // (not event payments, widget guarantees, or manual bookings - those are handled in callback)
    if (!isEventPayment && !isWidgetGuarantee && !isManualBooking && userId) {
      const { error: insertError } = await supabase
        .from("payment_methods")
        .insert({
          user_id: userId,
          card_token: `pending:${orderNumber}`,
          card_mask: "pending",
          expiry_month: 1,
          expiry_year: 2099,
          is_active: false,
          name: null,
        });

      if (insertError) {
        console.error(
          "[montypay-checkout] ⚠️ Failed to create pending payment method:",
          insertError,
        );
      } else {
        console.log("[montypay-checkout] ✓ Pending payment method created");
      }
    }

    // Return the checkout URL for the app to open
    console.log("[montypay-checkout] ✅ Session created successfully");
    console.log("[montypay-checkout] Redirect URL:", montyPayData.redirect_url);
    return json(200, {
      success: true,
      redirect_url: montyPayData.redirect_url,
      order_number: orderNumber,
    });
  } catch (error) {
    console.error("[montypay-checkout] ❌ Unhandled error:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return json(500, {
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
