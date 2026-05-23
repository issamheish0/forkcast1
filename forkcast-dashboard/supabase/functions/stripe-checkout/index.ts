// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: stripe-checkout
// Replaces montypay-checkout.
// Creates a Stripe Checkout Session for:
//   - Card guarantee (mode=setup): saves the customer's card for future no-show charges
//   - Deposit / upfront payment (mode=payment): charges immediately
// Returns { redirect_url, session_id } that the mobile app opens in a browser.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const APP_URL = (Deno.env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000").replace(/\/$/, "");

interface CheckoutRequest {
  booking_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  // Guarantee flow (save card, charge later)
  is_widget_guarantee?: boolean;
  no_show_fee?: number;
  cancellation_fee?: number;
  fee_type?: "per_cover" | "fixed";
  party_size?: number;
  // Deposit flow (charge now)
  is_event_payment?: boolean;
  amount?: string;
  description?: string;
  source?: string;
  return_path?: string;
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
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    const body: CheckoutRequest = await req.json();
    const {
      booking_id,
      guest_name,
      guest_email,
      guest_phone,
      is_widget_guarantee,
      no_show_fee,
      cancellation_fee,
      fee_type,
      party_size,
      is_event_payment,
      amount,
      description,
      source,
    } = body;

    // ── Fetch booking and look up / create Stripe Customer ──────────────────
    let booking: any = null;
    let stripeCustomerId: string | undefined;

    if (booking_id) {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, confirmation_code, party_size, restaurant_id, user_id, guest_name, guest_email, guest_phone")
        .eq("id", booking_id)
        .maybeSingle();

      if (error || !data) return json(404, { error: "Booking not found" });
      booking = data;

      if (booking.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, stripe_customer_id, email, full_name, phone_number")
          .eq("id", booking.user_id)
          .single();

        if (profile?.stripe_customer_id) {
          stripeCustomerId = profile.stripe_customer_id;
        } else {
          const customer = await stripe.customers.create({
            name: guest_name || profile?.full_name || "Guest",
            email: guest_email || profile?.email || undefined,
            phone: guest_phone || profile?.phone_number || undefined,
            metadata: { supabase_user_id: booking.user_id },
          });
          stripeCustomerId = customer.id;

          await supabase
            .from("profiles")
            .update({ stripe_customer_id: customer.id })
            .eq("id", booking.user_id);
        }
      }
    }

    const successUrl = `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${APP_URL}/payment/cancel`;

    // ── Card Guarantee mode (SetupIntent) ────────────────────────────────────
    if (is_widget_guarantee) {
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_creation: "always" }),
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          booking_id: booking_id ?? "",
          type: "card_guarantee",
          no_show_fee: String(no_show_fee ?? 0),
          cancellation_fee: String(cancellation_fee ?? 0),
          fee_type: fee_type ?? "fixed",
          party_size: String(party_size ?? booking?.party_size ?? 0),
          source: source ?? "mobile",
        },
      });

      return json(200, { redirect_url: session.url, session_id: session.id });
    }

    // ── Deposit / upfront-payment mode (PaymentIntent) ───────────────────────
    if (is_event_payment || amount) {
      const amountCents = Math.round(parseFloat(amount ?? "50") * 100);
      const paymentDescription =
        description ??
        (booking ? `Deposit for booking ${booking.confirmation_code}` : "Booking Deposit");

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_creation: "always" }),
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: paymentDescription },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          booking_id: booking_id ?? "",
          type: "deposit",
          source: source ?? "mobile",
        },
        payment_intent_data: {
          metadata: { booking_id: booking_id ?? "" },
        },
      });

      return json(200, { redirect_url: session.url, session_id: session.id });
    }

    return json(400, { error: "Must specify is_widget_guarantee=true or an amount for deposit." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-checkout error:", message);
    return json(500, { error: message });
  }
});
