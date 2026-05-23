import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  ScrollView,
  View,
  Pressable,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Copy,
  Calendar,
  Users,
  Timer,
  Gift,
  Tag,
  TableIcon,
  MapPin,
  Sparkles,
  CreditCard,
  Clock,
  DollarSign,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { NavigationHeader } from "@/components/ui/navigation-header";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { useEventPaymentCheckout } from "@/hooks/useEventPaymentCheckout";
import { useDepositCheckout } from "@/hooks/useDepositCheckout";
import { useDepositPayment } from "@/hooks/useDepositPayment";
import { DepositPaymentSheet } from "@/components/booking/DepositPaymentSheet";
import type { DepositCheckResult } from "@/hooks/useDepositPayment";

import {
  formatLebanonDateLong,
  formatLebanonTime,
  parseFromLebanonTZ,
  getCurrentLebanonTime,
  isLebanonToday,
  isLebanonTomorrow,
} from "@/utils/lebanonTime";

// Import components - WITH FIXES APPLIED
import {
  BookingDetailsHeader,
  BookingActionsBar,
  BookingContactSection,
  AppliedOfferCard,
  BookingInvitationsSection,
  EditableBookingFields,
} from "@/components/booking";
import { BookingTableInfo } from "@/components/booking/BookingTableInfo";

// Import custom hook
import { useBookingDetails } from "@/hooks/useBookingDetails";
import { useRestaurantSections } from "@/hooks/useRestaurantSections";

// Import constants
import { BOOKING_STATUS_CONFIG } from "@/constants/bookingConstants";
import BookingDetailsScreenSkeleton from "@/components/skeletons/BookingDetailsScreenSkeleton";
import { useShare } from "@/hooks/useShare";

/**
 * Formats table preference text for display
 * Converts snake_case to Title Case (e.g., "window_seat" -> "Window Seat")
 */
const formatTablePreference = (preference: string): string => {
  // Handle common table preference values
  const formatted = preference
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return formatted;
};


