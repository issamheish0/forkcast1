// hooks/useBookingCreate.ts — Supabase-backed booking creation
import { useState, useEffect, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { MOCK_USER_ID, MOCK_RESTAURANTS } from "@/lib/mockData";
import { createLebanonDateTime } from "@/utils/lebanonTime";

export function useBookingCreate() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    restaurantId,
    date: dateParam,
    time: timeParam,
    partySize: partySizeParam,
  } = useLocalSearchParams<{
    restaurantId: string;
    date?: string;
    time?: string;
    partySize?: string;
  }>();

  const isMockUser = !user || user.id === MOCK_USER_ID;

  const bookingDate = dateParam ?? new Date().toISOString().split("T")[0];
  const bookingTime = timeParam ?? "19:00";
  const partySize = partySizeParam ? parseInt(partySizeParam) : 2;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Load restaurant
  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }

    // Optimistic: try mock first
    const mock = MOCK_RESTAURANTS.find((r) => r.id === restaurantId);
    if (mock) setRestaurant(mock);

    supabase
      .from("restaurants")
      .select(`
        id, name, address, main_image_url, cuisine_type, average_rating,
        price_range, booking_policy, table_turnover_minutes, requires_down_payment,
        down_payment_amount, min_party_size, max_party_size, tier,
        cancellation_window_hours, latitude, longitude
      `)
      .eq("id", restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setRestaurant(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [restaurantId]);

  // Load profile
  useEffect(() => {
    if (!user || isMockUser) return;
    supabase
      .from("profiles")
      .select("id, full_name, email, phone_number")
      .eq("id", user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user, isMockUser]);

  const isRequestBooking = restaurant?.booking_policy === "request";

  const submitBooking = useCallback(
    async (formData?: {
      specialRequests?: string;
      occasion?: string;
      dietaryRestrictions?: string[];
      tablePreferences?: string[];
    }) => {
      if (isMockUser) {
        Alert.alert("Mock Mode", "Sign in with a real account to make bookings.");
        return;
      }
      if (!user || !restaurantId) return;

      setSubmitting(true);
      try {
        const bookingTimestamp = createLebanonDateTime(bookingDate, bookingTime).toISOString();

        const insertData: Record<string, any> = {
          restaurant_id: restaurantId,
          user_id: user.id,
          booking_time: bookingTimestamp,
          party_size: partySize,
          status: isRequestBooking ? "pending" : "confirmed",
          special_requests: formData?.specialRequests ?? null,
          occasion: formData?.occasion ?? null,
          dietary_notes: formData?.dietaryRestrictions ?? [],
          table_preferences: formData?.tablePreferences ?? [],
        };

        const { data, error } = await supabase
          .from("bookings")
          .insert(insertData)
          .select("id, confirmation_code, status")
          .single();

        if (error) throw error;

        setShowConfirmationModal(false);

        if (isRequestBooking) {
          router.replace({
            pathname: "/(protected)/booking/request-sent",
            params: { bookingId: data.id, restaurantId },
          });
        } else {
          router.replace({
            pathname: "/(protected)/booking/success",
            params: {
              bookingId: data.id,
              confirmationCode: data.confirmation_code ?? "",
              restaurantId,
            },
          });
        }
      } catch (e: any) {
        Alert.alert("Booking Failed", e.message ?? "Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [user, isMockUser, restaurantId, bookingDate, bookingTime, partySize, isRequestBooking, router],
  );

  const handleConfirmBooking = useCallback(
    async (formData?: any) => {
      await submitBooking(formData);
    },
    [submitBooking],
  );

  const handleCancelBooking = useCallback(() => {
    setShowConfirmationModal(false);
  }, []);

  return {
    restaurant,
    loading,
    submitting,
    availableOffers: [] as any[],
    invitedFriends: [] as any[],
    selectedOffer: null as any,
    selectedOfferUserId: null as string | null,
    isRequestBooking,
    ratingEligibility: null,
    ratingRestricted: false,
    ratingMessage: null,
    guaranteeInfo: null,
    guaranteeLoading: false,
    paymentMethods: [] as any[],
    paymentMethodsLoading: false,
    selectedPaymentMethodId: null as string | null,
    profile,
    bookingDate,
    bookingTime,
    partySize,
    totalPartySize: partySize,
    turnTime: restaurant?.table_turnover_minutes ?? 120,
    selectedTableIds: [] as string[],
    requiresCombination: false,
    showConfirmationModal,
    handleConfirmBooking,
    handleCancelBooking,
    submitBooking,
    setSelectedOfferUserId: (_id: string | null) => {},
    handleInvitesSent: (_friends: any[]) => {},
    setSelectedPaymentMethodId: (_id: string | null) => {},
    openCheckout: (_options?: any) => { setShowConfirmationModal(true); },
    fetchPaymentMethods: async () => {},
    depositInfo: null,
    showDepositPaymentSheet: false,
    handleDepositSuccess: () => {},
    handleDepositClose: () => {},
    currentBookingId: null,
    initiateDepositPayment: async () => {},
    depositPaymentLoading: false,
  };
}
