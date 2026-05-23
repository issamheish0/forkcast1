// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: stripe-webhook
// Replaces montypay-callback.
// Handles Stripe webhook events, validates the signature, then:
//   - checkout.session.completed  → saves card (setup) or marks deposit paid
//   - payment_intent.succeeded    → marks guarantee charged
//   - payment_intent.payment_failed → marks guarantee charge failed
//
// Register this URL in the Stripe Dashboard → Developers → Webhooks.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "Missing Stripe-Signature header" });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return json(400, { error: "Invalid webhook signature" });
  }

  console.log("Received Stripe event:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        console.log("Unhandled event type:", event.type);
    }
  } catch (err) {
    console.error("Error processing Stripe event:", event.type, err);
    return json(500, { error: "Internal processing error" });
  }

  return json(200, { received: true });
});

// ── checkout.session.completed ───────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { booking_id, type } = session.metadata ?? {};

  // ── Card Guarantee: save the PaymentMethod ───────────────────────────────
  if (type === "card_guarantee" && session.setup_intent) {
    const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent as string);
    const pmId = setupIntent.payment_method as string;
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card;

    const cardMask = card ? `${card.brand.toUpperCase()} ****${card.last4}` : "Unknown card";

    // Upsert payment method record
    const { data: pmRecord, error: pmError } = await supabase
      .from("payment_methods")
      .insert({
        user_id: (session.metadata as any)?.user_id ?? null,
        stripe_customer_id: session.customer as string ?? null,
        stripe_payment_method_id: pmId,
        card_mask: cardMask,
        card_brand: card?.brand?.toUpperCase() ?? null,
        expiry_month: card?.exp_month ?? null,
        expiry_year: card?.exp_year ?? null,
        payment_provider: "stripe",
        is_active: true,
        // Legacy NOT NULL columns — use stripe ID as placeholder
        card_token: `stripe:${pmId}`,
      })
      .select("id")
      .single();

    if (pmError || !pmRecord) {
      console.error("Error saving payment_methods record:", pmError);
      return;
    }

    if (booking_id) {
      // Upsert booking_guarantee
      const { data: existing } = await supabase
        .from("booking_guarantees")
        .select("id")
        .eq("booking_id", booking_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("booking_guarantees")
          .update({
            status: "held",
            payment_method_id: pmRecord.id,
            stripe_setup_intent_id: session.setup_intent as string,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("booking_guarantees").insert({
          booking_id,
          payment_method_id: pmRecord.id,
          status: "held",
          stripe_setup_intent_id: session.setup_intent as string,
          no_show_fee: parseFloat(session.metadata?.no_show_fee ?? "0"),
          cancellation_fee: parseFloat(session.metadata?.cancellation_fee ?? "0"),
          fee_type: session.metadata?.fee_type ?? "fixed",
          party_size: parseInt(session.metadata?.party_size ?? "0") || null,
        });
      }

      // Mark booking as payment guaranteed
      await supabase
        .from("bookings")
        .update({ payment_status: "guaranteed" })
        .eq("id", booking_id);
    }
    return;
  }

  // ── Deposit: payment captured ─────────────────────────────────────────────
  if (type === "deposit" && session.payment_intent && booking_id) {
    await supabase
      .from("bookings")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", booking_id);

    await supabase.from("payment_transactions").insert({
      booking_id,
      stripe_payment_intent_id: session.payment_intent as string,
      payment_id: session.payment_intent as string, // keep NOT NULL satisfied
      order_number: booking_id,
      order_amount: (session.amount_total ?? 0) / 100,
      order_currency: (session.currency ?? "usd").toUpperCase(),
      order_description: "Booking deposit",
      status: "SUCCESS",
      transaction_type: "deposit",
      payment_provider: "stripe",
      hash: "stripe-webhook",         // NOT NULL legacy column
      raw_payload: session as any,
    });
  }
}

// ── payment_intent.succeeded ─────────────────────────────────────────────────
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const { booking_id, booking_guarantee_id } = pi.metadata;

  if (booking_guarantee_id) {
    await supabase
      .from("booking_guarantees")
      .update({ status: "charged", stripe_payment_intent_id: pi.id })
      .eq("id", booking_guarantee_id);
  }

  if (booking_id) {
    await supabase
      .from("bookings")
      .update({ payment_status: "charged" })
      .eq("id", booking_id);

    await supabase.from("payment_transactions").insert({
      booking_id,
      stripe_payment_intent_id: pi.id,
      payment_id: pi.id,
      order_number: booking_id,
      order_amount: pi.amount / 100,
      order_currency: pi.currency.toUpperCase(),
      order_description: pi.description ?? "Penalty charge",
      status: "SUCCESS",
      transaction_type: "charge",
      payment_provider: "stripe",
      hash: "stripe-webhook",
      raw_payload: pi as any,
    });
  }
}

// ── payment_intent.payment_failed ─────────────────────────────────────────────
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const { booking_id, booking_guarantee_id } = pi.metadata;

  if (booking_guarantee_id) {
    await supabase
      .from("booking_guarantees")
      .update({ status: "failed" })
      .eq("id", booking_guarantee_id);
  }

  if (booking_id) {
    await supabase
      .from("bookings")
      .update({ payment_status: "charge_failed" })
      .eq("id", booking_id);

    await supabase.from("payment_transactions").insert({
      booking_id,
      stripe_payment_intent_id: pi.id,
      payment_id: pi.id,
      order_number: booking_id,
      order_amount: pi.amount / 100,
      order_currency: pi.currency.toUpperCase(),
      order_description: pi.description ?? "Penalty charge",
      status: "FAIL",
      transaction_type: "charge",
      payment_provider: "stripe",
      hash: "stripe-webhook",
      raw_payload: pi as any,
    });
  }
}
