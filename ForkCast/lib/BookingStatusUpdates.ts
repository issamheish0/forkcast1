import { supabase } from "@/config/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { router } from "expo-router";
import { useBookingStore } from "@/stores";
import { formatDateShort } from "@/utils/birthday";

export class BookingStatusUpdates {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;

  /**
   * Initialize real-time listening for booking status updates
   */
  initialize(userId: string) {
    this.userId = userId;

    // Clean up any existing channel
    if (this.channel) {
      this.channel.unsubscribe();
    }

    // Create channel for user's bookings
    this.channel = supabase
      .channel(`user-bookings:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          await this.handleBookingUpdate(payload);
        },
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
        }
      });
  }

  private async handleBookingUpdate(payload: any) {
    const oldStatus = payload.old?.status;
    const newStatus = payload.new?.status;
    const bookingId = payload.new?.id;

    if (!oldStatus || !newStatus || oldStatus === newStatus) return;

    // Get restaurant details for store update
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, restaurant:restaurants(name)")
      .eq("id", bookingId)
      .single();

    if (!booking) return;

    // Update the store with the new booking data
    useBookingStore.getState().updateBooking(bookingId, booking);

    // REMOVED: All showBookingConfirmedNotification, showBookingDeclinedNotification calls
    // The Edge Function now handles ALL push notifications via Expo Push API
    // This prevents duplicate notifications
  }

  /**
   * Handle notification tap
   */
  static handleNotificationResponse(response: any) {
    const data = response.notification.request.content.data;
    if (!data) return;

    switch (data.action) {
      case "view_booking":
        if (data.bookingId) {
          router.push({
            pathname: "/booking/[id]",
            params: { id: data.bookingId as string },
          });
        }
        break;
      case "book_again":
        if (data.restaurantId) {
          router.push({
            pathname: "/restaurant/[id]",
            params: { id: data.restaurantId as string },
          });
        }
        break;
    }
  }

  /**
   * Clean up subscriptions
   */
  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
  }

  /**
   * Check for expired pending bookings (only expires when booking time has passed)
   */
  static async checkExpiredPendingBookings(userId: string) {
    try {
      // Call the auto-decline function (now only declines when booking time has passed)
      await supabase.rpc("auto_decline_expired_pending_bookings");

      // Refresh user's bookings where booking time has passed
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lt("booking_time", new Date().toISOString());

      return bookings || [];
    } catch (error) {
      console.error("Error checking expired bookings:", error);
      return [];
    }
  }
}

// Singleton instance
export const bookingStatusUpdates = new BookingStatusUpdates();
