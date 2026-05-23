// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: stripe-charge
// Replaces charge-penalty (MontyPay recurring charge).
// Triggers an off-session PaymentIntent against a saved Stripe PaymentMethod
// to charge the customer for no-show or late-cancellation penalties.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface ChargeRequest {
  booking_guarantee_id: string;
  charge_type: "no_show" | "cancellation";
  /** Override amount in major currency units (e.g. 25.00). Calculated from guarantee if omitted. */
  amount?: number;
  description?: string;
  initiated_by?: string; // staff user_id
  notes?: string;
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body: ChargeRequest = await req.json();
    const { booking_guarantee_id, charge_type, amount: overrideAmount, description, initiated_by, notes } = body;

    if (!booking_guarantee_id || !charge_type) {
      return json(400, { error: "booking_guarantee_id and charge_type are required" });
    }

    // ── Fetch guarantee + payment method ────────────────────────────────────
    const { data: guarantee, error: gErr } = await supabase
      .from("booking_guarantees")
      .select(`
        id, booking_id, status, no_show_fee, cancellation_fee, fee_type, party_size,
        payment_method:payment_methods(id, stripe_payment_method_id, stripe_customer_id, payment_provider)
      `)
      .eq("id", booking_guarantee_id)
      .maybeSingle();

    if (gErr || !guarantee) return json(404, { error: "Booking guarantee not found" });
    if (guarantee.status === "charged") return json(409, { error: "Already charged" });
    if (guarantee.status === "released" || guarantee.status === "waived") {
      return json(409, { error: `Guarantee already ${guarantee.status}` });
    }

    const pm = guarantee.payment_method as any;
    if (!pm?.stripe_payment_method_id) {
      return json(400, {
        error:
          "No Stripe payment method attached to this guarantee. " +
          "This may be a legacy MontyPay guarantee — use the charge-penalty function instead.",
      });
    }
    if (!pm?.stripe_customer_id) {
      return json(400, { error: "Missing stripe_customer_id on payment method" });
    }

    // ── Calculate charge amount ──────────────────────────────────────────────
    let chargeAmount: number;
    if (overrideAmount !== undefined) {
      chargeAmount = overrideAmount;
    } else if (charge_type === "no_show") {
      chargeAmount =
        guarantee.fee_type === "per_cover"
          ? guarantee.no_show_fee * (guarantee.party_size ?? 1)
          : guarantee.no_show_fee;
    } else {
      chargeAmount =
        guarantee.fee_type === "per_cover"
          ? guarantee.cancellation_fee * (guarantee.party_size ?? 1)
          : guarantee.cancellation_fee;
    }

    if (chargeAmount <= 0) return json(400, { error: "Charge amount must be greater than zero" });

    const chargeAmountCents = Math.round(chargeAmount * 100);
    const chargeDescription =
      description ??
      (charge_type === "no_show" ? "No-show penalty fee" : "Late cancellation fee");

    // ── Create off-session PaymentIntent ─────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmountCents,
      currency: "usd",
      customer: pm.stripe_customer_id,
      payment_method: pm.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: chargeDescription,
      metadata: {
        booking_id: guarantee.booking_id,
        booking_guarantee_id,
        charge_type,
      },
    });

    const succeeded = paymentIntent.status === "succeeded";

    // ── Update booking_guarantee ─────────────────────────────────────────────
    await supabase
      .from("booking_guarantees")
      .update({
        status: succeeded ? "charged" : "failed",
        charge_reason: charge_type === "no_show" ? "no_show" : "late_cancellation",
        charged_amount: succeeded ? chargeAmount : null,
        charged_at: succeeded ? new Date().toISOString() : null,
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", booking_guarantee_id);

    // ── Log to penalty_transactions ──────────────────────────────────────────
    const { data: booking } = await supabase
      .from("bookings")
      .select("restaurant_id, user_id")
      .eq("id", guarantee.booking_id)
      .maybeSingle();

    await supabase.from("penalty_transactions").insert({
      booking_guarantee_id,
      booking_id: guarantee.booking_id,
      restaurant_id: booking?.restaurant_id ?? null,
      user_id: booking?.user_id ?? null,
      transaction_type: "charge",
      amount: chargeAmount,
      currency: "USD",
      reason: charge_type === "no_show" ? "no_show" : "late_cancellation",
      stripe_payment_intent_id: paymentIntent.id,
      payment_provider: "stripe",
      montypay_status: succeeded ? "SUCCESS" : "FAIL", // keep legacy column satisfied
      initiated_by: initiated_by ?? null,
      notes: notes ?? null,
    });

    if (!succeeded) {
      return json(402, {
        error: "Payment failed",
        stripe_status: paymentIntent.status,
        payment_intent_id: paymentIntent.id,
      });
    }

    return json(200, {
      success: true,
      charged_amount: chargeAmount,
      payment_intent_id: paymentIntent.id,
      status: "charged",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-charge error:", message);
    // Stripe card errors return a structured error
    if (err && typeof err === "object" && "code" in err) {
      return json(402, { error: message, code: (err as any).code });
    }
    return json(500, { error: message });
  }
});
