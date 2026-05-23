// app/(protected)/(tabs)/bookings.tsx
import React, { useCallback } from "react";
import {
  View,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import {
  Calendar,
  Clock,
  UserPlus,
  Mail,
  Sparkles,
} from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TabButton } from "@/components/ui/tab-button";
import { PageHeader } from "@/components/ui/page-header";
import { BookingCard } from "@/components/booking/BookingCard";
import { WaitlistCard } from "@/components/booking/WaitlistCard";
import { PendingPaymentBanner } from "@/components/booking/PendingPaymentBanner";
import { useColorScheme } from "@/lib/useColorScheme";
import { useBookings, type EnhancedWaitlistEntry } from "@/hooks/useBookings";
import { useAuth } from "@/context/supabase-provider";
import { useBookingInvitations } from "@/hooks/useBookingInvitations";
import { useDepositCheckout } from "@/hooks/useDepositCheckout";
import { usePendingCheckouts } from "@/hooks/usePendingCheckouts";
import { supabase } from "@/config/supabase";
import BookingsScreenSkeleton from "@/components/skeletons/BookingsScreenSkeleton";
import { PendingInvitationPopup } from "@/components/booking/PendingInvitationPopup";
import { PunchCardInfoModal } from "@/components/booking/PunchCardInfoModal";
import { getRefreshControlColor } from "@/lib/utils";
import { colors } from "@/constants/colors";

