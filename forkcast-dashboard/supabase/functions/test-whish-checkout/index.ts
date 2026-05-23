// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: test-whish-checkout
// Creates a Whish payment session for event bookings AND manual deposit bookings
// Returns the collectUrl to open in browser

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Whish configuration
const WHISH_API_URL = "https://api.whish.money/itel-service/api";

const WHISH_CHANNEL = Deno.env.get("WHISH_CHANNEL")!;
const WHISH_SECRET = Deno.env.get("WHISH_SECRET")!;
const WHISH_WEBSITE_URL = "plate-app.com";
const PLATE_SECRET_KEY = Deno.env.get("PLATE_SECRET_KEY");

interface CheckoutRequest {
  booking_id: string;
  // For manual deposit bookings:
  source?: "manual" | "event"; // 'manual' for manual bookings, 'event' or undefined for event bookings
  amount?: string; // Total amount including service fee (for manual deposits)
  deposit_amount?: string; // Base deposit amount before service fee
  service_fee_amount?: string; // Service fee amount
  service_fee_percentage?: number; // Service fee percentage
  description?: string; // Custom description for the payment
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
}

interface WhishPaymentRequest {
  amount: number;
  currency: "USD";
  invoice: string;
  externalId: number;
  successCallbackUrl: string;
  failureCallbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
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
    // Log environment configuration
    console.log("[whish-checkout] Environment check:");
    console.log("- WHISH_API_URL:", WHISH_API_URL);
    console.log("- WHISH_CHANNEL:", WHISH_CHANNEL ? "✓ Set" : "✗ Missing");
    console.log("- WHISH_SECRET:", WHISH_SECRET ? "✓ Set" : "✗ Missing");

