"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetch deposit settings for a restaurant
 */
export async function getDepositSettings(restaurantId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("deposit_payment_settings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching deposit settings:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

/**
 * Save deposit settings for a restaurant
 */
export async function saveDepositSettings(restaurantId: string, settings: {
    enabled: boolean;
    minimum_party_size: number;
    deposit_amount: number;
    fee_type: "per_cover" | "fixed";
    currency: string;
    refund_policy: "full" | "partial" | "none";
    refund_window_hours: number;
    partial_refund_percentage: number;
    schedule_rules: object;
}) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("deposit_payment_settings")
        .upsert({
            restaurant_id: restaurantId,
            enabled: settings.enabled,
            minimum_party_size: settings.minimum_party_size,
            deposit_amount: settings.deposit_amount,
            fee_type: settings.fee_type,
            currency: settings.currency,
            refund_policy: settings.refund_policy,
            refund_window_hours: settings.refund_window_hours,
            partial_refund_percentage: settings.partial_refund_percentage,
            schedule_rules: settings.schedule_rules,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: "restaurant_id",
        });

    if (error) {
        console.error("Error saving deposit settings:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/settings/deposits");
    return { success: true };
}

/**
 * Fetch deposit details for a booking
 */
export async function getBookingDeposit(bookingId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_deposits")
        .select(`
      *,
      deposit_setting:deposit_payment_settings(*)
    `)
        .eq("booking_id", bookingId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching booking deposit:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

/**
 * Process a deposit refund
 */
export async function processDepositRefund({
    bookingId,
    refundReason,
    refundAmount,
}: {
    bookingId: string;
    refundReason: string;
    refundAmount?: number;
}) {
    const supabase = await createClient();

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const safeReason = typeof refundReason === 'string' ? refundReason.slice(0, 500).trim() : 'Refund requested';

    // Get the deposit record with booking restaurant info
    const { data: deposit, error: fetchError } = await supabase
        .from("booking_deposits")
        .select("*, booking:bookings!inner(restaurant_id)")
        .eq("booking_id", bookingId)
        .single();

    if (fetchError || !deposit) {
        return { success: false, error: "Deposit not found" };
    }

    // Verify staff access to this restaurant
    const restaurantId = deposit.booking?.restaurant_id;
    const { data: staffAccess } = await supabase
        .from("restaurant_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .single();

    if (!staffAccess || !['owner', 'manager', 'admin'].includes(staffAccess.role)) {
        return { success: false, error: "Insufficient permissions" };
    }

    if (deposit.status !== "paid") {
        return { success: false, error: "Only paid deposits can be refunded" };
    }

    // Validate refund amount
    if (refundAmount !== undefined && (refundAmount <= 0 || refundAmount > deposit.amount)) {
        return { success: false, error: "Refund amount must be between 0 and the deposit amount" };
    }

    // Calculate refund amount if not provided
    const finalRefundAmount = refundAmount ?? deposit.amount;

    // Update the deposit record
    const { error: updateError } = await supabase
        .from("booking_deposits")
        .update({
            status: finalRefundAmount >= deposit.amount
                ? "refunded"
                : "partial_refund",
            refund_amount: finalRefundAmount,
            refund_reason: safeReason,
            refunded_at: new Date().toISOString(),
            refunded_by: user.id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", deposit.id);

    if (updateError) {
        console.error("Error processing refund:", updateError);
        return { success: false, error: updateError.message };
    }

    // Update booking deposit_status
    await supabase
        .from("bookings")
        .update({
            deposit_status: finalRefundAmount >= deposit.amount
                ? "refunded"
                : "paid",
        })
        .eq("id", bookingId);

    revalidatePath("/bookings");

    return { success: true, refundAmount: finalRefundAmount };
}

/**
 * Get deposit statistics for a restaurant
 */
export async function getDepositStats(restaurantId: string) {
    const supabase = await createClient();

    // Get all deposits for this restaurant via bookings
    const { data: deposits, error } = await supabase
        .from("booking_deposits")
        .select(`
      *,
      booking:bookings!inner(restaurant_id)
    `)
        .eq("booking.restaurant_id", restaurantId);

    if (error) {
        console.error("Error fetching deposit stats:", error);
        return { success: false, error: error.message };
    }

    const stats = {
        totalCollected: 0,
        totalRefunded: 0,
        pendingCount: 0,
        paidCount: 0,
    };

    deposits?.forEach((deposit) => {
        if (deposit.status === "paid") {
            stats.totalCollected += Number(deposit.total_amount) || 0;
            stats.paidCount++;
        } else if (
            deposit.status === "refunded" || deposit.status === "partial_refund"
        ) {
            stats.totalRefunded += Number(deposit.refund_amount) || 0;
        } else if (deposit.status === "pending") {
            stats.pendingCount++;
        }
    });

    return { success: true, stats };
}
