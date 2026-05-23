// Supabase Edge Function: create-booking (validated)

// Inserts a booking row based on POST body, with strict validation.

// Protect this endpoint (CORS + secrets + origin allowlist) to avoid abuse.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_NAME_LEN = 100;

const MAX_EMAIL_LEN = 255;

const MAX_DAYS_AHEAD = 180; // reject bookings too far in the future

const MIN_PARTY = 1;

const MAX_PARTY = 20;

const MIN_PHONE_LEN = 10;

const MAX_PHONE_LEN = 20;

// Optional: restrict origins by env var (comma-separated list).

// Example: ALLOWED_ORIGINS="https://example.com,https://widget.example.com"

function isAllowedOrigin(origin, allowlist) {
    if (!allowlist || allowlist.length === 0) return true; // allow all if not configured

    if (!origin) return false;

    try {
        const o = new URL(origin);

        return allowlist.includes(o.origin);
    } catch {
        return false;
    }
}

const buildCORS = (req) => {
    const origin = req.headers.get("Origin") || "*";

    const allowlist = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((
        s,
    ) => s.trim()).filter(Boolean);

    const allowed = isAllowedOrigin(origin, allowlist);

    const allowOriginHeader = allowed ? origin ?? "*" : "null";

    return {
        "Access-Control-Allow-Origin": allowOriginHeader,

        "Access-Control-Allow-Methods": "POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",

        "Access-Control-Max-Age": "86400",

        Vary: "Origin",
    };
};

function jsonResponse(body, status, req) {
    return new Response(JSON.stringify(body), {
        status,

        headers: {
            "Content-Type": "application/json",

            ...buildCORS(req),
        },
    });
}

function badRequest(message, req, code = 400) {
    return jsonResponse(
        {
            error: message,
        },
        code,
        req,
    );
}

function isInteger(n) {
    return Number.isInteger(n);
}

function validateEmail(email) {
    if (email.length > MAX_EMAIL_LEN) return false;

    // Basic email regex (same spirit as your old one)

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
    return phone.replace(/[^\d+]/g, "").trim();
}

// E.164-ish acceptance: optional +, 10–15 digits total (you can relax/tighten)

function validatePhone(phone) {
    const p = normalizePhone(phone);

    if (p.length < MIN_PHONE_LEN || p.length > MAX_PHONE_LEN) return false;

    return /^\+?\d{10,15}$/.test(p);
}

function validateAndNormalize(payload) {
    const errors = [];

    if (typeof payload !== "object" || payload === null) {
        return {
            errors: [
                "Invalid JSON body",
            ],

            value: null,
        };
    }

    const {
        restaurant_id,
        guest_name,
        guest_email,
        guest_phone,
        booking_time,
        party_size,
        source = "widget",
        user_id = null,
        // New fields
        event_occurrence_id = null,
        is_event_booking = false,
        payment_amount = null,
        payment_status = "not_required",
        special_requests = null,
        status = "pending",
        // Card guarantee flag - when true, booking uses pending_payment status
        // until card verification callback confirms the guarantee
        requires_guarantee = false,
    } = payload;

    if (typeof guest_name !== "string") {
        errors.push("guest_name must be a string");
    }

    if (typeof booking_time !== "string") {
        errors.push("booking_time must be a string (ISO datetime)");
    }

    if (!isInteger(party_size)) {
        errors.push("party_size must be an integer number");
    }

    if (typeof guest_email !== "string") {
        errors.push("guest_email must be a string");
    }

    if (typeof guest_phone !== "string") {
        errors.push("guest_phone must be a string");
    }

    // If key types missing, stop early

    if (errors.length) {
        return {
            errors,

            value: null,
        };
    }

    // Normalize strings

    const name = guest_name.trim();

    const email = guest_email.trim().toLowerCase();

    const phone = guest_phone.trim();

    const src = source.trim();

    // Name checks

    if (name.length === 0 || name.length > MAX_NAME_LEN) {
        errors.push("Invalid guest_name (1–100 chars required)");
    }

    // Email checks

    if (!validateEmail(email)) {
        errors.push("Invalid guest_email format or length");
    }

    // Phone checks

    if (!validatePhone(phone)) {
        errors.push(
            "Invalid guest_phone format (use digits, optional leading +)",
        );
    }

    // Party size checks

    const size = Number(party_size);

    if (size < MIN_PARTY || size > MAX_PARTY) {
        errors.push(`party_size must be between ${MIN_PARTY} and ${MAX_PARTY}`);
    }

    // booking_time parsing and constraints

    const when = new Date(booking_time);

    if (Number.isNaN(when.getTime())) {
        errors.push("Invalid booking_time (cannot parse date)");
    } else {
        const now = new Date();

        // Require at least 2 minutes in the future (to avoid race with "now")

        if (when.getTime() <= now.getTime() + 2 * 60 * 1000) {
            errors.push(
                "booking_time must be in the future (>= 2 minutes from now)",
            );
        }

        const maxAhead = new Date(
            now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000,
        );

        if (when > maxAhead) {
            errors.push(
                `booking_time cannot be more than ${MAX_DAYS_AHEAD} days ahead`,
            );
        }
    }

    // source sanity

    const allowedSources = [
        "widget",
    ];

    if (!allowedSources.includes(src)) {
        errors.push(`source must be one of: ${allowedSources.join(", ")}`);
    }

    if (errors.length) {
        return {
            errors,

            value: null,
        };
    }

    // For event bookings and guarantee-required bookings, use pending_payment status
    // (not visible to restaurants until payment/card verification completes)
    // This prevents restaurant workers from seeing bookings before verification is done
    const needsPendingPayment = is_event_booking || requires_guarantee;
    const effectiveStatus = needsPendingPayment ? 'pending_payment' : (status || 'pending');
    
    // Set payment expiration for pending_payment bookings (10 minutes from now)
    const paymentExpiresAt = needsPendingPayment 
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString() 
        : null;

    return {
        errors: [],

        value: {
            restaurant_id: restaurant_id,

            guest_name: name,

            guest_email: email,

            guest_phone: normalizePhone(phone),

            booking_time: new Date(booking_time).toISOString(),

            party_size: size,

            source: src,

            user_id: user_id ?? null,

            // New fields passthrough
            event_occurrence_id,
            is_event_booking,
            payment_amount,
            payment_status,
            special_requests,
            status: effectiveStatus,
            payment_expires_at: paymentExpiresAt,
        },
    };
}