    if (!WHISH_CHANNEL || !WHISH_SECRET) {
      console.error("[whish-checkout] ❌ Missing Whish credentials");
      return json(500, {
        error: "Payment configuration error",
        details: "Missing payment provider credentials. Please contact support.",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body: CheckoutRequest = await req.json();

    // Validate required fields
    if (!body.booking_id) {
      return json(400, {
        error: "Missing required fields",
        details: "booking_id is required",
      });
    }

    const isManualDeposit = body.source === "manual";
    console.log("[whish-checkout] Payment type:", isManualDeposit ? "MANUAL DEPOSIT" : "EVENT BOOKING");

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        confirmation_code,
        guest_name,
        guest_email,
        guest_phone,
        party_size,
        booking_time,
        payment_amount,
        payment_status,
        status,
        is_event_booking,
        event_occurrence_id,
        restaurant:restaurants(id, name, whish_service_fee_percentage),
        event_occurrence:event_occurrences(
          id,
          occurrence_date,
          start_time,
          override_price,
          event:restaurant_events(
            id,
            title,
            price_per_person,
            service_charge_percentage,
            service_charge_percentage_whish
          )
        )
      `)
      .eq("id", body.booking_id)
      .single();

    if (bookingError || !booking) {
      console.error("[whish-checkout] Booking not found:", bookingError);
      return json(404, { error: "Booking not found" });
    }

    // Check if payment is already completed
    if (booking.payment_status === "paid") {
      console.error("[whish-checkout] Payment already completed");
      return json(400, {
        error: "Payment already completed",
        details: "This booking has already been paid",
      });
    }

    let totalAmount: number;
    let subtotal: number;
    let serviceCharge: number;
    let invoice: string;
    let paymentSource: string;
    let successRedirectUrl: string;
    let failureRedirectUrl: string;

    const restaurantName = (booking.restaurant as any)?.name || "Restaurant";
    const restaurantWhishFeePercent = (booking.restaurant as any)?.whish_service_fee_percentage || 1; // Default 1%

    if (isManualDeposit) {
      // ============================================
      // MANUAL DEPOSIT BOOKING
      // ============================================
      console.log("[whish-checkout] Processing manual deposit booking");

      // Validate amount or deposit_amount is provided for manual deposits
      if (!body.amount && !body.deposit_amount) {
        return json(400, {
          error: "Missing required fields",
          details: "amount or deposit_amount is required for manual deposit bookings",
        });
      }

      // If amount is provided, use it directly (already includes service fee from frontend)
      // If only deposit_amount is provided, calculate service fee using restaurant's whish_service_fee_percentage
      if (body.amount) {
        totalAmount = parseFloat(body.amount);
        subtotal = parseFloat(body.deposit_amount || body.amount);
        serviceCharge = parseFloat(body.service_fee_amount || "0");
      } else {
        // Calculate service fee from deposit amount using restaurant's Whish fee percentage
        subtotal = parseFloat(body.deposit_amount!);
        serviceCharge = (subtotal * restaurantWhishFeePercent) / 100;
        totalAmount = subtotal + serviceCharge;
      }

      if (isNaN(totalAmount) || totalAmount <= 0) {
        return json(400, {
          error: "Invalid amount",
          details: "Amount must be a positive number",
        });
      }

      // Build invoice description
      const feePercent = body.service_fee_percentage || restaurantWhishFeePercent;
      invoice = serviceCharge > 0
        ? body.description || `Deposit $${subtotal.toFixed(2)} + Service Fee $${serviceCharge.toFixed(2)} (${feePercent}%) at ${restaurantName}`
        : body.description || `Deposit for booking at ${restaurantName}`;
      paymentSource = "manual_deposit";

      console.log("[whish-checkout] Manual deposit details:");
      console.log("- Deposit amount:", subtotal);
      console.log("- Service fee (", feePercent, "%):", serviceCharge);
      console.log("- Total amount:", totalAmount);

      // Redirect URLs for manual deposits
      successRedirectUrl = `https://www.plate-app.com/deposit-payment-success?status=success&booking_id=${body.booking_id}`;
      failureRedirectUrl = `https://www.plate-app.com/deposit-payment-failed?status=cancelled&booking_id=${body.booking_id}`;

    } else {
      // ============================================
      // EVENT BOOKING (original logic)
      // ============================================
      console.log("[whish-checkout] Processing event booking");

      // Verify this is an event booking
      if (!booking.is_event_booking || !booking.event_occurrence_id) {
        console.error("[whish-checkout] Not an event booking");
        return json(400, {
          error: "Invalid booking type",
          details: "This endpoint only supports event bookings. Use source='manual' for regular deposit payments.",
        });
      }

      // Calculate payment amount from event pricing
      const eventOccurrence = booking.event_occurrence as any;
      const event = eventOccurrence?.event as any;

      if (!event) {
        console.error("[whish-checkout] Event details not found");
        return json(404, { error: "Event details not found" });
      }

      const pricePerPerson = event.price_per_person || 0;
      console.log("price per person: ", pricePerPerson);

      if (pricePerPerson <= 0) {
        console.error("[whish-checkout] Invalid event pricing");
        return json(400, {
          error: "Invalid event pricing",
          details: "Event does not have valid pricing configured",
        });
      }

      // Calculate total: (price per person * party size) + service charge
      subtotal = pricePerPerson * booking.party_size;
      const serviceChargePercent = event.service_charge_percentage_whish || 1.0;
      serviceCharge = (subtotal * serviceChargePercent) / 100;
      totalAmount = subtotal + serviceCharge;

      const eventTitle = event.title || "Event";
      invoice = `${eventTitle} at ${restaurantName} - ${booking.party_size} guest${booking.party_size > 1 ? "s" : ""}`;
      paymentSource = "event_widget";

      successRedirectUrl = `https://www.plate-app.com/event-payment-success?status=success&path=booking/${body.booking_id}`;
      failureRedirectUrl = `https://www.plate-app.com/event-payment-failed?status=cancelled&path=booking/${body.booking_id}`;

      console.log("[whish-checkout] Event payment calculation:");
      console.log("- Price per person:", pricePerPerson);
      console.log("- Party size:", booking.party_size);
      console.log("- Subtotal:", subtotal);
      console.log("- Service charge (", event.service_charge_percentage_whish, "%):", serviceCharge);
      console.log("- Total amount:", totalAmount);
    }

    // Generate unique externalId (numeric timestamp)
    const externalId = Date.now();
    const currency = "USD";

    // Build callback URLs (same for both types - callback handles the logic)
    const callbackBaseUrl = `${SUPABASE_URL}/functions/v1/test-whish-callback`;
    const successCallbackUrl = `${callbackBaseUrl}?booking_id=${body.booking_id}&status=success&externalId=${externalId}&source=${paymentSource}&key=${PLATE_SECRET_KEY}`;
    const failureCallbackUrl = ``;

    // Build Whish payment request
    const whishRequest: WhishPaymentRequest = {
      amount: Number(totalAmount.toFixed(2)),
      currency: currency,
      invoice: invoice,
      externalId: externalId,
      successCallbackUrl: successCallbackUrl,
      failureCallbackUrl: failureCallbackUrl,
      successRedirectUrl: successRedirectUrl,
      failureRedirectUrl: failureRedirectUrl,
    };

    console.log("[whish-checkout] Creating Whish payment:");
    console.log("- Booking ID:", body.booking_id);
    console.log("- External ID:", externalId);
    console.log("- Amount:", totalAmount.toFixed(2), currency);
    console.log("- Invoice:", invoice);
    console.log("- Guest:", booking.guest_name);
    console.log("- Party size:", booking.party_size);
    console.log("- Source:", paymentSource);

    // Call Whish API
    const whishResponse = await fetch(`${WHISH_API_URL}/payment/whish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        channel: WHISH_CHANNEL,
        secret: WHISH_SECRET,
        websiteUrl: WHISH_WEBSITE_URL,
        "User-Agent":
          "Whish/1.0 (https://plate-app.com; charbel.azzy@hotmail.com)",
      },
      body: JSON.stringify(whishRequest),
    });

    const whishData = await whishResponse.json();
    console.log(
      "[whish-checkout] Whish response:",
      JSON.stringify(whishData, null, 2)
    );

    // Check for success
    if (!whishResponse.ok || !whishData.status || !whishData.data?.collectUrl) {
      console.error("[whish-checkout] ❌ Whish payment creation failed");
      return json(400, {
        error: "Failed to create payment session",
        details:
          whishData.dialog?.message ||
          whishData.code ||
          "Unknown error from payment provider",
      });
    }

    // ---------------------------------------------------------
    // 1. Insert into whish_transactions table
    // ---------------------------------------------------------
    const { error: transactionError } = await supabase
      .from("whish_transactions")
      .insert({
        booking_id: body.booking_id,
        external_id: externalId.toString(),
        amount: totalAmount,
        subtotal: subtotal,
        service_charge: serviceCharge,
        currency: currency,
        status: "pending",
        whish_collect_url: whishData.data.collectUrl,
        response_metadata: whishData,
      });

    if (transactionError) {
      console.error(
        "[whish-checkout] ❌ Failed to insert whish_transaction:",
        transactionError
      );
    }

    // ---------------------------------------------------------
    // 2. Update booking status
    // ---------------------------------------------------------
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        payment_reference: `whish:${externalId}`,
        payment_status: "pending",
        payment_amount: totalAmount,
      })
      .eq("id", body.booking_id);

    if (updateError) {
      console.error("[whish-checkout] ⚠️ Failed to update booking:", updateError);
    }

    console.log("[whish-checkout] ✅ Payment session created successfully");
    console.log("[whish-checkout] Collect URL:", whishData.data.collectUrl);

    return json(200, {
      success: true,
      collect_url: whishData.data.collectUrl,
      external_id: externalId,
      payment_source: paymentSource,
      payment_details: {
        amount: totalAmount.toFixed(2),
        currency: currency,
        subtotal: subtotal.toFixed(2),
        service_charge: serviceCharge.toFixed(2),
        party_size: booking.party_size,
      },
    });
  } catch (error) {
    console.error("[whish-checkout] ❌ Unhandled error:", {
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
