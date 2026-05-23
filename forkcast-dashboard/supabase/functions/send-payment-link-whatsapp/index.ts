import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==== Environment Variables ====
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
// New template variables: {{name}}, {{restaurant_name}}, {{date}}, {{time}}, {{amount_monty}}, {{payment_link_monty}}, {{amount_whish}}, {{payment_link_whish}}
const CONTENT_SID = "HX60c6733197358981e66a64531d63d395"; // paymentlink_message template

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

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "0";
  return amount.toFixed(2);
}

async function sendWhatsAppMessage(
  toPhone: string,
  userName: string,
  restaurantName: string,
  date: string,
  time: string,
  montyPayLink: string | null,
  whishLink: string | null,
  montyPayAmount: number | null,
  whishAmount: number | null
): Promise<string> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  // Validate that we have at least one link
  if (!montyPayLink && !whishLink) {
    throw new Error("No payment links provided");
  }
  
  // Build ContentVariables - use exact variable names from the new Twilio template
  // Template variables: {{name}}, {{restaurant_name}}, {{date}}, {{time}}, {{amount_monty}}, {{payment_link_monty}}, {{amount_whish}}, {{payment_link_whish}}
  const contentVariables: Record<string, string> = {
    "name": userName,                    // {{name}}
    "restaurant_name": restaurantName,   // {{restaurant_name}}
    "date": date,                        // {{date}}
    "time": time,                        // {{time}}
  };
  
  // Add MontyPay variables if link exists
  if (montyPayLink) {
    contentVariables["payment_link_monty"] = montyPayLink;
    contentVariables["amount_monty"] = formatCurrency(montyPayAmount);
  } else {
    // If MontyPay link is missing, use empty string (template should handle this)
    contentVariables["payment_link_monty"] = "";
    contentVariables["amount_monty"] = "0";
  }
  
  // Add Whish variables if link exists
  if (whishLink) {
    contentVariables["payment_link_whish"] = whishLink;
    contentVariables["amount_whish"] = formatCurrency(whishAmount);
  } else {
    // If Whish link is missing, use empty string (template should handle this)
    contentVariables["payment_link_whish"] = "";
    contentVariables["amount_whish"] = "0";
  }

  console.log("📤 Sending WhatsApp with ContentVariables:", JSON.stringify(contentVariables));
  console.log("📤 Values:", { 
    userName, 
    restaurantName, 
    date, 
    time, 
    hasMontyPay: !!montyPayLink, 
    hasWhish: !!whishLink,
    montyPayAmount,
    whishAmount
  });

  const params = new URLSearchParams({
    To: `whatsapp:${toPhone}`,
    MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    ContentSid: CONTENT_SID,
    ContentVariables: JSON.stringify(contentVariables),
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
    });
    // Sanitize error - only include safe error info, no sensitive data
    const errorMsg = result.message || result.error || "Unknown Twilio error";
    throw new Error(`Twilio error: ${errorMsg}`);
  }

  console.log("✅ WhatsApp message sent successfully:", result.sid);
  return result.sid;
}

// ==== Main Handler ====
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
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
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  // Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "bad_json" });
  }

  // Authentication: Support both JWT (from frontend) and service role key (from server-side)
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  
  let isAuthenticated = false;
  
  // Try JWT authentication first (for frontend calls)
  if (jwt && jwt !== SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
      if (!authError && user) {
        isAuthenticated = true;
      }
    } catch (e) {
      // JWT verification failed, continue to check service role key
    }
  }
  
  // Fallback to service role key authentication (for server-side calls)
  if (!isAuthenticated) {
    const expectedAuth = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    if (SUPABASE_SERVICE_ROLE_KEY && authHeader === expectedAuth) {
      isAuthenticated = true;
    }
  }
  
  if (!isAuthenticated) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  // Require booking_id and both payment links
  if (!body.booking_id) {
    return json(400, { ok: false, error: "booking_id_required" });
  }

  // Require both links for deposit payments
  const montyPayLink = body.montypay_link ? String(body.montypay_link).trim() : null;
  const whishLink = body.whish_link ? String(body.whish_link).trim() : null;
  
  // Get amounts (total amounts including fees)
  const montyPayAmount = body.montypay_total_amount ? Number(body.montypay_total_amount) : body.montypay_amount ? Number(body.montypay_amount) : null;
  const whishAmount = body.whish_total_amount ? Number(body.whish_total_amount) : body.whish_amount ? Number(body.whish_amount) : null;
  
  // Validate that we have at least one non-empty link
  const hasMontyPay = montyPayLink && montyPayLink.length > 0;
  const hasWhish = whishLink && whishLink.length > 0;
  
  if (!hasMontyPay && !hasWhish) {
    console.error("❌ No valid payment links provided:", { montypay_link: body.montypay_link, whish_link: body.whish_link });
    return json(400, { ok: false, error: "payment_links_required", message: "At least one payment link is required" });
  }
  
  // Use the validated links
  const validMontyPayLink = hasMontyPay ? montyPayLink : null;
  const validWhishLink = hasWhish ? whishLink : null;

  const bookingId = String(body.booking_id);

  // Fetch booking details with restaurant name
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_time,
      guest_name,
      guest_phone,
      restaurant:restaurants!bookings_restaurant_id_fkey(name)
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

  // Get guest details - use first name only
  const fullName = booking.guest_name || null;
  const userName = getFirstName(fullName);
  const restaurantName = booking.restaurant?.name || "the restaurant";
  const userPhone = normalizePhone(booking.guest_phone);

  if (!userPhone) {
    return json(422, { ok: false, error: "no_user_phone" });
  }

  // Format date and time
  const { date, time } = formatDateTime(booking.booking_time);

  // Shorten the payment links before sending
  let shortMontyPayLink: string | null = null;
  let shortWhishLink: string | null = null;
  
  if (validMontyPayLink) {
    console.log("🔗 Original MontyPay link length:", validMontyPayLink.length);
    shortMontyPayLink = await shortenUrl(validMontyPayLink);
    console.log("🔗 Shortened MontyPay link:", shortMontyPayLink);
  }
  
  if (validWhishLink) {
    console.log("🔗 Original Whish link length:", validWhishLink.length);
    shortWhishLink = await shortenUrl(validWhishLink);
    console.log("🔗 Shortened Whish link:", shortWhishLink);
  }

  // Send WhatsApp message
  try {
    const messageSid = await sendWhatsAppMessage(
      userPhone,
      userName,
      restaurantName,
      date,
      time,
      shortMontyPayLink,
      shortWhishLink,
      montyPayAmount,
      whishAmount
    );

    // Log success (no sensitive data)

    return json(200, {
      ok: true,
      message_sid: messageSid,
    });
  } catch (error) {
    // Log error with more details for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("❌ Failed to send WhatsApp message:", {
      error: errorMsg,
      stack: errorStack,
      bookingId,
      hasMontyPay: !!validMontyPayLink,
      hasWhish: !!validWhishLink,
    });
    // Return more detailed error for debugging (can be sanitized in production)
    return json(502, {
      ok: false,
      error: "twilio_send_failed",
      message: errorMsg,
    });
  }
});
