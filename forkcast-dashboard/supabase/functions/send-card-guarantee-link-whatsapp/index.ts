import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==== Environment Variables ====
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
// Card guarantee template variables: {{name}}, {{restaurant_name}}, {{date}}, {{time}}, {{payment_link}}, {{no_show_fee}}, {{late_cancel_fee}}, {{free_cancellation_window}}
const CONTENT_SID = "HXe5cfe8b65e1542f6b7beba96f9cfd54a"; // card_guarantee_message template

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==== Helper Functions ====
function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
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

async function shortenUrl(longUrl: string): Promise<string> {
  try {
    // Use is.gd API to shorten the URL
    const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
    
    if (!response.ok) {
      console.warn("⚠️ Failed to shorten URL, using original URL");
      return longUrl;
    }
    
    const result = await response.json();
    
    // is.gd returns JSON with shorturl field, or errorcode if failed
    if (result.shorturl && result.shorturl.startsWith("http")) {
      console.log("✅ URL shortened:", result.shorturl);
      return result.shorturl.trim();
    } else {
      console.warn("⚠️ is.gd returned error, using original URL:", result);
      return longUrl;
    }
  } catch (error) {
    console.error("❌ Error shortening URL:", error);
    // Return original URL if shortening fails
    return longUrl;
  }
}

function formatFeeAsNumber(amount: number | null): string {
  if (amount === null || amount === undefined) return "0";
  return amount.toFixed(0);
}

function formatCancellationWindow(hours: number | null): string {
  if (!hours || hours <= 0) return "24"; // Default fallback
  return hours.toString();
}

function calculateFee(feeAmount: number, partySize: number, feeType: string): number {
  if (feeType === "per_cover") {
    return feeAmount * partySize;
  }
  return feeAmount;
}

async function sendWhatsAppMessage(
  toPhone: string,
  userName: string,
  restaurantName: string,
  date: string,
  time: string,
  paymentLink: string,
  noShowFee: string,
  lateCancelFee: string,
  freeCancellationWindow: string
): Promise<string> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  // Build ContentVariables - use exact variable names from the Twilio template
  // Template variables: {{name}}, {{restaurant_name}}, {{date}}, {{time}}, {{payment_link}}, {{no_show_fee}}, {{late_cancel_fee}}, {{free_cancellation_window}}
  // IMPORTANT: Variable names must match EXACTLY what's defined in Twilio Content Template
  // Ensure all values are non-empty strings (Twilio requirement)
  if (!userName || !restaurantName || !date || !time || !paymentLink) {
    throw new Error("Missing required template variables: name, restaurant_name, date, time, or payment_link");
  }

  const contentVariables: Record<string, string> = {
    "name": String(userName),
    "restaurant_name": String(restaurantName),
    "date": String(date),
    "time": String(time),
    "payment_link": String(paymentLink),
    "no_show_fee": String(noShowFee || "0"),
    "late_cancel_fee": String(lateCancelFee || "0"),
    "free_cancellation_window": String(freeCancellationWindow || "24"),
  };

  // Stringify with no extra whitespace (Twilio can be strict about JSON format)
  const contentVariablesJson = JSON.stringify(contentVariables);
  
  console.log("📤 Sending Card Guarantee WhatsApp");
  console.log("📤 ContentVariables JSON:", contentVariablesJson);
  console.log("📤 Variable values:", { 
    name: userName,
    restaurant_name: restaurantName,
    date: date,
    time: time,
    payment_link: paymentLink ? `${paymentLink.substring(0, 50)}...` : "missing",
    no_show_fee: noShowFee,
    late_cancel_fee: lateCancelFee,
    free_cancellation_window: freeCancellationWindow
  });

  const params = new URLSearchParams({
    To: `whatsapp:${toPhone}`,
    MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    ContentSid: CONTENT_SID,
    ContentVariables: contentVariablesJson,
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
    // Log full error for debugging
    console.error("❌ Twilio API error:", {
      status: response.status,
      statusText: response.statusText,
      error: result,
      contentVariables: contentVariablesJson,
      contentSid: CONTENT_SID,
    });
    
    // Check for specific Content Variables error
    if (result.code === 21608 || result.message?.includes("content variable") || result.message?.includes("ContentVariable")) {
      console.error("❌ Content Variables Error Details:", {
        sentVariables: Object.keys(contentVariables),
        sentValues: contentVariables,
        contentSid: CONTENT_SID,
      });
      throw new Error(`Twilio Content Variables Error: ${result.message || result.error || "Invalid content variables"}. Please verify the template variables match exactly.`);
    }
    
    // Sanitize error - only include safe error info, no sensitive data
    const errorMsg = result.message || result.error || "Unknown Twilio error";
    throw new Error(`Twilio error: ${errorMsg}`);
  }

  console.log("✅ Card Guarantee WhatsApp message sent successfully:", result.sid);
  return result.sid;
}

