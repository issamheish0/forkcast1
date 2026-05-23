import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Secrets ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// The same key used by all DB triggers → send-email function
const PLATE_SECRET_KEY = (Deno.env.get("Plate-Secret-Key") ?? "").trim();
// plate_api_key is used by DB triggers calling this function
const PLATE_API_KEY = (Deno.env.get("plate_api_key") ?? "").trim();
// Admin recipients for promo-booking alerts
const NOTIFICATION_EMAILS = [
  "Chris <chris@plate-app.com>",
  "Ryan <ryan@plate-app.com>",
  "Karim <karim@plate-app.com>",
  "Issa <issa.m@plate-app.com>"
];
// Shared send-email function URL
const SEND_EMAIL_URL = "https://auth.plate-app.com/functions/v1/send-email";

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatDiscount(
  discount_type: string,
  discount_value: number,
  max_discount_amount: number | null,
): string {
  if (discount_type === "percentage") {
    const cap = max_discount_amount ? ` (max $${max_discount_amount})` : "";
    return `${discount_value}% off${cap}`;
  }
  return `$${discount_value} off`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!PLATE_SECRET_KEY && !PLATE_API_KEY) {
    console.error("[notify-promo-booking] Missing Plate-Secret-Key and plate_api_key");
    return json(500, { error: "Server misconfigured" });
  }

  // Accept either key (webhook uses Plate-Secret-Key, DB trigger uses plate_api_key)
  const incomingKey = req.headers.get("x-plate-key") ?? "";
  if (incomingKey !== PLATE_SECRET_KEY && incomingKey !== PLATE_API_KEY) {
    console.error("[notify-promo-booking] Unauthorized - invalid x-plate-key");
    return json(401, { error: "Unauthorized" });
  }

  let payload: { type?: string; record: Record<string, unknown>; old_record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const booking = payload.record;
  const oldRecord = payload.old_record;

  // Skip if no promo code on the new record
  if (!booking || !booking.applied_promo_code_id) {
    return json(200, { skipped: true });
  }

  // For UPDATE events: only fire if applied_promo_code_id was just set (wasn't set before)
  if (oldRecord && oldRecord.applied_promo_code_id === booking.applied_promo_code_id) {
    return json(200, { skipped: true });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Fetch promo code details
  const { data: promo, error: promoErr } = await supabase
    .from("promo_codes")
    .select("code, description, discount_type, discount_value, max_discount_amount")
    .eq("id", booking.applied_promo_code_id)
    .single();

  if (promoErr || !promo) {
    console.error("[notify-promo-booking] Failed to fetch promo code:", promoErr);
    return json(500, { error: "Failed to fetch promo code" });
  }

  // Fetch restaurant details
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name, address")
    .eq("id", booking.restaurant_id)
    .single();

  const restaurantName = restaurant?.name ?? "Unknown restaurant";
  const restaurantAddress = restaurant?.address ?? "";

  // Build email content
  const discountText = formatDiscount(
    promo.discount_type as string,
    promo.discount_value as number,
    promo.max_discount_amount as number | null,
  );

  const bookingTimeIso = booking.booking_time as string | null;
  const fmtDate = bookingTimeIso ? formatDate(bookingTimeIso) : "—";
  const fmtTime = bookingTimeIso ? formatTime(bookingTimeIso) : "—";
  const guestName = (booking.guest_name as string) || "—";
  const guestEmail = (booking.guest_email as string) || "—";
  const guestPhone = (booking.guest_phone as string) || "—";
  const partySize = booking.party_size ?? "—";
  const source = (booking.source as string) || "—";
  const bookingId = (booking.id as string) || "—";

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F4F4F5; padding: 32px 16px; margin: 0; color: #121212;">
  <div style="max-width: 560px; margin: 0 auto;">

    <!-- Logo -->
    <div style="text-align: center; padding-bottom: 24px;">
      <img src="https://auth.plate-app.com/storage/v1/object/public/logo/Logos%20(3).png"
           alt="Plate" style="height: 72px; width: auto;">
    </div>

    <!-- Main card -->
    <div style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

      <!-- Header bar -->
      <div style="background-color: #792339; padding: 28px 32px; text-align: center;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.7);">Internal Alert</p>
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #FFFFFF;">Promotional Code Redeemed</h1>
      </div>

      <!-- Body -->
      <div style="padding: 32px;">

        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: #444;">
          A reservation has been submitted at <strong style="color: #121212;">${restaurantName}</strong> with a promotional code applied. Please find the details below.
        </p>

        <!-- Promo highlight -->
        <div style="background-color: #FDF2F4; border: 1px solid #F0C4CC; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #792339;">Promo Code Applied</p>
          <p style="margin: 0 0 6px 0; font-size: 26px; font-weight: 700; letter-spacing: 3px; color: #792339; font-family: 'Courier New', monospace;">${promo.code}</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #555;">${discountText}</p>
          ${promo.description ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #777;">${promo.description}</p>` : ""}
        </div>

        <!-- Section: Booking Details -->
        <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #999;">Booking Details</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 28px;">
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 11px 0; color: #888; width: 38%; font-weight: 500;">Restaurant</td>
            <td style="padding: 11px 0; color: #121212; font-weight: 600;">${restaurantName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 11px 0; color: #888; font-weight: 500;">Date</td>
            <td style="padding: 11px 0; color: #121212; font-weight: 600;">${fmtDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 11px 0; color: #888; font-weight: 500;">Time</td>
            <td style="padding: 11px 0; color: #121212; font-weight: 600;">${fmtTime}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 11px 0; color: #888; font-weight: 500;">Party Size</td>
            <td style="padding: 11px 0; color: #121212; font-weight: 600;">${partySize} ${partySize === 1 ? "Guest" : "Guests"}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; color: #888; font-weight: 500;">Source</td>
            <td style="padding: 11px 0; color: #121212; font-weight: 600; text-transform: capitalize;">${source}</td>
          </tr>
        </table>

        <!-- Section: Guest Details -->
        <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #999;">Guest Details</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 28px;">
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 11px 0; color: #888; width: 38%; font-weight: 500;">Name</td>
            <td style="padding: 11px 0; color: #121212; font-weight: 600;">${guestName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 11px 0; color: #888; font-weight: 500;">Email</td>
            <td style="padding: 11px 0; color: #121212;">${guestEmail}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; color: #888; font-weight: 500;">Phone</td>
            <td style="padding: 11px 0; color: #121212;">${guestPhone}</td>
          </tr>
        </table>

        <!-- Booking ID -->
        <div style="background-color: #F8F8F8; border-radius: 8px; padding: 12px 16px;">
          <p style="margin: 0; font-size: 12px; color: #AAA;">Booking Reference</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; font-family: 'Courier New', monospace; color: #666; word-break: break-all;">${bookingId}</p>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 16px 8px; font-size: 12px; color: #AAA; line-height: 1.7;">
      <p style="margin: 0 0 4px 0;">This is an automated internal alert from the Plate platform.</p>
      <p style="margin: 0;">© 2026 Plate. All rights reserved. &nbsp;|&nbsp; <a href="https://www.plate-app.com" style="color: #AAA;">plate-app.com</a></p>
    </div>

  </div>
</body>
</html>`;

  // Send one email per recipient to ensure all 3 receive it
  const subject = `🎟️ Promo "${promo.code}" used at ${restaurantName} — ${guestName}, ${partySize} guests`;
  const emailIds: string[] = [];

  for (const recipient of NOTIFICATION_EMAILS) {
    const res = await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-plate-key": PLATE_SECRET_KEY,
      },
      body: JSON.stringify({
        to: recipient,
        subject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[notify-promo-booking] send-email error for ${recipient}:`, res.status, errBody);
    } else {
      const result = await res.json();
      emailIds.push(result.email_id ?? "sent");
      console.log(`[notify-promo-booking] Email sent to ${recipient}:`, result.email_id);
    }
  }

  return json(200, { sent: true, email_ids: emailIds });
});
