// hooks/useEventBooking.ts — Mock stub
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import type { RestaurantEvent, EventOccurrence, EventEligibility } from "@/types/events";
import { useEventEligibility } from "@/hooks/useEventEligibility";

export function useEventBooking() {
  const router = useRouter();
  return {
    createEventBooking: async (_params: any) => {
      Alert.alert("Mock Mode", "Event booking created (mock)!");
    },
    createPaidEventBooking: async (_params: any) => {
      Alert.alert("Mock Mode", "Paid event booking created (mock)!");
    },
    loading: false,
    error: null as Error | null,
  };
}

export function useEventBookingWithEligibility(
  event: RestaurantEvent | null | undefined,
  occurrence: EventOccurrence | null | undefined,
  partySize: number,
) {
  const router = useRouter();
  const { createEventBooking, loading, error } = useEventBooking();
  const eligibility = useEventEligibility(event, occurrence, partySize);

  return {
    handleBookEvent: async () => {
      Alert.alert("Mock Mode", "Event booked (mock)!");
      router.back();
    },
    eligibility,
    loading,
    error,
  };
}