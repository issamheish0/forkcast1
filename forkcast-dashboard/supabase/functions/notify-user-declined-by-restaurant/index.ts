import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==== Environment Variables ====
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const CONTENT_SID = "HXe1a89e1e5308601c1dce9aa684e3f7b9"; // user_cancellation_message template

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==== Helper Functions ====
function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let normalized = phone.trim().replace(/\s+/g, "");
  if (normalized.startsWith("00")) normalized = "+" + normalized.slice(2);
  if (!normalized.startsWith("+")) normalized = "+" + normalized;
  return normalized;
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  // Split by space and take the first part
  const firstName = trimmed.split(/\s+/)[0];
  return firstName || "there";
}

function formatDateTime(isoString: string | null): { date: string; time: string } {
  if (!isoString) return { date: "", time: "" };
  
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return { date: "", time: "" };

  // Lebanon timezone (Asia/Beirut) - DD/MM/YYYY format
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  // HH:mm format (24-hour)
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return { date: dateStr, time: timeStr };
}

async function sendWhatsAppMessage(
  toPhone: string,
  userName: string,
  restaurantName: string,
  date: string,
  time: string
): Promise<string> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  const params = new URLSearchParams({
    To: `whatsapp:${toPhone}`,
    MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    ContentSid: CONTENT_SID,
    ContentVariables: JSON.stringify({
      "1": userName,        // User name
      "2": restaurantName,  // Restaurant name
      "3": date,            // Date (DD/MM/YYYY)
      "4": time,            // Time (HH:mm)
    }),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const result = await response.json();

  if (!response.ok) {
    // Sanitize error - only include safe error info, no sensitive data
    const errorMsg = result.message || result.error || "Unknown Twilio error";
    throw new Error(`Twilio error: ${errorMsg}`);
  }

  return result.sid;
}

// ==== Main Handler ====
serve(async (req) => {
  // Only allow POST
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  // Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "bad_json" });
  }

  // Authentication is handled by Supabase JWT (Authorization: Bearer header)
  // No custom authentication needed - Supabase validates the service role key automatically

  // Require booking_id
  if (!body.booking_id) {
    return json(400, { ok: false, error: "booking_id_required" });
  }

  const bookingId = String(body.booking_id);

  // Fetch booking details
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      id,
      status,
      booking_time,
      guest_name,
      guest_phone,
      restaurant:restaurants(name),
      user:profiles!bookings_user_id_fkey(full_name, phone_number)
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("Database error:", error);
    return json(500, { ok: false, error: "db_error" });
  }

  if (!booking) {
    return json(404, { ok: false, error: "booking_not_found" });
  }

  // Only send if status is declined_by_restaurant
  const status = String(booking.status || "").trim().toLowerCase();
  if (status !== "declined_by_restaurant") {
    return json(200, { 
      ok: true, 
      ignored: true, 
      reason: "status_not_declined_by_restaurant",
      current_status: booking.status 
    });
  }

  // Get user details - use first name only
  const fullName = booking.guest_name || booking.user?.full_name || null;
  const userName = getFirstName(fullName);
  const restaurantName = booking.restaurant?.name || "the restaurant";
  const userPhone = normalizePhone(booking.guest_phone || booking.user?.phone_number || null);

  if (!userPhone) {
    return json(422, { ok: false, error: "no_user_phone" });
  }

  // Format date and time
  const { date, time } = formatDateTime(booking.booking_time);

  // Send WhatsApp message
  try {
    const messageSid = await sendWhatsAppMessage(
      userPhone,
      userName,
      restaurantName,
      date,
      time
    );

    // Log success (no sensitive data)

    return json(200, {
      ok: true,
      message_sid: messageSid,
    });
  } catch (error) {
    // Log error without exposing sensitive details
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Failed to send WhatsApp message:", errorMsg);
    // Don't expose error details in production response
    return json(502, {
      ok: false,
      error: "twilio_send_failed",
    });
  }
});