function BookingDetailsScreen() {
  const [isMounted, setIsMounted] = useState(false);

  // State for booking field updates
  const [bookingFields, setBookingFields] = useState<{
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  }>({});

  const { shareBooking: shareBookingWithDeepLink } = useShare();

  // Payment checkout hook for completing pending payments
  const { openPaymentCheckout, loading: paymentLoading } =
    useEventPaymentCheckout();

  // Deposit payment hook and state
  const {
    initiatePayment: initiateDepositPayment,
    loading: depositPaymentLoading,
  } = useDepositCheckout();
  const { checkDepositRequired } = useDepositPayment();
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [depositCheckResult, setDepositCheckResult] =
    useState<DepositCheckResult | null>(null);
  const [pendingDepositInfo, setPendingDepositInfo] =
    useState<DepositCheckResult | null>(null);

  // Live countdown timer state for pending payments
  const [liveTimeRemaining, setLiveTimeRemaining] = useState<{
    minutes: number;
    seconds: number;
    totalMs: number;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const themeColors = useMemo(
    () => colors[colorScheme] ?? colors.light,
    [colorScheme],
  );

  // Enhanced validation and logging for booking ID from params
  const bookingId = useMemo(() => {
    let extractedId = "";
    try {
      if (typeof params.id === "string" && params.id.trim().length > 0) {
        extractedId = params.id.trim();
      } else if (Array.isArray(params.id) && params.id.length > 0) {
        extractedId = String(params.id[0]).trim();
      } else if (params.id) {
        extractedId = String(params.id).trim();
      }
    } catch (error) {
      console.error("[BookingDetails] Error extracting booking ID:", error);
    }
    return extractedId;
  }, [params]);

  // Declined explanation state - default to expanded
  const [showDeclinedExplanation, setShowDeclinedExplanation] = useState(true);

  // Waitlist origin state
  const [isWaitlistOrigin, setIsWaitlistOrigin] = useState(false);

  // Use custom hook for all booking logic
  const {
    booking,
    loading,
    processing,
    hasReview,
    appliedOfferDetails,
    appliedPromoDetails,
    assignedTables,
    guaranteeInfo,
    depositInfo,
    isUpcoming,
    isToday,
    isTomorrow,
    cancelBooking,
    copyOfferCode,
  } = useBookingDetails(bookingId);

  // Fetch restaurant sections to display section name
  const { sections: restaurantSections } = useRestaurantSections(
    booking?.restaurant_id,
  );

  // Initialize booking fields when booking data loads
  useEffect(() => {
    if (booking) {
      setBookingFields({
        occasion: booking.occasion,
        special_requests: booking.special_requests,
        dietary_notes: booking.dietary_notes,
      });
    }
  }, [booking]);

  // Check deposit requirements when booking is pending_payment but no depositInfo
  // This handles the case where a booking was modified to require deposit
  useEffect(() => {
    async function checkPendingDeposit() {
      if (!booking) return;

      // Only check if booking is pending_payment and we don't have depositInfo with pending status
      const isPendingPaymentStatus = booking.status === "pending_payment";
      const hasExistingPendingDeposit = depositInfo?.status === "pending";
      const isEventBooking =
        (booking as any)?.is_event_booking &&
        !!(booking as any)?.event_occurrence?.event;

      // Skip if not pending_payment, already have pending deposit info, or it's an event booking
      if (
        !isPendingPaymentStatus ||
        hasExistingPendingDeposit ||
        isEventBooking
      ) {
        setPendingDepositInfo(null);
        return;
      }

      try {
        const bookingTime = parseFromLebanonTZ(booking.booking_time);
        const result = await checkDepositRequired(
          booking.restaurant_id,
          bookingTime,
          booking.party_size,
        );

        if (result.required) {
          setPendingDepositInfo(result);
        } else {
          setPendingDepositInfo(null);
        }
      } catch (error) {
        console.error("Error checking deposit requirements:", error);
        setPendingDepositInfo(null);
      }
    }

    checkPendingDeposit();
  }, [booking, depositInfo?.status, checkDepositRequired]);

  // Helper to get section name from id
  const getSectionName = useCallback(
    (sectionId: string | null | undefined): string => {
      if (!sectionId) return "No preference";
      const section = restaurantSections.find((s) => s.id === sectionId);
      return section?.name || sectionId;
    },
    [restaurantSections],
  );

  // Handler for booking field updates
  const handleBookingFieldsUpdate = (updatedFields: {
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  }) => {
    setBookingFields(updatedFields);
  };

  // Check if booking came from waitlist entry
  useEffect(() => {
    const checkWaitlistOrigin = async () => {
      if (!booking?.id) return;

      try {
        const { data: waitlistData } = await supabase
          .from("waitlist")
          .select("id, status")
          .eq("converted_booking_id", booking.id)
          .single();

        if (waitlistData) {
          setIsWaitlistOrigin(true);
        }
      } catch (err) {
        console.error("Error checking waitlist origin:", err);
      }
    };

    checkWaitlistOrigin();
  }, [booking?.id]);

  // Additional state for pending bookings
  const bookingDate = booking
    ? parseFromLebanonTZ(booking.booking_time)
    : getCurrentLebanonTime();

  // Check if pending booking has passed its time (should be treated as declined)
  const isPendingAndPassed =
    booking?.status === "pending" && bookingDate < getCurrentLebanonTime();
  const isPending = booking?.status === "pending" && !isPendingAndPassed;
  const isDeclined =
    booking?.status === "declined_by_restaurant" ||
    booking?.status === "auto_declined";
  const isPendingPayment = booking?.status === "pending_payment";

  // Check if this is an event booking (has event_occurrence)
  const isEventBooking =
    (booking as any)?.is_event_booking &&
    !!(booking as any)?.event_occurrence?.event;

  // Check if payment has expired (for pending_payment bookings)
  const isPaymentExpired = useMemo(() => {
    if (!isPendingPayment || !booking?.payment_expires_at) return false;
    const expiryTime = new Date(booking.payment_expires_at);
    return expiryTime < getCurrentLebanonTime();
  }, [isPendingPayment, booking?.payment_expires_at]);

  // Live countdown timer effect - updates every second
  useEffect(() => {
    if (!isPendingPayment || !booking?.payment_expires_at || isPaymentExpired) {
      setLiveTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const expiryTime = new Date(booking.payment_expires_at!);
      const now = getCurrentLebanonTime();
      const diffMs = expiryTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setLiveTimeRemaining(null);
        return;
      }

      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      setLiveTimeRemaining({ minutes, seconds, totalMs: diffMs });
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [isPendingPayment, booking?.payment_expires_at, isPaymentExpired]);

  // Use live timer for display (backwards compatible name)
  const paymentTimeRemaining = liveTimeRemaining;

  // Complete payment handler for pending_payment bookings
  const handleCompletePayment = useCallback(async () => {
    if (!booking || !isPendingPayment) return;

    if (isPaymentExpired) {
      Alert.alert(
        "Payment Expired",
        "The payment window has expired. Please create a new booking.",
        [{ text: "OK" }],
      );
      return;
    }

    // Get event title if this is an event booking
    const eventTitle =
      (booking as any).event_occurrence?.event?.title || "Event Booking";

    // Determine payment method from existing data
    // Check if there's a whish transaction for this booking
    const { data: whishTx } = await supabase
      .from("whish_transactions")
      .select("id")
      .eq("booking_id", booking.id)
      .single();

    const paymentMethod: "card" | "whish" = whishTx ? "whish" : "card";

    // Calculate pricing details
    const total = booking.payment_amount || 0;
    const pricePerPerson = total / booking.party_size;
    // Default service charge percentage (can be adjusted based on event settings)
    const serviceChargePercentage = 0;
    const subtotal = total / (1 + serviceChargePercentage / 100);
    const serviceChargeAmount = total - subtotal;

    const success = await openPaymentCheckout({
      bookingId: booking.id,
      eventTitle,
      pricing: {
        partySize: booking.party_size,
        pricePerPerson,
        subtotal,
        serviceChargePercentage,
        serviceChargeAmount,
        total,
        currency: "USD",
        paymentMethod,
      },
    });

    if (success) {
      // After payment browser closes, refresh the booking to check status
      // The webhook will update the booking status
      Alert.alert(
        "Payment Processing",
        "Please wait while we verify your payment. The page will refresh automatically.",
        [{ text: "OK" }],
      );
      // Force a refetch by navigating back and forth or refreshing
      router.replace(`/booking/${booking.id}`);
    }
  }, [
    booking,
    isPendingPayment,
    isPaymentExpired,
    openPaymentCheckout,
    router,
  ]);

  // Handler for opening deposit payment sheet
  const handlePayDeposit = useCallback(() => {
    if (!booking) return;

    // Case 1: We have existing depositInfo with pending status
    if (depositInfo && depositInfo.status === "pending") {
      // Build a DepositCheckResult from our existing depositInfo
      const checkResult: DepositCheckResult = {
        required: true,
        settingId: depositInfo.depositSettingId ?? undefined,
        depositAmount: depositInfo.amount,
        feeType: "fixed", // We don't store this, but it doesn't matter for display
        currency: depositInfo.currency,
        totalDeposit: depositInfo.amount,
        serviceFeePercentage:
          depositInfo.serviceFee > 0
            ? (depositInfo.serviceFee / depositInfo.amount) * 100
            : 0,
        serviceFee: depositInfo.serviceFee,
        totalCharge: depositInfo.totalAmount,
        refundPolicy: depositInfo.refundPolicy as "full" | "partial" | "none",
        refundWindowHours: depositInfo.refundWindowHours,
        partialRefundPercentage: depositInfo.partialRefundPercentage,
        minimumPartySize: 1,
        settings: null,
      };

      setDepositCheckResult(checkResult);
      setShowDepositSheet(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    // Case 2: We have pendingDepositInfo from fresh check (booking modified to need deposit)
    if (pendingDepositInfo && pendingDepositInfo.required) {
      setDepositCheckResult(pendingDepositInfo);
      setShowDepositSheet(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
  }, [booking, depositInfo, pendingDepositInfo]);

  // Handler for deposit payment confirmation
  const handleDepositConfirm = useCallback(
    async (
      method: "montypay" | "whish",
      pricing: {
        depositAmount: number;
        serviceFee: number;
        serviceFeePercentage: number;
        total: number;
        currency: string;
      },
    ) => {
      if (!booking) return;

      // Get deposit setting ID from either depositInfo or pendingDepositInfo
      const settingId =
        depositInfo?.depositSettingId || pendingDepositInfo?.settingId;
      const partySize = depositInfo?.partySize || booking.party_size;

      setShowDepositSheet(false);

      const success = await initiateDepositPayment({
        bookingId: booking.id,
        provider: method,
        pricing: pricing,
        depositSettingId: settingId || undefined,
        partySize: partySize,
        source: "app",
      });

      if (success) {
        Alert.alert(
          "Payment Processing",
          "Please wait while we verify your deposit payment. The page will refresh automatically.",
          [{ text: "OK" }],
        );
        // Refresh the booking to check updated status
        router.replace(`/booking/${booking.id}`);
      } else {
        Alert.alert(
          "Payment Failed",
          "Could not initiate deposit payment. Please try again.",
          [{ text: "OK" }],
        );
      }
    },
    [booking, depositInfo, pendingDepositInfo, initiateDepositPayment, router],
  );

  // Calculate if we're within the cancellation window
  const isWithinCancellationWindow = useMemo(() => {
    if (!booking || !booking.restaurant) return false;

    // Pending booking requests should always be cancellable by the user,
    // even if they fall within the restaurant's cancellation window.
    if (booking.status === "pending" || booking.status === "pending_payment")
      return false;

    const cancellationWindowHours =
      (booking.restaurant as any).cancellation_window_hours || 0;
    if (cancellationWindowHours === 0) return false;

    const now = getCurrentLebanonTime();
    const bookingTime = parseFromLebanonTZ(booking.booking_time);
    const hoursUntilBooking =
      (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If we're within the cancellation window (less than the required hours), return true
    return hoursUntilBooking > 0 && hoursUntilBooking < cancellationWindowHours;
  }, [booking]);

  // Navigation handlers with error handling
  const navigateToReview = () => {
    try {
      if (!booking || !booking.restaurant) return;
      const params = new URLSearchParams({
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name || "",
      });
      router.push(`/review/create?${params.toString()}`);
    } catch (error) {
      console.error("[BookingDetails] Navigation to review failed:", error);
      Alert.alert("Error", "Failed to navigate to review page");
    }
  };

  const navigateToRestaurant = () => {
    try {
      if (!booking || !booking.restaurant_id) return;
      router.push(`/restaurant/${booking.restaurant_id}`);
    } catch (error) {
      console.error("[BookingDetails] Navigation to restaurant failed:", error);
      Alert.alert("Error", "Failed to navigate to restaurant page");
    }
  };

  const navigateToOffers = () => {
    try {
      router.push("/offers");
    } catch (error) {
      console.error("[BookingDetails] Navigation to offers failed:", error);
    }
  };

  const navigateToEdit = () => {
    try {
      if (!booking || booking.status !== "pending") return;
      // Use replace so that when user saves and comes back,
      // there's no stale booking details page in the stack
      router.replace(`/booking/edit/${booking.id}`);
    } catch (error) {
      console.error("[BookingDetails] Navigation to edit failed:", error);
      Alert.alert("Error", "Failed to navigate to edit page");
    }
  };

  const bookAgain = () => {
    try {
      if (!booking || !booking.restaurant) return;
      const originalDate = parseFromLebanonTZ(booking.booking_time);
      const now = getCurrentLebanonTime();
      let suggestedDate = originalDate;
      if (originalDate < now) {
        suggestedDate = new Date(originalDate);
        suggestedDate.setDate(suggestedDate.getDate() + 7);
      }
      const params = new URLSearchParams({
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        partySize: booking.party_size.toString(),
        suggestedDate: suggestedDate.toISOString(),
        originalDate: originalDate.toISOString(),
      });
      router.push(`/booking/availability?${params.toString()}`);
    } catch (error) {
      console.error("[BookingDetails] Book again failed:", error);
      Alert.alert("Error", "Failed to create new booking");
    }
  };

  const shareBooking = useCallback(async () => {
    if (!booking || !booking.restaurant) return;

    try {
      const shared = await shareBookingWithDeepLink(
        booking.id,
        booking.restaurant.name,
      );
      if (shared) {
        return;
      }
    } catch (error) {
      console.error("Error sharing booking via deep link:", error);
    }

    const bookingTime = parseFromLebanonTZ(booking.booking_time);
    const statusText = (() => {
      switch (booking.status) {
        case "pending":
          return "I've requested a table";
        case "declined_by_restaurant":
        case "auto_declined":
          return "My booking request was declined";
        default:
          return "I have a reservation";
      }
    })();
    const confirmationSuffix =
      booking.confirmation_code && booking.status !== "pending"
        ? ` Confirmation code: ${booking.confirmation_code}`
        : "";
    const shareMessage = `${statusText} at ${booking.restaurant.name} on ${formatLebanonDateLong(bookingTime)} at ${formatLebanonTime(bookingTime)} for ${booking.party_size} people.${confirmationSuffix}`;

    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${booking.restaurant.name}`,
      });
    } catch (fallbackError) {
      console.error("Error sharing booking via system share:", fallbackError);
    }
  }, [booking, shareBookingWithDeepLink]);

  const copyConfirmationCode = async () => {
    if (!booking?.confirmation_code) return;
    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `${isPending ? "Reference" : "Confirmation"} code ${booking.confirmation_code} copied to clipboard`,
    );
  };

  const copyReservationSummary = async () => {
    if (!booking || !booking.restaurant) return;

    try {
      const timeStr = formatLebanonTime(bookingDate);
      const dateStr = formatLebanonDateLong(bookingDate);

      const summary = [
        "Reservation Summary",
        "",
        `Restaurant: ${booking.restaurant.name}`,
        `Date: ${dateStr}`,
        `Time: ${timeStr}`,
        `Guests: ${booking.party_size} ${booking.party_size === 1 ? "guest" : "guests"}`,
        booking.confirmation_code
          ? `${isPending ? "Reference" : "Confirmation"} code: ${booking.confirmation_code}`
          : "",
        booking.restaurant.address
          ? `Address: ${booking.restaurant.address}`
          : "",
        booking.restaurant.phone_number
          ? `Phone: ${booking.restaurant.phone_number}`
          : "",
        booking.special_requests
          ? `Special requests: ${booking.special_requests}`
          : "",
        booking.occasion ? `Occasion: ${booking.occasion}` : "",
        bookingFields.dietary_notes && bookingFields.dietary_notes.length > 0
          ? `Dietary notes: ${bookingFields.dietary_notes.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      await Clipboard.setStringAsync(summary);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Copied!", "Reservation details copied to clipboard");
    } catch (error) {
      console.error("Error copying reservation summary:", error);
      Alert.alert("Error", "Unable to copy reservation summary");
    }
  };

  const shareAppliedOffer = async () => {
    if (!appliedOfferDetails || !booking || !booking.restaurant) return;
    try {
      await Share.share({
        message: `I saved ${appliedOfferDetails.discount_percentage}% at ${booking.restaurant.name} with a special offer! 🎉 Check out the app for more deals.`,
        title: "Great Deal Alert!",
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  };

  // Enhanced validation: Check for missing or invalid booking ID
  if (
    isMounted &&
    (!bookingId ||
      bookingId === "" ||
      bookingId === "undefined" ||
      bookingId === "null")
  ) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Booking Details"
          onBack={() => router.back()}
          showShare={false}
        />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">
            Invalid Booking
          </Text>
          <Text className="text-center text-muted-foreground mb-4">
            No booking ID was provided. Please try accessing the booking from
            your bookings list.
          </Text>
          <Button
            variant="outline"
            onPress={() => router.push("/(protected)/(tabs)/bookings")}
          >
            <Text>Go to Bookings</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading || !isMounted || !bookingId) {
    return <BookingDetailsScreenSkeleton />;
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Booking Details"
          onBack={() => router.back()}
          showShare={false}
        />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">
            Booking not found
          </Text>
          <Text className="text-center text-muted-foreground mb-4">
            The booking you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Additional validation: Ensure restaurant data exists
  if (!booking.restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Booking Details"
          onBack={() => router.back()}
          showShare={false}
        />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">Data Error</Text>
          <Text className="text-center text-muted-foreground mb-4">
            Restaurant information is missing for this booking. Please try again
            or contact support.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Use declined status for pending bookings that have passed their time
  const effectiveStatus = isPendingAndPassed
    ? "declined_by_restaurant"
    : booking.status;
  const statusConfig =
    BOOKING_STATUS_CONFIG[
      effectiveStatus as keyof typeof BOOKING_STATUS_CONFIG
    ] || BOOKING_STATUS_CONFIG.pending;
  const finalStatusConfig = statusConfig || BOOKING_STATUS_CONFIG.pending;
  const StatusIcon = finalStatusConfig.icon;
  const isBasicRestaurant = (booking.restaurant as any)?.tier === "basic";
  const canEditAdditionalInfo =
    booking.status === "pending" || booking.status === "confirmed";
  const hasAdditionalInfo =
    Boolean(bookingFields.occasion) ||
    Boolean(bookingFields.special_requests) ||
    Boolean(
      bookingFields.dietary_notes && bookingFields.dietary_notes.length > 0,
    );
  const shouldShowAdditionalInfo = hasAdditionalInfo || canEditAdditionalInfo;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <NavigationHeader
        title="Booking Details"
        onBack={() => router.back()}
        showShare
        onShare={shareBooking}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Restaurant Header - USING FIXED COMPONENT */}
        <BookingDetailsHeader
          restaurant={{
            id: booking.restaurant.id,
            name: booking.restaurant.name,
            cuisine_type: booking.restaurant.cuisine_type,
            address: booking.restaurant.address,
            main_image_url: booking.restaurant.main_image_url?.trim() || null,
          }}
          appliedOfferDetails={appliedOfferDetails}
          onPress={navigateToRestaurant}
        />

        {/* Event Information Section - Show if this is an event booking */}
        {(booking as any).is_event_booking &&
          (booking as any).event_occurrence?.event && (
            <View className="px-4 py-4 border-b border-border">
              <Text className="text-lg font-bold mb-3 text-foreground">
                Event Information
              </Text>
              <View className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="bg-purple-100 dark:bg-purple-900/40 rounded-full p-2">
                    <Sparkles size={20} color="#9333ea" />
                  </View>
                  <Text className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {(booking as any).event_occurrence.event.title}
                  </Text>
                </View>

                {(booking as any).event_occurrence.event.description && (
                  <View className="mb-3">
                    <Text className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                      About This Event
                    </Text>
                    <Text className="text-sm text-purple-700 dark:text-purple-300">
                      {(booking as any).event_occurrence.event.description}
                    </Text>
                  </View>
                )}

                <View className="flex-row flex-wrap gap-2 mb-3">
                  {(booking as any).event_occurrence.event.event_type && (
                    <View className="bg-purple-100 dark:bg-purple-900/40 px-3 py-1.5 rounded-full">
                      <Text className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                        {(booking as any).event_occurrence.event.event_type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Text>
                    </View>
                  )}
                  {(booking as any).event_occurrence.event.minimum_age && (
                    <View className="bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full">
                      <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        {(booking as any).event_occurrence.event.minimum_age}+
                        Only
                      </Text>
                    </View>
                  )}
                </View>

                {(booking as any).event_occurrence.event
                  .special_requirements && (
                  <View className="mb-3 bg-white/50 dark:bg-black/20 rounded-lg p-3">
                    <Text className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                      Special Requirements
                    </Text>
                    <Text className="text-sm text-purple-700 dark:text-purple-300">
                      {
                        (booking as any).event_occurrence.event
                          .special_requirements
                      }
                    </Text>
                  </View>
                )}

                {(booking as any).event_occurrence.event.terms_and_conditions &&
                  (booking as any).event_occurrence.event.terms_and_conditions
                    .length > 0 && (
                    <View className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                      <Text className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                        Terms & Conditions
                      </Text>
                      {(
                        booking as any
                      ).event_occurrence.event.terms_and_conditions.map(
                        (term: string, index: number) => (
                          <Text
                            key={index}
                            className="text-xs text-purple-700 dark:text-purple-300 mb-1"
                          >
                            • {term}
                          </Text>
                        ),
                      )}
                    </View>
                  )}
              </View>
            </View>
          )}

        {/* Status Section - Hide for deposit-based pending_payment bookings (they show deposit section instead) */}
        {!(
          isPendingPayment &&
          depositInfo?.hasDeposit &&
          depositInfo?.status === "pending"
        ) && (
          <View className="px-4 py-4 border-b border-border">
            <View
              className="p-4 rounded-lg"
              style={{ backgroundColor: finalStatusConfig.bgColor }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-3">
                  <StatusIcon size={24} color={finalStatusConfig.color} />
                  <Text
                    className="font-bold text-lg"
                    style={{ color: finalStatusConfig.color }}
                  >
                    {finalStatusConfig.label}
                  </Text>
                </View>
                {isDeclined ? (
                  <Pressable
                    onPress={() =>
                      setShowDeclinedExplanation(!showDeclinedExplanation)
                    }
                  >
                    <Info size={16} color={finalStatusConfig.color} />
                  </Pressable>
                ) : null}
              </View>
              <Text
                className="text-sm"
                style={{ color: finalStatusConfig.color }}
              >
                {finalStatusConfig.description}
              </Text>
            </View>

            {/* Declined Status Extra Info */}
            {isDeclined && showDeclinedExplanation ? (
              <View className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                {isWaitlistOrigin ? (
                  <Text className="text-sm text-red-700 dark:text-red-300">
                    You were waitlisted but the booking has expired. The
                    restaurant couldn&apos;t accommodate your request at this
                    time.
                  </Text>
                ) : booking.decline_note && booking.decline_note.trim() ? (
                  <View>
                    <Text className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                      Reason:
                    </Text>
                    <Text className="text-sm text-red-700 dark:text-red-300">
                      {booking.decline_note.trim()}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-sm text-red-700 dark:text-red-300">
                    The restaurant couldn&apos;t accommodate your request at
                    this time. This could be due to full capacity or special
                    events.
                  </Text>
                )}
              </View>
            ) : null}

            {/* Pending Payment Section for EVENT BOOKINGS only - Show payment details and complete button */}
            {/* Deposit bookings are handled separately in the Deposit Payment Section below */}
            {isPendingPayment && isEventBooking ? (
              <View className="mt-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                {isPaymentExpired ? (
                  <>
                    <View className="flex-row items-center gap-2 mb-2">
                      <AlertCircle size={20} color="#dc2626" />
                      <Text className="text-sm font-semibold text-red-800 dark:text-red-200">
                        Payment Window Expired
                      </Text>
                    </View>
                    <Text className="text-sm text-red-700 dark:text-red-300 mb-3">
                      The payment window has expired. Please create a new
                      booking to complete your reservation.
                    </Text>
                    <Button
                      variant="outline"
                      onPress={() =>
                        router.push(`/restaurant/${booking.restaurant_id}`)
                      }
                      className="bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                    >
                      <Text className="text-red-600 dark:text-red-400 font-medium">
                        Create New Booking
                      </Text>
                    </Button>
                  </>
                ) : (
                  <>
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-2">
                        <CreditCard size={20} color="#8b5cf6" />
                        <Text className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                          Complete Payment to Confirm
                        </Text>
                      </View>
                      {paymentTimeRemaining ? (
                        <View className="flex-row items-center gap-1 bg-purple-100 dark:bg-purple-900/40 px-2 py-1 rounded-full">
                          <Clock size={14} color="#8b5cf6" />
                          <Text className="text-xs font-medium text-purple-700 dark:text-purple-300">
                            {paymentTimeRemaining.minutes}:
                            {paymentTimeRemaining.seconds
                              .toString()
                              .padStart(2, "0")}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {booking.payment_amount ? (
                      <View className="bg-white/60 dark:bg-black/20 rounded-lg p-3 mb-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm text-purple-700 dark:text-purple-300">
                            Amount Due
                          </Text>
                          <Text className="text-lg font-bold text-purple-900 dark:text-purple-100">
                            ${booking.payment_amount.toFixed(2)}
                          </Text>
                        </View>
                        <Text className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          {booking.party_size}{" "}
                          {booking.party_size === 1 ? "guest" : "guests"} × $
                          {(
                            booking.payment_amount / booking.party_size
                          ).toFixed(2)}
                          /person
                        </Text>
                      </View>
                    ) : null}

                    <Text className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                      Your spot is reserved until payment is complete. The
                      restaurant will not see your booking until payment is
                      confirmed.
                    </Text>

                    <Button
                      variant="default"
                      onPress={handleCompletePayment}
                      disabled={paymentLoading}
                      className="w-full bg-purple-600 dark:bg-purple-700"
                    >
                      <View className="flex-row items-center justify-center gap-2">
                        <CreditCard size={18} color="white" />
                        <Text className="text-white font-semibold">
                          {paymentLoading
                            ? "Processing..."
                            : "Complete Payment"}
                        </Text>
                      </View>
                    </Button>
                  </>
                )}
              </View>
            ) : null}
          </View>
        )}

        {/* Deposit Payment Section */}
        {depositInfo?.hasDeposit && (
          <View className="px-4 py-4 border-b border-border">
            <View
              className={`rounded-lg p-4 border ${
                depositInfo.status === "paid"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : depositInfo.status === "refunded"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : depositInfo.status === "forfeited"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
              }`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <DollarSign
                    size={20}
                    color={
                      depositInfo.status === "paid"
                        ? "#16a34a"
                        : depositInfo.status === "refunded"
                          ? "#2563eb"
                          : depositInfo.status === "forfeited"
                            ? "#dc2626"
                            : "#d97706"
                    }
                  />
                  <Text
                    className={`text-sm font-semibold ${
                      depositInfo.status === "paid"
                        ? "text-green-800 dark:text-green-200"
                        : depositInfo.status === "refunded"
                          ? "text-blue-800 dark:text-blue-200"
                          : depositInfo.status === "forfeited"
                            ? "text-red-800 dark:text-red-200"
                            : "text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    {depositInfo.status === "paid"
                      ? "Deposit Paid"
                      : depositInfo.status === "refunded"
                        ? "Deposit Refunded"
                        : depositInfo.status === "forfeited"
                          ? "Deposit Forfeited"
                          : "Deposit Pending"}
                  </Text>
                </View>
                {/* Payment countdown timer for pending deposits */}
                {depositInfo.status === "pending" &&
                paymentTimeRemaining &&
                !isPaymentExpired ? (
                  <View className="flex-row items-center gap-1 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-full">
                    <Clock size={14} color="#d97706" />
                    <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {paymentTimeRemaining.minutes}:
                      {paymentTimeRemaining.seconds.toString().padStart(2, "0")}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Amount breakdown */}
              <View className="gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">
                    Deposit Amount
                  </Text>
                  <Text className="text-xs font-medium text-foreground">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: depositInfo.currency,
                    }).format(depositInfo.amount)}
                  </Text>
                </View>
                {depositInfo.serviceFee > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">
                      Service Fee
                    </Text>
                    <Text className="text-xs font-medium text-foreground">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: depositInfo.currency,
                      }).format(depositInfo.serviceFee)}
                    </Text>
                  </View>
                )}
                <View className="flex-row justify-between mt-1 pt-1 border-t border-border/50">
                  <Text className="text-sm font-semibold text-foreground">
                    Total Charged
                  </Text>
                  <Text className="text-sm font-bold text-foreground">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: depositInfo.currency,
                    }).format(depositInfo.totalAmount)}
                  </Text>
                </View>
              </View>

              {/* Refund policy info */}
              {depositInfo.status === "paid" &&
                depositInfo.refundPolicy !== "none" && (
                  <View className="mt-2 pt-2 border-t border-green-200/50 dark:border-green-800/50">
                    <Text className="text-xs text-green-700 dark:text-green-300">
                      {depositInfo.refundPolicy === "full"
                        ? `Full refund if cancelled ${depositInfo.refundWindowHours}h+ before booking`
                        : `${depositInfo.partialRefundPercentage}% refund if cancelled ${depositInfo.refundWindowHours}h+ before booking`}
                    </Text>
                  </View>
                )}

              {/* Payment method */}
              {depositInfo.paymentProvider && depositInfo.status === "paid" && (
                <Text className="text-xs text-muted-foreground mt-1">
                  Paid via{" "}
                  {depositInfo.paymentProvider === "montypay"
                    ? "Card"
                    : "Whish"}
                </Text>
              )}

              {/* Pay Deposit Button - Show when deposit is pending */}
              {depositInfo.status === "pending" && (
                <View className="mt-3">
                  <Text className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                    Your booking requires a deposit to be confirmed. Complete
                    your payment to secure your reservation.
                  </Text>
                  <Button
                    variant="default"
                    onPress={handlePayDeposit}
                    disabled={depositPaymentLoading}
                    className="w-full bg-amber-600 dark:bg-amber-700"
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <CreditCard size={18} color="white" />
                      <Text className="text-white font-semibold">
                        {depositPaymentLoading
                          ? "Processing..."
                          : "Pay Deposit Now"}
                      </Text>
                    </View>
                  </Button>
                </View>
              )}

              {/* Failed deposit message */}
              {depositInfo.status === "failed" && (
                <View className="mt-2 pt-2 border-t border-red-200/50 dark:border-red-800/50">
                  <Text className="text-xs text-red-700 dark:text-red-300">
                    Deposit payment failed. Please try booking again.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rewards Section - Only show for confirmed bookings with rewards */}
        {booking.status === "confirmed" && appliedOfferDetails ? (
          <View className="px-4 py-4 border-b border-border">
            <Text className="text-lg font-bold mb-4 text-foreground">
              Your Rewards
            </Text>
            {/* Applied Offer Card */}
            <AppliedOfferCard
              offerDetails={appliedOfferDetails}
              onCopyCode={copyOfferCode}
              onViewOffers={navigateToOffers}
              onShareOffer={shareAppliedOffer}
            />
          </View>
        ) : null}

        {/* Booking Information */}
        <View className="px-4 py-4">
          <Text className="text-lg font-bold mb-4 text-foreground">
            Booking Information
          </Text>

          {/* Main Booking Details Card */}
          <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            {/* Date and Time Row */}
            <View className="mb-4">
              <View className="flex-row items-start gap-3 mb-3">
                <View className="bg-primary/10 rounded-full p-2">
                  <Calendar size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    DATE & TIME
                  </Text>
                  <Text className="font-semibold text-base text-primary dark:text-white">
                    {isLebanonToday(bookingDate)
                      ? "Today"
                      : isLebanonTomorrow(bookingDate)
                        ? "Tomorrow"
                        : formatLebanonDateLong(bookingDate)}
                    {" at "}
                    {formatLebanonTime(bookingDate)}
                  </Text>
                </View>
              </View>

              {/* Party Size */}
              <View className="flex-row items-center gap-3 ">
                <View className="bg-primary/10 rounded-full p-2">
                  <Users size={18} color={themeColors.primary} />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground mb-1">
                    GUESTS
                  </Text>
                  <Text className="font-medium text-foreground">
                    {`${booking.party_size} ${booking.party_size === 1 ? "Guest" : "Guests"}`}
                  </Text>
                </View>
              </View>

            </View>

            {/* Table Preferences */}
            {booking.table_preferences &&
            booking.table_preferences.length > 0 ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <TableIcon size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    TABLE PREFERENCE
                  </Text>
                  <Text className="font-medium text-foreground">
                    {booking.table_preferences
                      .map(formatTablePreference)
                      .join(", ")}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Preferred Section */}
            {booking.preferred_section ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <MapPin size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    PREFERRED SECTION
                  </Text>
                  <Text className="font-medium text-foreground capitalize">
                    {getSectionName(booking.preferred_section)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Special Offer */}
            {appliedOfferDetails ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <Gift size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    SPECIAL OFFER
                  </Text>
                  <Text className="font-medium text-foreground">
                    {appliedOfferDetails.special_offer_title}
                  </Text>
                  {appliedOfferDetails.discount_percentage ? (
                    <Text className="text-xs text-primary dark:text-white mt-0.5">
                      {`${appliedOfferDetails.discount_percentage}% discount applied`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Applied Promo Code */}
            {appliedPromoDetails ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-violet-500/10 rounded-full p-2 mt-0.5">
                  <Tag size={18} color="#8b5cf6" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    PROMO CODE
                  </Text>
                  <Text className="font-medium text-foreground font-mono">
                    {appliedPromoDetails.code}
                  </Text>
                  <Text className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                    {appliedPromoDetails.discount_type === "percentage"
                      ? `${appliedPromoDetails.discount_value}% discount${appliedPromoDetails.max_discount_amount ? ` (max $${appliedPromoDetails.max_discount_amount})` : ""}`
                      : `$${appliedPromoDetails.discount_value} discount`}
                  </Text>
                  {appliedPromoDetails.description ? (
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      {appliedPromoDetails.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Guest Information Section */}
            {booking.guest_name ||
            booking.guest_email ||
            booking.guest_phone ? (
              <View className="mt-4">
                <Text className="text-xs text-muted-foreground mb-1">
                  GUEST INFORMATION
                </Text>
                {booking.guest_name ? (
                  <Text className="text-sm font-medium text-foreground mb-1">
                    {`Name: ${booking.guest_name}`}
                  </Text>
                ) : null}
                {booking.guest_email ? (
                  <Text className="text-sm font-medium text-foreground mb-1">
                    {`Email: ${booking.guest_email}`}
                  </Text>
                ) : null}
                {booking.guest_phone ? (
                  <Text className="text-sm font-medium text-foreground">
                    {`Phone: ${booking.guest_phone}`}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {shouldShowAdditionalInfo ? (
              <View className="pt-4 border-t border-border/60">
                <EditableBookingFields
                  bookingId={booking.id}
                  currentValues={bookingFields}
                  onUpdate={handleBookingFieldsUpdate}
                  canEdit={canEditAdditionalInfo}
                />
              </View>
            ) : null}

            {/* Confirmation Code & Summary Section */}
            <View className="mt-4 pt-4 border-t border-border/60">
              {booking.confirmation_code ? (
                <>
                  <Text className="font-semibold mb-3 text-foreground">
                    {isPending ? "Reference Code" : "Confirmation Code"}
                  </Text>
                  <Pressable
                    onPress={copyConfirmationCode}
                    className="flex-row items-center justify-between bg-background rounded-lg p-3 border border-border"
                  >
                    <Text className="font-mono font-bold text-xl tracking-wider text-foreground">
                      {booking.confirmation_code}
                    </Text>
                    <Copy size={20} color={themeColors.mutedForeground} />
                  </Pressable>
                  <Text className="text-xs text-muted-foreground mt-2">
                    {`Tap to copy • ${isPending ? "Use this code to reference your request" : "Show this code at the restaurant"}`}
                  </Text>
                </>
              ) : null}

              <Button
                variant="outline"
                size="lg"
                onPress={copyReservationSummary}
                className={`w-full rounded-xl ${booking.confirmation_code ? "mt-4" : ""}`}
              >
                <View className="flex-row items-center justify-center gap-2">
                  <Copy size={16} color={themeColors.primary} />
                  <Text className="font-medium text-foreground text-base">
                    Copy Full Summary
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        </View>

        {/* Booking Invitations Section - USING FIXED COMPONENT */}
        <BookingInvitationsSection
          bookingId={booking.id}
          bookingUserId={booking.user_id}
        />

        {/* Table Assignment - Only show for confirmed bookings and non-basic tier restaurants */}
        {booking.status === "confirmed" && !isBasicRestaurant ? (
          <BookingTableInfo
            tables={assignedTables}
            partySize={booking.party_size}
            loading={loading}
          />
        ) : null}

        {/* Contact Section */}
        {booking.restaurant ? (
          <BookingContactSection
            restaurant={{
              name: booking.restaurant.name,
              phone_number: booking.restaurant.phone_number,
              whatsapp_number: booking.restaurant.whatsapp_number,
            }}
            appliedOfferDetails={appliedOfferDetails}
          />
        ) : null}

        {/* Bottom padding */}
        <View className="h-48" />
      </ScrollView>

      {/* Actions Bar - USING FIXED COMPONENT */}
      {booking.restaurant ? (
        <View className="absolute bottom-0 left-0 right-0">
          <BookingActionsBar
            booking={{
              id: booking.id,
              status: booking.status,
              confirmation_code: booking.confirmation_code || "",
              booking_time: booking.booking_time,
              party_size: booking.party_size,
              restaurant: {
                id: booking.restaurant.id,
                name: booking.restaurant.name,
                phone_number: booking.restaurant.phone_number,
                whatsapp_number: booking.restaurant.whatsapp_number,
                location: booking.restaurant.location,
                staticCoordinates: booking.restaurant.staticCoordinates,
                coordinates: booking.restaurant.coordinates,
              },
            }}
            appliedOfferDetails={appliedOfferDetails}
            hasReview={hasReview}
            isUpcoming={isUpcoming}
            processing={processing}
            isWithinCancellationWindow={isWithinCancellationWindow}
            cancellationWindowHours={
              (booking.restaurant as any).cancellation_window_hours || 0
            }
            guaranteeInfo={guaranteeInfo}
            isPendingPayment={isPendingPayment && isEventBooking}
            isPaymentExpired={isPaymentExpired}
            paymentLoading={paymentLoading}
            onCompletePayment={handleCompletePayment}
            isDepositPending={
              depositInfo?.status === "pending" ||
              (pendingDepositInfo?.required ?? false)
            }
            depositPaymentLoading={depositPaymentLoading}
            onPayDeposit={handlePayDeposit}
            onCancel={cancelBooking}
            onReview={navigateToReview}
            onBookAgain={bookAgain}
            onNavigateToOffers={navigateToOffers}
            onEdit={navigateToEdit}
          />
        </View>
      ) : null}

      {/* Deposit Payment Sheet for completing pending deposits */}
      {depositCheckResult && booking && (
        <DepositPaymentSheet
          visible={showDepositSheet}
          onClose={() => {
            setShowDepositSheet(false);
            setDepositCheckResult(null);
          }}
          onConfirm={handleDepositConfirm}
          depositInfo={depositCheckResult}
          restaurantName={booking.restaurant?.name || "Restaurant"}
          partySize={depositInfo?.partySize || booking.party_size}
          bookingDate={formatLebanonDateLong(
            parseFromLebanonTZ(booking.booking_time),
          )}
          bookingTime={formatLebanonTime(
            parseFromLebanonTZ(booking.booking_time),
          )}
          loading={depositPaymentLoading}
          isNewBooking={false}
        />
      )}
    </SafeAreaView>
  );
}

export default function BookingDetailsScreenWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <BookingDetailsScreen />
    </ErrorBoundary>
  );
}