// ==== Main Handler ====
serve(async (req) => {
  console.log("🚀 Function called - Method:", req.method);
  console.log("🚀 Function called - URL:", req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("✅ CORS preflight request");
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    console.log("❌ Invalid method:", req.method);
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  // Parse request body
  let body: any;
  try {
    body = await req.json();
    console.log("📥 Request body received:", JSON.stringify(body));
  } catch (error) {
    console.error("❌ Failed to parse JSON:", error);
    return json(400, { ok: false, error: "bad_json" });
  }

  // Authentication: Support both JWT (from frontend) and service role key (from server-side)
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  
  console.log("🔐 Auth header present:", !!authHeader);
  console.log("🔐 JWT present:", !!jwt && jwt !== SUPABASE_SERVICE_ROLE_KEY);
  
  let isAuthenticated = false;
  
  // Try JWT authentication first (for frontend calls)
  if (jwt && jwt !== SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
      if (!authError && user) {
        isAuthenticated = true;
        console.log("✅ Authenticated via JWT");
      } else {
        console.log("❌ JWT auth failed:", authError?.message);
      }
    } catch (e) {
      console.log("❌ JWT verification error:", e);
      // JWT verification failed, continue to check service role key
    }
  }
  
  // Fallback to service role key authentication (for server-side calls)
  if (!isAuthenticated) {
    const expectedAuth = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    if (SUPABASE_SERVICE_ROLE_KEY && authHeader === expectedAuth) {
      isAuthenticated = true;
      console.log("✅ Authenticated via service role key");
    }
  }
  
  if (!isAuthenticated) {
    console.log("❌ Authentication failed - no valid auth provided");
    return json(401, { ok: false, error: "unauthorized" });
  }

  // Require booking_id and payment link
  if (!body.booking_id) {
    console.log("❌ Missing booking_id in request body");
    return json(400, { ok: false, error: "booking_id_required" });
  }

  const montyPayLink = body.montypay_link ? String(body.montypay_link).trim() : null;
  
  if (!montyPayLink || montyPayLink.length === 0) {
    console.error("❌ No valid payment link provided:", { montypay_link: body.montypay_link });
    return json(400, { ok: false, error: "payment_link_required", message: "MontyPay payment link is required" });
  }

  const bookingId = String(body.booking_id);
  console.log("📋 Processing booking_id:", bookingId);

  // Fetch booking details with restaurant info and guarantee settings
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_time,
      guest_name,
      guest_phone,
      party_size,
      restaurant_id,
      restaurant:restaurants!bookings_restaurant_id_fkey(
        name,
        cancellation_window_hours
      )
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("Database error:", bookingError);
    return json(500, { ok: false, error: "db_error" });
  }

  if (!booking) {
    return json(404, { ok: false, error: "booking_not_found" });
  }

  // Get guest details - use first name only
  const fullName = booking.guest_name || null;
  const userName = getFirstName(fullName);
  const restaurantName = booking.restaurant?.name || "the restaurant";
  const userPhone = normalizePhone(booking.guest_phone);
  const partySize = booking.party_size || 1;
  const cancellationWindowHours = booking.restaurant?.cancellation_window_hours || 24;

  if (!userPhone) {
    return json(422, { ok: false, error: "no_user_phone" });
  }

  // Fetch guarantee settings - try booking_guarantees first (if card already verified), then fallback to card_guarantee_settings
  let noShowFee = 0;
  let lateCancelFee = 0;
  let feeType = "fixed";

  // Try to get from booking_guarantees (if guarantee already exists)
  const { data: bookingGuarantee } = await supabase
    .from("booking_guarantees")
    .select("no_show_fee, cancellation_fee, fee_type")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (bookingGuarantee) {
    noShowFee = Number(bookingGuarantee.no_show_fee) || 0;
    lateCancelFee = Number(bookingGuarantee.cancellation_fee) || 0;
    feeType = bookingGuarantee.fee_type || "fixed";
  } else {
    // Fallback to card_guarantee_settings for the restaurant
    if (booking.restaurant_id) {
      const { data: guaranteeSettings } = await supabase
        .from("card_guarantee_settings")
        .select("no_show_fee, late_cancel_fee, fee_type")
        .eq("restaurant_id", booking.restaurant_id)
        .maybeSingle();

      if (guaranteeSettings) {
        noShowFee = Number(guaranteeSettings.no_show_fee) || 0;
        lateCancelFee = Number(guaranteeSettings.late_cancel_fee) || 0;
        feeType = guaranteeSettings.fee_type || "fixed";
      }
    }
  }

  // Calculate fees based on fee_type and party_size
  const calculatedNoShowFee = calculateFee(noShowFee, partySize, feeType);
  const calculatedLateCancelFee = calculateFee(lateCancelFee, partySize, feeType);

  // Format date and time
  const { date, time } = formatDateTime(booking.booking_time);

  // Shorten the payment link before sending
  console.log("🔗 Original MontyPay link length:", montyPayLink.length);
  const shortPaymentLink = await shortenUrl(montyPayLink);
  console.log("🔗 Shortened MontyPay link:", shortPaymentLink);

  // Format fees as numbers and cancellation window as number
  const formattedNoShowFee = formatFeeAsNumber(calculatedNoShowFee);
  const formattedLateCancelFee = formatFeeAsNumber(calculatedLateCancelFee);
  const formattedFreeCancellationWindow = formatCancellationWindow(cancellationWindowHours);

  // Send WhatsApp message
  try {
    const messageSid = await sendWhatsAppMessage(
      userPhone,
      userName,
      restaurantName,
      date,
      time,
      shortPaymentLink,
      formattedNoShowFee,
      formattedLateCancelFee,
      formattedFreeCancellationWindow
    );

    return json(200, {
      ok: true,
      message_sid: messageSid,
    });
  } catch (error) {
    // Log error with more details for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("❌ Failed to send Card Guarantee WhatsApp message:", {
      error: errorMsg,
      stack: errorStack,
      bookingId,
      hasPaymentLink: !!montyPayLink,
    });
    // Return more detailed error for debugging (can be sanitized in production)
    return json(502, {
      ok: false,
      error: "twilio_send_failed",
      message: errorMsg,
    });
  }
});
