// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: charge-penalty

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

// --- Configuration ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// MontyPay Configuration
// Using the Checkout API endpoint for Recurring
const MONTYPAY_API_URL =
  "https://checkout.montypay.com/api/v1/payment/recurring";
const MERCHANT_KEY = Deno.env.get("MONTYPAY_MERCHANT_KEY")!;
const MERCHANT_PASS = Deno.env.get("MONTYPAY_PASSWORD")!;

// --- Helpers ---
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

async function computeRecurringHash(
  initialTransactionId: string,
  recurringToken: string,
  orderNumber: string,
  amount: string,
  description: string,
  password: string,
): Promise<string> {
  const encoder = new TextEncoder();

  // 1. Concatenate and UpperCase the INPUT string
  // Formula: strtoupper(id . token . order . amount . desc . pass)
  const rawString = (
    initialTransactionId +
    recurringToken +
    orderNumber +
    amount +
    description +
    password
  ).toUpperCase();

  // 2. MD5 Calculation
  const md5Data = encoder.encode(rawString);
  const md5Buffer = await crypto.subtle.digest("MD5", md5Data);

  // --- THE FIX IS HERE ---
  // The result of MD5 must be a LOWERCASE hex string before passing to SHA1.
  // Standard md5() functions return lowercase.
  const md5Hex = encodeHex(new Uint8Array(md5Buffer)); // Removed .toUpperCase()

  // 3. SHA1 Calculation
  // SHA1 hashes the MD5 Hex String
  const sha1Data = encoder.encode(md5Hex);
  const sha1Buffer = await crypto.subtle.digest("SHA-1", sha1Data);

  // 4. Return Final Hex
  return encodeHex(new Uint8Array(sha1Buffer));
}

