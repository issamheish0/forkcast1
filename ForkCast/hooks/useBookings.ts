// hooks/useBookings.ts — Supabase-backed (falls back to mock for test user)
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import {
  MOCK_UPCOMING_BOOKINGS,
  MOCK_PAST_BOOKINGS,
  MOCK_USER_ID,
} from "@/lib/mockData";

// Re-export types used by consumers
export type EnhancedWaitlistEntry = {
  id: string;
  user_id: string | null;
  restaurant_id: string;
  desired_date: string;
  desired_time_range: string;
  party_size: number;
  status: string;
  special_requests?: string | null;
  created_at?: string | null;
  restaurant?: { id: string; name: string; main_image_url?: string; address?: string; [key: string]: any };
  isWaitlistEntry: true;
  [key: string]: any;
};

const BOOKING_FIELDS = `
  id, user_id, restaurant_id, booking_time, party_size,
  status, special_requests, occasion, dietary_notes,
  confirmation_code, turn_time_minutes, source, created_at,
  restaurant:restaurants(id, name, main_image_url, address)
`;

function isUpcoming(b: any) {
  return (
    ["confirmed", "pending", "seated"].includes(b.status) &&
    new Date(b.booking_time) >= new Date()
  );
}
function isPast(b: any) {
  return (
    ["completed", "cancelled_by_user", "cancelled_by_restaurant", "no_show"].includes(b.status) ||
    new Date(b.booking_time) < new Date()
  );
}

export function useBookings() {
  const router = useRouter();
  const { user } = useAuth();
  const isMockUser = !user || user.id === MOCK_USER_ID;

  const [upcomingBookings, setUpcomingBookings] = useState<any[]>(
    isMockUser ? MOCK_UPCOMING_BOOKINGS : [],
  );
  const [pastBookings, setPastBookings] = useState<any[]>(
    isMockUser ? MOCK_PAST_BOOKINGS : [],
  );
  const [loading, setLoading] = useState(!isMockUser);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [showingWaitlistTab, setShowingWaitlistTab] = useState(false);
  const [showPunchCardModal, setShowPunchCardModal] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (isMockUser) {
      setUpcomingBookings(MOCK_UPCOMING_BOOKINGS);
      setPastBookings(MOCK_PAST_BOOKINGS);
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_FIELDS)
      .eq("user_id", user!.id)
      .order("booking_time", { ascending: false });

    if (error || !data) return;

    setUpcomingBookings(data.filter(isUpcoming));
    setPastBookings(data.filter(isPast));
  }, [isMockUser, user]);

  useEffect(() => {
    if (isMockUser) return;
    setLoading(true);
    loadBookings().finally(() => setLoading(false));
  }, [isMockUser, loadBookings]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      if (isMockUser) return { success: true };
      setProcessingBookingId(bookingId);
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled_by_user" })
        .eq("id", bookingId)
        .eq("user_id", user!.id);
      setProcessingBookingId(null);
      if (error) return { success: false, error: error.message };
      await loadBookings();
      return { success: true };
    },
    [isMockUser, user, loadBookings],
  );

  return {
    bookings: {
      upcoming: upcomingBookings,
      past: pastBookings,
    },
    upcomingBookings,
    pastBookings,
    waitlistEntries: [] as EnhancedWaitlistEntry[],
    loading,
    refreshing,
    isRefreshing: refreshing,
    isInitialized: true,
    error: null,
    processingBookingId,
    activeTab,
    setActiveTab,
    showingWaitlistTab,
    setShowingWaitlistTab,
    showPunchCardModal,
    setShowPunchCardModal,
    handleRefresh,
    cancelBooking,
    leaveBooking: async (_id: string) => ({ success: true }),
    rebookRestaurant: (_id: string) => {},
    reviewBooking: (_id: string) => {},
    navigateToBookingDetails: (id: string) =>
      router.push(`/(protected)/booking/${id}` as any),
    navigateToRestaurant: (id: string) =>
      router.push(`/(protected)/restaurant/${id}` as any),
    navigateToSearch: () =>
      router.push("/(protected)/(tabs)/search" as any),
    loadingMorePastBookings: false,
    hasMorePastBookings: false,
    loadMorePastBookings: () => {},
    refresh: handleRefresh,
  };
}