serve(async (req) => {
    // CORS preflight

    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: buildCORS(req),
        });
    }

    if (req.method !== "POST") {
        return badRequest("Method not allowed", req, 405);
    }

    // Load secrets

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return badRequest("Server misconfigured", req, 500);
    }

    // Parse & validate JSON

    let raw;

    try {
        raw = await req.json();
    } catch {
        return badRequest("Invalid JSON body", req);
    }

    const { errors, value } = validateAndNormalize(raw);

    if (errors.length || !value) {
        return jsonResponse(
            {
                error: "Validation failed",

                details: errors,
            },
            400,
            req,
        );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: {
            persistSession: false,
        },
    });

    // 1) Verify restaurant exists and is active

    {
        const { data: restaurant, error: rErr } = await supabase.from(
            "restaurants",
        ).select("id, status").eq("id", value.restaurant_id).eq(
            "status",
            "active",
        ).maybeSingle();

        if (rErr || !restaurant) {
            return badRequest("Restaurant not found", req, 404);
        }

        if (restaurant.status !== "active") {
            return badRequest("Restaurant is not accepting bookings", req, 400);
        }
    }

    // 2) Duplicate booking guard - only block if there's an active booking
    //    (allow retries for failed/cancelled bookings)
    {
        const { data: existing, error: eErr } = await supabase.from("bookings")
            .select("id, status, payment_status")
            .eq("restaurant_id", value.restaurant_id)
            .eq("guest_email", value.guest_email)
            .eq("booking_time", value.booking_time)
            .in("status", ["pending", "pending_payment", "confirmed"])  // Only check active bookings
            .neq("payment_status", "pending")         // Allow retries if payment pending
            .maybeSingle();

        if (!eErr && existing) {
            return badRequest("You already have a booking for this time slot", req, 409);
        }
    }

    // 3) Insert

    const { data, error } = await supabase.from("bookings").insert({
        restaurant_id: value.restaurant_id,

        guest_name: value.guest_name,

        guest_email: value.guest_email,

        guest_phone: value.guest_phone,

        booking_time: value.booking_time,

        party_size: value.party_size,

        source: value.source,

        // Dynamic status and event fields
        // Event bookings use 'pending_payment' to hide from restaurant until paid
        status: value.status,

        special_requests: value.special_requests,

        is_event_booking: value.is_event_booking,

        payment_amount: value.payment_amount,

        payment_status: value.payment_status || "not_required",

        event_occurrence_id: value.event_occurrence_id || null,

        user_id: value.user_id ?? null,
        
        // Payment expiration for pending_payment bookings (10 min window)
        payment_expires_at: value.payment_expires_at || null,
    }).select().single();

    if (error) {
        // Surface constraint/RLS errors to caller

        return jsonResponse(
            {
                error: error.message ?? "Failed to create booking",

                details: error,
            },
            400,
            req,
        );
    }

    // If this is an event booking, increment current_bookings on the occurrence
    if (value.is_event_booking && value.event_occurrence_id && data) {
        const { error: updateError } = await supabase.rpc(
            "increment_event_occurrence_bookings",
            {
                occurrence_id: value.event_occurrence_id,
                guest_count: value.party_size,
            },
        );

        if (updateError) {
            console.error(
                "[widget_booking] Failed to update occurrence bookings:",
                updateError,
            );
            // Don't fail the booking, just log the error
        }
    }

    return jsonResponse(
        {
            booking: data,
        },
        201,
        req,
    );
});
