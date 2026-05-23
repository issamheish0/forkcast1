// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: test-whish-callback
// Webhook handler for Whish payment notifications
// Updates booking status and whish_transactions table

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLATE_SECRET_KEY= Deno.env.get("PLATE_SECRET_KEY");

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

function html(status: number, content: string) {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  try {
    const url = new URL(req.url);
    
    // Extract query parameters
    const bookingId = url.searchParams.get("booking_id");
    const status = url.searchParams.get("status");
    const externalId = url.searchParams.get("externalId");
    const key = url.searchParams.get("key");
    const source = url.searchParams.get("source") || "event_widget"; // Default to event_widget for backward compatibility
    
   if (PLATE_SECRET_KEY !== key) {
    console.error("[whish-callback] ❌ Unauthorized: Invalid secret key provided");
    return json(401, {
      error: "Unauthorized",
      details: "The provided secret key is invalid or missing.",
    });
}

    console.log("[whish-callback] Received callback:");
    console.log("- Booking ID:", bookingId);
    console.log("- Status:", status);
    console.log("- External ID:", externalId);
    console.log("- Source:", source);
    console.log("- Method:", req.method);

    // Also log any POST body if present
    if (req.method === "POST") {
      try {
        const body = await req.text();
        console.log("[whish-callback] POST body:", body);
      } catch (e) {
        console.log("[whish-callback] No POST body or failed to read");
      }
    }


    // Validate required parameters
    if (!bookingId) {
      console.error("[whish-callback] ❌ Missing booking_id parameter");
      return json(400, {
        error: "Missing required parameter",
        details: "booking_id is required",
      });
    }

    if (!status) {
      console.error("[whish-callback] ❌ Missing status parameter");
      return json(400, {
        error: "Missing required parameter",
        details: "status is required",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Handle success callback
    if (status === "success") {
      console.log("[whish-callback] Processing SUCCESS callback");

      // Update whish_transactions table
      const transactionUpdate: Record<string, any> = {
        status: "settled",
      };

      // If externalId is provided, use it to find the specific transaction
      if (externalId) {
        const { data: transaction, error: transactionFetchError } = await supabase
          .from("whish_transactions")
          .select("id")
          .eq("booking_id", bookingId)
          .eq("external_id", externalId)
          .single();

        if (transactionFetchError) {
          console.warn(
            "[whish-callback] ⚠️ Could not find transaction by external_id:",
            transactionFetchError
          );
        }

        if (transaction) {
          const { error: transactionError } = await supabase
            .from("whish_transactions")
            .update(transactionUpdate)
            .eq("id", transaction.id);

          if (transactionError) {
            console.error(
              "[whish-callback] ❌ Failed to update whish_transaction:",
              transactionError
            );
          } else {
            console.log("[whish-callback] ✅ Transaction updated to settled");
          }
        }
      } else {
        // Fallback: update by booking_id only (latest pending transaction)
        const { error: transactionError } = await supabase
          .from("whish_transactions")
          .update(transactionUpdate)
          .eq("booking_id", bookingId)
          .eq("status", "pending");

        if (transactionError) {
          console.error(
            "[whish-callback] ❌ Failed to update whish_transaction:",
            transactionError
          );
        } else {
          console.log("[whish-callback] ✅ Transaction updated to settled");
        }
      }

      // Determine the correct source value based on callback source parameter
      // manual_deposit -> manual, event_widget -> event_widget
      const bookingSource = source === "manual_deposit" ? "manual" : source;

      // Update booking status
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "paid",
          source: bookingSource,
        })
        .eq("id", bookingId)
        .select()
        .single();

      if (bookingError) {
        console.error(
          "[whish-callback] ❌ Failed to update booking:",
          bookingError
        );
        return json(500, {
          error: "Failed to update booking",
          details: bookingError.message,
        });
      }

      console.log("[whish-callback] ✅ Booking confirmed:", booking?.id);
      console.log("[whish-callback] ✅ Payment completed successfully");
      console.log("[whish-callback] ✅ Source set to:", bookingSource);

      // Return success response
      return json(200, {
        success: true,
        message: "Payment confirmed",
        booking_id: bookingId,
        status: "confirmed",
        payment_status: "paid",
        source: bookingSource,
      });
    }

    // Handle failure callback
    if (status === "failure") {
      console.log("[whish-callback] Processing FAILURE callback");

      // Update whish_transactions table
      if (externalId) {
        const { error: transactionError } = await supabase
          .from("whish_transactions")
          .update({
            status: "failed",
          })
          .eq("booking_id", bookingId)
          .eq("external_id", externalId);

        if (transactionError) {
          console.error(
            "[whish-callback] ❌ Failed to update whish_transaction:",
            transactionError
          );
        } else {
          console.log("[whish-callback] ✅ Transaction marked as failed");
        }
      } else {
        // Fallback: update by booking_id only
        const { error: transactionError } = await supabase
          .from("whish_transactions")
          .update({
            status: "failed",
          })
          .eq("booking_id", bookingId)
          .eq("status", "pending");

        if (transactionError) {
          console.error(
            "[whish-callback] ❌ Failed to update whish_transaction:",
            transactionError
          );
        }
      }

      // Update booking payment status to failed (keep booking status as is)
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          payment_status: "failed",
        })
        .eq("id", bookingId);

      if (bookingError) {
        console.error(
          "[whish-callback] ❌ Failed to update booking:",
          bookingError
        );
      }

      console.log("[whish-callback] ⚠️ Payment failed for booking:", bookingId);

      return json(200, {
        success: false,
        message: "Payment failed",
        booking_id: bookingId,
        payment_status: "failed",
      });
    }

    // Unknown status
    console.warn("[whish-callback] ⚠️ Unknown status received:", status);
    return json(400, {
      error: "Unknown status",
      details: `Status '${status}' is not recognized. Expected 'success' or 'failure'.`,
    });
  } catch (error) {
    console.error("[whish-callback] ❌ Unhandled error:", {
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