Deno.serve(async (req) => {
  // CORS
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

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Auth Check
    const authHeader = req.headers.get("Authorization") || "";
    let _isServiceCall = false;
    let staffUserId: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token === Deno.env.get("EDGE_FUNCTION_SECRET")) {
        _isServiceCall = true;
      } else {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return json(401, { error: "Invalid authorization token" });
        staffUserId = user.id;
      }
    } else {
      return json(401, { error: "Authorization required" });
    }

    const body = await req.json();

    // Validate Input
    if (!body.booking_guarantee_id) {
      return json(400, { error: "booking_guarantee_id required" });
    }
    if (!body.reason) return json(400, { error: "reason required" });

    // Fetch Guarantee
    const { data: guarantee, error: guaranteeError } = await supabase
      .from("booking_guarantees")
      .select(
        `*, booking:bookings(id, restaurant_id, user_id, confirmation_code, party_size, restaurant:restaurants(name)), payment_method:payment_methods(recurring_token, recurring_init_trans_id, card_mask)`,
      )
      .eq("id", body.booking_guarantee_id)
      .single();

    if (guaranteeError || !guarantee) {
      return json(404, { error: "Guarantee not found" });
    }

    // Waiver Logic
    if (body.waive) {
      if (!body.waiver_reason) {
        return json(400, { error: "Waiver reason required" });
      }
      await supabase.from("booking_guarantees").update({
        status: "waived",
        waiver_reason: body.waiver_reason,
        waived_at: new Date().toISOString(),
      }).eq("id", guarantee.id);

      // Log Waiver
      const waivedAmount = 0; // Simplified for brevity
      await supabase.from("penalty_transactions").insert({
        booking_guarantee_id: guarantee.id,
        booking_id: guarantee.booking.id,
        restaurant_id: guarantee.booking.restaurant_id,
        user_id: guarantee.booking.user_id,
        transaction_type: "waiver",
        amount: waivedAmount,
        currency: "USD",
        reason: body.reason,
        initiated_by: body.initiated_by || staffUserId,
        notes: body.waiver_reason,
        montypay_status: "WAIVED",
      });
      return json(200, { success: true, waived: true });
    }

    const paymentMethod = guarantee.payment_method;
    const booking = guarantee.booking;

    if (
      !paymentMethod?.recurring_token || !paymentMethod?.recurring_init_trans_id
    ) {
      return json(400, { error: "Missing recurring token" });
    }

    // Fetch restaurant's service fee percentage
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("service_fee_percentage")
      .eq("id", booking.restaurant_id)
      .single();
    
    const serviceFeePercentage = restaurant?.service_fee_percentage || 0;

    // Calculate Base Fee Amount
    const baseFee = body.reason === "no_show"
      ? (guarantee.fee_type === "per_cover"
        ? guarantee.no_show_fee * (guarantee.party_size || booking.party_size)
        : guarantee.no_show_fee)
      : (guarantee.fee_type === "per_cover"
        ? guarantee.cancellation_fee *
          (guarantee.party_size || booking.party_size)
        : guarantee.cancellation_fee);

    // Calculate Service Fee
    const serviceFeeAmount = serviceFeePercentage > 0 
      ? baseFee * (serviceFeePercentage / 100) 
      : 0;
    
    // Total charge amount (base fee + service fee)
    const chargeAmount = baseFee + serviceFeeAmount;

    // Format Amount (Strict 2 decimals for hash consistency)
    const amountStr = chargeAmount.toFixed(2);

    // Generate Order Number
    // Pattern: PENALTY-{CONFIRMATION}-{TIMESTAMP}
    const orderNumber = `PENALTY-${
      booking.confirmation_code || booking.id.substring(0, 8)
    }-${Date.now()}`;
    const description = body.reason === "no_show"
      ? "No-show penalty"
      : "Late cancellation penalty";

    // 1. Generate Hash (Using the new Logic)
    const finalHash = await computeRecurringHash(
      paymentMethod.recurring_init_trans_id,
      paymentMethod.recurring_token,
      orderNumber,
      amountStr,
      description,
      MERCHANT_PASS,
    );

    // 2. Construct Payload (Matching the "Other AI" structure, but removing currency from order)
    const payload = {
      merchant_key: MERCHANT_KEY,
      recurring_init_trans_id: paymentMethod.recurring_init_trans_id,
      recurring_token: paymentMethod.recurring_token,
      hash: finalHash,
      order: {
        number: orderNumber,
        amount: amountStr, // Passing as string "20.00" (safer than float for API matching)
        description: description,
      },
      customer: {
        name: "Valued Customer", // Placeholder if we don't want to fetch user profile
        email: "customer@notqwerty.com",
      },
    };

    console.log("Sending Penalty Charge:", JSON.stringify(payload));

    // 3. Execute Fetch
    const montyPayResponse = await fetch(MONTYPAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await montyPayResponse.text();
    console.log("Gateway Response:", responseText);

    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { error_message: "Invalid JSON", raw: responseText };
    }

    // 4. Handle Result
    const statusUpper = (result.status || "").toUpperCase();
    const resultUpper = (result.result || "").toUpperCase();
    const isSuccess = statusUpper === "SETTLED" || statusUpper === "SUCCESS" ||
      resultUpper === "SUCCESS";

    // Log Transaction to DB (includes service fee breakdown in response)
    await supabase.from("penalty_transactions").insert({
      booking_guarantee_id: guarantee.id,
      booking_id: booking.id,
      restaurant_id: booking.restaurant_id,
      user_id: booking.user_id,
      transaction_type: "charge",
      amount: chargeAmount,
      currency: "USD",
      reason: body.reason,
      montypay_transaction_id: result.payment_id || result.trans_id || null,
      montypay_status: result.status || "UNKNOWN",
      montypay_response: {
        ...result,
        fee_breakdown: {
          base_fee: baseFee,
          service_fee_percentage: serviceFeePercentage,
          service_fee_amount: serviceFeeAmount,
          total_amount: chargeAmount,
        },
      },
      initiated_by: body.initiated_by || staffUserId,
      notes: body.notes,
    });

    if (isSuccess) {
      // Success Update
      await supabase.from("booking_guarantees").update({
        status: "charged",
        charge_reason: body.reason,
        charged_amount: chargeAmount,
        charged_at: new Date().toISOString(),
        montypay_payment_id: result.payment_id,
        updated_at: new Date().toISOString(),
      }).eq("id", guarantee.id);

      await supabase.from("payment_methods").update({
        last_used_at: new Date().toISOString(),
      }).eq("id", guarantee.payment_method_id);

      // --- Send Success Notification ---
      try {
        const chargingReason = body.reason === "no_show"
          ? "no-show"
          : "late cancellation";
        
        // Build message with service fee breakdown if applicable
        let message: string;
        if (serviceFeeAmount > 0) {
          message = `Your card was charged ${amountStr} USD for your reservation at ${booking.restaurant.name} due to ${chargingReason}. (Fee: $${baseFee.toFixed(2)} + Service Fee: $${serviceFeeAmount.toFixed(2)})`;
        } else {
          message = `Your card was charged ${amountStr} USD for your reservation at ${booking.restaurant.name} due to ${chargingReason}.`;
        }

        const { error: notifyErr } = await supabase.rpc(
          "enqueue_notification",
          {
            p_user_id: booking.user_id,
            p_category: "card_guarantee",
            p_type: "penalty_charged",
            p_title: "Card Charged",
            p_message: message,
            p_data: {
              booking_id: booking.id,
              amount: chargeAmount,
              base_fee: baseFee,
              service_fee_percentage: serviceFeePercentage,
              service_fee_amount: serviceFeeAmount,
              reason: body.reason,
              restaurant_name: booking.restaurant.name,
            },
            p_deeplink: `plate://booking/${booking.id}`,
          },
        );

        if (notifyErr) {
          console.error(`[charge-penalty] RPC Error (Success):`, notifyErr);
        } else {
          console.log(
            `[charge-penalty] Success notification enqueued for user ${booking.user_id}`,
          );
        }
      } catch (notifyErr) {
        console.error(
          "[charge-penalty] Failed to enqueue success notification:",
          notifyErr,
        );
        // Don't fail the whole request just because notification failed
      }

      return json(200, {
        success: true,
        charged: true,
        payment_id: result.payment_id,
        amount: chargeAmount,
        base_fee: baseFee,
        service_fee_percentage: serviceFeePercentage,
        service_fee_amount: serviceFeeAmount,
        order_id: orderNumber,
      });
    } else {
      // Failed Update
      await supabase.from("booking_guarantees").update({
        status: "failed",
        charge_reason: body.reason,
        updated_at: new Date().toISOString(),
      }).eq("id", guarantee.id);

      // --- Send Failure Notification ---
      try {
        const message =
          `We were unable to process the penalty charge for your reservation at ${booking.restaurant.name}. Please review your payment method to avoid further actions.`;

        const { error: notifyErr } = await supabase.rpc(
          "enqueue_notification",
          {
            p_user_id: booking.user_id,
            p_category: "card_guarantee",
            p_type: "penalty_charge_failed",
            p_title: "Payment Failed",
            p_message: message,
            p_data: {
              booking_id: booking.id,
              reason: body.reason,
              restaurant_name: booking.restaurant.name,
              error: result.reason || result.error_message || "Declined",
            },
            p_deeplink: `plate://profile/payment-methods`,
          },
        );

        if (notifyErr) {
          console.error(`[charge-penalty] RPC Error (Failure):`, notifyErr);
        } else {
          console.log(
            `[charge-penalty] Failure notification enqueued for user ${booking.user_id}`,
          );
        }
      } catch (notifyErr) {
        console.error(
          "[charge-penalty] Failed to enqueue failure notification:",
          notifyErr,
        );
      }

      return json(402, { // 402 Payment Required
        success: false,
        error: "Payment Failed",
        details: result.reason || result.error_message || "Declined",
        monty_response: result,
      });
    }
  } catch (error) {
    console.error("Critical Error:", error);
    return json(500, { error: "Internal server error" });
  }
});
