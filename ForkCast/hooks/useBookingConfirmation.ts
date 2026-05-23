// hooks/useBookingConfirmation.ts — Supabase-backed booking confirmation
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { MOCK_USER_ID } from "@/lib/mockData";

export interface ConfirmBookingParams {
  restaurantId: string;
  bookingTime: string;           // ISO timestamp (UTC)
  partySize: number;
  bookingPolicy?: "instant" | "request";
  specialRequests?: string;
  occasion?: string;
  dietaryNotes?: string[];
  tablePreferences?: string[];
  appliedOfferId?: string;
  appliedPromoCodeId?: string;
  tableIds?: string;             // JSON stringified array
  requiresCombination?: boolean;
  invitedFriends?: any[];
  preferredSection?: string;
  sectionId?: string;
  restaurantName?: string;
  skipNavigation?: boolean;
  [key: string]: any;
}

export const useBookingConfirmation = (_params?: any) => {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMockUser = !user || user.id === MOCK_USER_ID;

  const confirmBooking = useCallback(
    async (bookingData: ConfirmBookingParams): Promise<boolean> => {
      if (isMockUser) {
        Alert.alert("Sign In Required", "Please sign in with a real account to make bookings.");
        return false;
      }
      if (!user) return false;

      setIsSubmitting(true);
      try {
        const isRequest = bookingData.bookingPolicy === "request";

        const insertData: Record<string, any> = {
          restaurant_id: bookingData.restaurantId,
          user_id: user.id,
          booking_time: bookingData.bookingTime,
          party_size: bookingData.partySize,
          status: isRequest ? "pending" : "confirmed",
          special_requests: bookingData.specialRequests ?? null,
          occasion: bookingData.occasion ?? null,
          dietary_notes: bookingData.dietaryNotes ?? [],
          table_preferences: bookingData.tablePreferences ?? [],
          applied_offer_id: bookingData.appliedOfferId ?? null,
          applied_promo_code_id: bookingData.appliedPromoCodeId ?? null,
          preferred_section: bookingData.preferredSection ?? null,
          section_id: bookingData.sectionId ?? null,
        };

        const { data, error } = await supabase
          .from("bookings")
          .insert(insertData)
          .select("id, confirmation_code, status")
          .single();

        if (error) throw error;

        // Link table assignments if provided
        const tableIds: string[] = bookingData.tableIds
          ? JSON.parse(bookingData.tableIds)
          : [];
        if (tableIds.length > 0) {
          await supabase.from("booking_tables").insert(
            tableIds.map((tid) => ({
              booking_id: data.id,
              table_id: tid,
              seats_occupied: bookingData.partySize,
            })),
          );
        }

        if (!bookingData.skipNavigation) {
          if (isRequest) {
            router.replace({
              pathname: "/(protected)/booking/request-sent",
              params: { bookingId: data.id, restaurantId: bookingData.restaurantId },
            });
          } else {
            router.replace({
              pathname: "/(protected)/booking/success",
              params: {
                bookingId: data.id,
                confirmationCode: data.confirmation_code ?? "",
                restaurantId: bookingData.restaurantId,
              },
            });
          }
        }

        return true;
      } catch (e: any) {
        Alert.alert("Booking Failed", e.message ?? "Please try again.");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, isMockUser, router],
  );

  const cancelBooking = useCallback(async () => {
    router.back();
  }, [router]);

  const checkBookingEligibility = useCallback(async () => {
    return { eligible: true };
  }, []);

  return {
    confirmBooking,
    cancelBooking,
    checkBookingEligibility,
    loading: isSubmitting,
    isSubmitting,
  };
};