function BookingsScreenContent() {
  const router = useRouter();
  const { isGuest, convertGuestToUser, user } = useAuth();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const themeColors = colorScheme === "dark" ? colors.dark : colors.light;
  const diningStatsIconColor =
    colorScheme === "dark" ? themeColors.foreground : "#f59e0b";
  const invitationsIconColor =
    colorScheme === "dark" ? themeColors.foreground : themeColors.primary;

  // Invitations hooks
  const { acceptInvitation, declineInvitation, getPendingInvitations } =
    useBookingInvitations();

  // State for pending invitations popup
  const [pendingInvitations, setPendingInvitations] = React.useState<any[]>([]);
  const [showInvitationPopup, setShowInvitationPopup] = React.useState(false);
  const [hasCheckedInvitations, setHasCheckedInvitations] =
    React.useState(false);

  // --- Authenticated User Hooks (must be called before any early returns) ---
  const {
    activeTab,
    setActiveTab,
    bookings,
    loading,
    refreshing,
    processingBookingId,
    error,
    isInitialized,
    handleRefresh,
    navigateToBookingDetails,
    navigateToRestaurant,
    navigateToSearch,
    cancelBooking,
    leaveBooking,
    rebookRestaurant,
    reviewBooking,
    // Pagination for past bookings
    loadingMorePastBookings,
    hasMorePastBookings,
    loadMorePastBookings,
  } = useBookings();

  // Deposit payment hook
  const {
    initiatePayment: initiateDepositPayment,
    loading: depositPaymentLoading,
  } = useDepositCheckout();

  // Pending checkouts hook - shows banners for incomplete payments
  const {
    pendingCheckouts,
    dismissCheckout,
    refresh: refreshPendingCheckouts,
  } = usePendingCheckouts();

  // Handler for paying deposit on pending_payment bookings
  const handlePayDeposit = useCallback(
    async (booking: any) => {
      try {
        // Fetch deposit info for this booking
        const { data: depositData, error: depositError } = await supabase
          .from("booking_deposits")
          .select("*, deposit_setting:deposit_settings(*)")
          .eq("booking_id", booking.id)
          .single();

        if (depositError || !depositData) {
          // If no deposit record exists, try to get deposit settings from restaurant
          const { data: depositSettings, error: settingsError } = await supabase
            .from("deposit_settings")
            .select("*")
            .eq("restaurant_id", booking.restaurant_id)
            .eq("is_active", true)
            .single();

          if (settingsError || !depositSettings) {
            Alert.alert(
              "Error",
              "Could not find deposit information for this booking.",
            );
            return;
          }

          // Calculate deposit amount based on party size
          const depositAmount = depositSettings.per_person
            ? depositSettings.amount * booking.party_size
            : depositSettings.amount;

          // Get service fee from restaurant
          const { data: restaurant } = await supabase
            .from("restaurants")
            .select(
              "montypay_service_fee_percentage, whish_service_fee_percentage",
            )
            .eq("id", booking.restaurant_id)
            .single();

          const provider = depositSettings.payment_provider || "montypay";
          const serviceFeePercentage =
            provider === "whish"
              ? restaurant?.whish_service_fee_percentage || 0
              : restaurant?.montypay_service_fee_percentage || 0;
          const serviceFee = (depositAmount * serviceFeePercentage) / 100;

          await initiateDepositPayment({
            bookingId: booking.id,
            provider: provider as "montypay" | "whish",
            pricing: {
              depositAmount,
              serviceFee,
              serviceFeePercentage,
              total: depositAmount + serviceFee,
              currency: "USD",
            },
            depositSettingId: depositSettings.id,
            partySize: booking.party_size,
            source: "app",
          });
        } else {
          // Use existing deposit record
          const provider =
            depositData.payment_provider ||
            depositData.deposit_setting?.payment_provider ||
            "montypay";

          await initiateDepositPayment({
            bookingId: booking.id,
            provider: provider as "montypay" | "whish",
            pricing: {
              depositAmount: parseFloat(depositData.amount),
              serviceFee: parseFloat(depositData.service_fee || "0"),
              serviceFeePercentage: 0, // Already calculated
              total: parseFloat(depositData.total_amount),
              currency: depositData.currency || "USD",
            },
            depositSettingId: depositData.deposit_setting_id,
            partySize: booking.party_size,
            source: "app",
          });
        }

        // After payment attempt, refresh bookings
        setTimeout(() => {
          handleRefresh();
        }, 2000);
      } catch {
        Alert.alert("Error", "Failed to initiate payment. Please try again.");
      }
    },
    [initiateDepositPayment, handleRefresh],
  );

  // Safe access to bookings with fallback - stabilize the reference
  const currentBookings = React.useMemo(() => {
    try {
      const itemsList =
        activeTab === "upcoming" ? bookings.upcoming : bookings.past;
      const safeList = Array.isArray(itemsList) ? itemsList : [];
      // Return empty array if no valid items to prevent render issues
      return safeList.filter((item) => item && item.id);
    } catch {
      return [];
    }
  }, [activeTab, bookings.upcoming, bookings.past]);

  // Reference to track when we're near the end of the list for infinite scrolling
  const flatListRef = React.useRef<ScrollView>(null);
  const onScroll = React.useCallback(
    (event: any) => {
      // Only handle scrolling for past bookings
      if (
        activeTab !== "past" ||
        !hasMorePastBookings ||
        loadingMorePastBookings
      )
        return;

      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const paddingToBottom = 20; // Load more when within 20px of the bottom
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;

      if (isCloseToBottom) {
        loadMorePastBookings();
      }
    },
    [
      activeTab,
      hasMorePastBookings,
      loadingMorePastBookings,
      loadMorePastBookings,
    ],
  );

  // Refresh bookings when the tab becomes focused
  // Use time-based check to avoid overwhelming the API while still providing fresh data
  const lastFocusRefreshRef = React.useRef<number>(0);
  const FOCUS_REFRESH_COOLDOWN_MS = 30000; // 30 seconds - only refresh on focus if it's been 30+ seconds

  // Refresh bookings when the tab becomes focused - use ref to avoid dependency issues
  const handleRefreshRef = React.useRef(handleRefresh);
  React.useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  }, [handleRefresh]);

  const focusRefreshCallback = useCallback(() => {
    if (user && !isGuest && isInitialized) {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastFocusRefreshRef.current;

      // Only refresh if it's been more than 30 seconds since last focus refresh
      if (timeSinceLastRefresh > FOCUS_REFRESH_COOLDOWN_MS) {
        lastFocusRefreshRef.current = now;
        handleRefreshRef.current();
      }
    }
  }, [user, isGuest, isInitialized]); // Removed handleRefresh from deps

  useFocusEffect(focusRefreshCallback);

  // Memoize FAB position to prevent re-renders - moved after all other hooks
  // Always calculate to ensure consistent hook order
  const fabBottomPosition = React.useMemo(
    () => Math.max((insets?.bottom ?? 0) + 24, 100),
    [insets?.bottom],
  );

  // Check for pending invitations when screen loads
  React.useEffect(() => {
    const checkPendingInvitations = async () => {
      if (!user || isGuest || hasCheckedInvitations) return;

      try {
        const pending = await getPendingInvitations();
        if (pending.length > 0) {
          setPendingInvitations(pending);
          setShowInvitationPopup(true);
        }
        setHasCheckedInvitations(true);
      } catch {
        setHasCheckedInvitations(true);
      }
    };

    // Only check once when the user is authenticated and initialized
    if (user && !isGuest && isInitialized) {
      checkPendingInvitations();
    }
  }, [
    user,
    isGuest,
    isInitialized,
    hasCheckedInvitations,
    getPendingInvitations,
  ]);

  // Handle invitation actions
  const handleAcceptInvitation = async (invitationId: string) => {
    const success = await acceptInvitation(invitationId);
    if (success) {
      // Remove the accepted invitation from pending list
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv.id !== invitationId),
      );
      // Add a small delay to ensure database consistency, then refresh bookings
      setTimeout(() => {
        handleRefresh();
      }, 1000);
    } else {
    }
    return success;
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    const success = await declineInvitation(invitationId);
    if (success) {
      // Remove the declined invitation from pending list
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv.id !== invitationId),
      );
    }
    return success;
  };

  const handleCloseInvitationPopup = () => {
    setShowInvitationPopup(false);
  };

  const handleViewAllInvitations = () => {
    setShowInvitationPopup(false);
    router.push("/(protected)/invitations");
  };

  // --- Guest View ---
  // If the user is a guest, show a call-to-action screen to sign up.
  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Header */}
        <View className="p-4">
          <H2>My Bookings</H2>
        </View>

        {/* Guest State */}
        <View className="flex-1 items-center justify-center px-6 -mt-10">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
            <Calendar size={48} className="text-primary" />
          </View>

          <H2 className="text-center mb-2">Book Your Table</H2>
          <P className="text-center text-muted-foreground mb-8">
            Create an account to make reservations at the best restaurants in
            Lebanon. It&apos;s quick, easy, and free!
          </P>

          <Button
            onPress={convertGuestToUser}
            size="lg"
            className="w-full max-w-xs"
          >
            <UserPlus size={20} color="#fff" />
            <Text className="ml-2 font-bold text-white">Sign Up to Book</Text>
          </Button>

          <Button
            onPress={() => router.push("/(protected)/(tabs)/search")}
            size="lg"
            variant="ghost"
            className="w-full max-w-xs mt-2"
          >
            <Text>Explore Restaurants</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // --- Loading State ---
  if (loading || !isInitialized) {
    return <BookingsScreenSkeleton />;
  }

  // --- Error State ---
  if (error && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <PageHeader title="My Bookings" />
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-full bg-destructive/10 items-center justify-center mb-6">
            <Calendar size={48} className="text-destructive" />
          </View>
          <H2 className="text-center mb-2">Unable to Load Bookings</H2>
          <P className="text-center text-muted-foreground mb-6">
            {error.message || "Something went wrong. Please try again."}
          </P>
          <Button onPress={handleRefresh} variant="default" size="lg">
            <Text>Try Again</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <PageHeader
        title="My Bookings"
        subtitle="Tap any booking for full details and options"
        actions={
          <View className="flex-row items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.navigate("/(protected)/my-journey")}
              className="flex-row items-center gap-2 px-3"
            >
              <Sparkles size={18} color={diningStatsIconColor} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push("/(protected)/invitations")}
              className="flex-row items-center gap-2 px-3"
            >
              <Mail size={18} color={invitationsIconColor} />
            </Button>
          </View>
        }
      />

      {/* Tabs */}
      <View className="flex-row border-b border-border bg-background">
        <TabButton
          title="Upcoming"
          isActive={activeTab === "upcoming"}
          onPress={() => setActiveTab("upcoming")}
          count={bookings.upcoming.length}
        />
        <TabButton
          title="Past"
          isActive={activeTab === "past"}
          onPress={() => setActiveTab("past")}
          // Removed count as it's not useful for past bookings
        />
      </View>

      {/* Punch Card Info Modal - Shows once to explain the feature */}
      {!isGuest && <PunchCardInfoModal />}

      {/* Pending Payment Banners - Show when user has incomplete checkout */}
      {pendingCheckouts.length > 0 && activeTab === "upcoming" && (
        <View>
          {pendingCheckouts.map((checkout) => (
            <PendingPaymentBanner
              key={checkout.id}
              bookingId={checkout.bookingId}
              restaurantName={checkout.restaurantName}
              expiresAt={checkout.checkoutExpiresAt}
              onComplete={() => {
                router.push(`/booking/${checkout.bookingId}`);
              }}
              onDismiss={() => dismissCheckout(checkout.bookingId)}
            />
          ))}
        </View>
      )}

      {/* Content with ScrollView for pull-to-refresh and infinite scrolling */}
      <ScrollView
        ref={flatListRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={400} // Throttle scroll events for performance
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              handleRefresh();
              refreshPendingCheckouts();
            }}
            tintColor={getRefreshControlColor(colorScheme)}
          />
        }
      >
        <View style={{ minHeight: "100%" }}>
          {currentBookings.length === 0 ? (
            <View className="flex-1 justify-center py-20">
              {activeTab === "upcoming" ? (
                <EmptyState
                  icon={Calendar}
                  title="No Upcoming Bookings"
                  subtitle="Discover amazing restaurants and make your next reservation"
                  actionLabel="Explore Restaurants"
                  onAction={navigateToSearch}
                />
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No Past Bookings"
                  subtitle="Your completed bookings will appear here"
                />
              )}
            </View>
          ) : (
            <View className="p-4 pb-24">
              {currentBookings.map((item) => {
                // Check if this is a waitlist entry or a booking
                if ("isWaitlistEntry" in item && item.isWaitlistEntry) {
                  // Render waitlist card
                  const waitlistEntry = item as EnhancedWaitlistEntry;
                  return (
                    <WaitlistCard
                      key={`waitlist-${item.id}`}
                      waitlistEntry={waitlistEntry}
                      variant={activeTab}
                      onPress={() => {
                        // Navigate to waitlist details page
                        router.push(
                          `/(protected)/waitlist/${waitlistEntry.id}`,
                        );
                      }}
                      onNavigateToRestaurant={navigateToRestaurant}
                      processingWaitlistId={processingBookingId}
                    />
                  );
                } else {
                  // Render booking card
                  const booking = item as any; // Since we've already checked it's not a waitlist entry
                  return (
                    <BookingCard
                      key={`booking-${item.id}`}
                      booking={booking}
                      variant={activeTab}
                      onPress={() => navigateToBookingDetails(item.id)}
                      onCancel={cancelBooking}
                      onLeave={leaveBooking}
                      onRebook={rebookRestaurant}
                      onReview={reviewBooking}
                      onNavigateToRestaurant={navigateToRestaurant}
                      onPayDeposit={handlePayDeposit}
                      processingBookingId={processingBookingId}
                    />
                  );
                }
              })}
              {/* Load more indicator for past bookings */}
              {activeTab === "past" && hasMorePastBookings && (
                <View className="py-4 items-center">
                  {loadingMorePastBookings ? (
                    <ActivityIndicator
                      size="small"
                      color={colorScheme === "dark" ? "#ffffff" : "#000000"}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={loadMorePastBookings}
                      className="mt-2"
                    >
                      <Text>Load More</Text>
                    </Button>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pending Invitations Popup */}
      <PendingInvitationPopup
        invitations={pendingInvitations}
        visible={showInvitationPopup}
        onClose={handleCloseInvitationPopup}
        onAccept={handleAcceptInvitation}
        onDecline={handleDeclineInvitation}
        onViewAll={handleViewAllInvitations}
      />

    </SafeAreaView>
  );
}

// Wrap with ErrorBoundary to prevent crashes
export default function BookingsScreen() {
  return (
    <ErrorBoundary>
      <BookingsScreenContent />
    </ErrorBoundary>
  );
}
