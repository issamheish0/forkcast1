import {
  View,
  ScrollView,
  Share,
  Alert,
  Pressable,
} from "react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clock,
  CheckCircle,
  Home,
  Share2,
  Bell,
  Calendar,
  Users,
  Timer,
  Info,
  Copy,
  AlertTriangle,
  TableIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import {
  formatLebanonDateLong,
  formatLebanonTime,
  createLebanonDateTime,
  parseFromLebanonTZ,
  getCurrentLebanonTime,
  formatLebanonDate,
} from "@/utils/lebanonTime";

interface RequestSentParams {
  bookingId: string;
  restaurantName: string;
  bookingTime: string;
  bookingDate: string;
  partySize: string;
  confirmationCode: string;
  depositRequired?: string;
  depositAmount?: string;
  depositCurrency?: string;
}

/**
 * Formats dietary restriction text for display
 * Converts snake_case to Title Case (e.g., "lactose_free" -> "Lactose Free")
 */
const formatDietaryRestriction = (restriction: string): string => {
  return restriction
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Formats table preference text for display
 * Converts snake_case to Title Case (e.g., "window_seat" -> "Window Seat")
 */
const formatTablePreference = (preference: string): string => {
  return preference
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

type Booking = {
  id: string;
  booking_time: string;
  confirmation_code?: string;
  occasion?: string | null;
  special_requests?: string | null;
  dietary_notes?: string[] | null;
  table_preferences?: string[] | null;
  restaurant: {
    id: string;
    name: string;
  };
};


export default function RequestSentScreen() {
  const params = useLocalSearchParams() as unknown as RequestSentParams;
  const router = useRouter();

  // State for booking data
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse and format date with proper validation
  // Parse and format date with proper validation using Lebanon Time
  const parseBookingDate = (dateString: string): Date => {
    if (!dateString) return getCurrentLebanonTime();

    try {
      // Try parsing as ISO string first using Lebanon TZ parser
      // If it's a full ISO string, parseFromLebanonTZ handles it
      if (dateString.includes("T")) {
        return parseFromLebanonTZ(dateString);
      }

      // If it's just a date string (YYYY-MM-DD), create a Lebanon date at default time
      // We'll assume 19:00 if no time is provided, just for the date object
      const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoMatch) {
        // createLebanonDateTime expects YYYY-MM-DD and HH:mm
        return createLebanonDateTime(dateString, "19:00");
      }

      // Fallback to standard parsing if format is unexpected, but treat as Lebanon time
      return parseFromLebanonTZ(dateString);
    } catch (error) {
      console.warn("Invalid booking date provided:", dateString);
      return getCurrentLebanonTime();
    }
  };

  // Get booking date and time from booking data or params - memoized to prevent unnecessary re-renders
  const getBookingDateTime = useCallback((): Date => {
    // Use booking_time from fetched data if available
    if (booking?.booking_time) {
      try {
        return parseFromLebanonTZ(booking.booking_time);
      } catch (e) {
        console.error("Error parsing booking time:", e);
      }
    }

    // Fallback to params if available
    if (params.bookingDate && params.bookingTime) {
      // If we have both date (ISO) and time (HH:mm), combine them
      try {
        // params.bookingDate is an ISO string. We need to extract the YYYY-MM-DD part in Lebanon time.
        // However, since it was generated via toISOString(), it's a UTC string.
        // Ideally, we should use the raw date string if available, but we only have the ISO string here.
        // Let's convert the ISO string to a Date, format it to YYYY-MM-DD (Lebanon), and then combine with time.
        const dateObj = parseFromLebanonTZ(params.bookingDate as string);
        const dateStr = formatLebanonDate(dateObj); // YYYY-MM-DD in Lebanon
        return createLebanonDateTime(dateStr, params.bookingTime as string);
      } catch (e) {
        console.error("Error combining params date/time:", e);
      }
    }

    // Fallback to just date if time is missing (shouldn't happen with new logic)
    return parseBookingDate(params.bookingDate);
  }, [booking?.booking_time, params.bookingTime, params.bookingDate]);

  // Memoize booking date/time calculations to prevent unnecessary re-renders
  const { bookingDateTime, formattedDate, formattedTime } = useMemo(() => {
    const dateTime = getBookingDateTime();
    return {
      bookingDateTime: dateTime,
      formattedDate: formatLebanonDateLong(dateTime),
      formattedTime: formatLebanonTime(dateTime),
    };
  }, [getBookingDateTime]);

  // Fetch booking data - memoized to prevent unnecessary re-fetches
  const fetchBookingData = useCallback(async () => {
    if (!params.bookingId) return;

    try {
      setLoading(true);

      // Fetch booking with restaurant data
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
            *,
            restaurant:restaurants (*)
          `,
        )
        .eq("id", params.bookingId)
        .single();

      if (bookingError) {
        console.error("Error fetching booking data:", bookingError);
        // Don't throw error, just continue with params data
        return;
      }

      setBooking(bookingData);

    } catch (error) {
      console.error("Error fetching booking data:", error);
      // Don't let async errors crash the page - continue with params data
    } finally {
      setLoading(false);
    }
  }, [params.bookingId]);

  // Fetch booking data
  useEffect(() => {
    fetchBookingData();
  }, [fetchBookingData]);

  useEffect(() => {
    // Success haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleShare = useCallback(async () => {
    try {
      const code = booking?.confirmation_code || params.confirmationCode;
      let message = `I've requested a table at ${params.restaurantName} for ${
        params.partySize
      } ${parseInt(params.partySize) === 1 ? "person" : "people"} on ${formattedDate} at ${
        formattedTime
      }. Awaiting confirmation! 🤞`;

      // Add reference code if available
      if (code) {
        message += ` Reference code: ${code}`;
      }

      await Share.share({
        message,
        title: `Booking Request at ${params.restaurantName}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [
    booking?.confirmation_code,
    params.confirmationCode,
    params.restaurantName,
    params.partySize,
    formattedDate,
    formattedTime,
  ]);

  const copyConfirmationCode = useCallback(async () => {
    const code = booking?.confirmation_code || params.confirmationCode;
    if (!code) return;

    await Clipboard.setStringAsync(code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", `Reference code ${code} copied to clipboard`);
  }, [booking?.confirmation_code, params.confirmationCode]);

  const navigateToBookingDetails = useCallback(() => {
    router.replace({
      pathname: "/booking/[id]",
      params: { id: params.bookingId },
    });
  }, [router, params.bookingId]);

  const navigateToHome = useCallback(() => {
    router.replace("/(protected)/(tabs)");
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-8">
          <View className="items-center mb-8">
            <View className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-6 mb-6">
              <Clock size={80} color="#f97316" strokeWidth={2} />
            </View>

            <H1 className="text-3xl font-bold text-center mb-2">
              Booking Sent!
            </H1>
            <P className="text-center text-muted-foreground text-lg">
              Your booking has been sent to{" "}
              <Text className="font-semibold text-primary">
                {booking?.restaurant?.name || params.restaurantName}
              </Text>
            </P>
          </View>

          <View className="bg-card border-2 border-orange-500 rounded-2xl p-6 mb-6">
            <View className="items-center">
              <Text className="text-sm mb-2 text-yellow-300">
                Reference Code
              </Text>
              <Text className="text-3xl font-bold tracking-wider text-orange-600 dark:text-orange-400">
                {booking?.confirmation_code ||
                  params.confirmationCode ||
                  "Loading..."}
              </Text>
              <Pressable
                onPress={copyConfirmationCode}
                className="flex-row items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg"
              >
                <Copy size={16} color="#666" />
                <Text className="text-sm text-muted-foreground">
                  Tap to copy
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="bg-muted/30 rounded-xl p-4 mb-6">
            <H3 className="mb-4">Details</H3>

            {/* Clean Date and Time Display */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-6 border border-border">
              <Text className="text-center text-sm text-muted-foreground mb-1">
                DATE & TIME
              </Text>
              <Text className="text-center text-xl font-bold mb-1">
                {formattedDate}
              </Text>
              <Text className="text-center text-lg font-semibold text-primary">
                {formattedTime}
              </Text>
            </View>

            {/* Guest Information */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <Users size={18} color="#666" />
                <Text className="font-semibold text-base">
                  Guest Information
                </Text>
              </View>
              <Text className="text-lg font-medium text-primary mb-2">
                {params.partySize}{" "}
                {parseInt(params.partySize) === 1 ? "Guest" : "Guests"}
              </Text>
              {booking && booking.occasion && booking.occasion !== "none" && (
                <View className="mt-2">
                  <Text className="text-sm text-muted-foreground mb-1">
                    Occasion
                  </Text>
                  <Text className="text-sm font-medium capitalize text-primary">
                    {booking.occasion}
                  </Text>
                </View>
              )}
            </View>

            {/* Table Preferences */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <TableIcon size={18} color="#666" />
                <Text className="font-semibold text-base">
                  Table Preferences
                </Text>
              </View>
              {booking &&
              booking.table_preferences &&
              booking.table_preferences.length > 0 ? (
                <Text className="text-sm text-muted-foreground">
                  {booking.table_preferences
                    .map(formatTablePreference)
                    .join(", ")}
                </Text>
              ) : (
                <Text className="text-sm text-muted-foreground italic">
                  No specific preferences
                </Text>
              )}
            </View>

            {/* Special Requests */}
            {booking && booking.special_requests && (
              <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Info size={18} color="#666" />
                  <Text className="font-semibold text-base">
                    Special Requests
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {booking.special_requests}
                </Text>
              </View>
            )}

            {/* Dietary Notes */}
            {booking &&
              booking.dietary_notes &&
              booking.dietary_notes.length > 0 && (
                <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
                  <View className="flex-row items-center gap-2 mb-3">
                    <AlertTriangle size={18} color="#f59e0b" />
                    <Text className="font-semibold text-base">
                      Dietary Notes
                    </Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {booking.dietary_notes
                      .map(formatDietaryRestriction)
                      .join(", ")}
                  </Text>
                </View>
              )}
          </View>

          {/* Deposit Required Notice */}
          {params.depositRequired === "true" && (
            <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-2 mb-2">
                <Info size={20} color="#d97706" />
                <Text className="font-semibold text-amber-800 dark:text-amber-200">
                  Deposit Required
                </Text>
              </View>
              <Text className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                This booking requires a deposit of{" "}
                <Text className="font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: params.depositCurrency || "USD",
                  }).format(parseFloat(params.depositAmount || "0"))}
                </Text>
                .
              </Text>
              <Text className="text-xs text-amber-600 dark:text-amber-400">
                Once the restaurant accepts your booking, they will send you a
                payment link to complete the deposit.
              </Text>
            </View>
          )}

          <View className="mb-6">
            <H3 className="mb-4">What Happens Next?</H3>
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">Restaurant Reviews</Text>
                  <Text className="text-sm text-muted-foreground">
                    The restaurant will check availability and review your
                    request
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">You&apos;ll Be Notified</Text>
                  <Text className="text-sm text-muted-foreground">
                    {params.depositRequired === "true"
                      ? "We'll notify you and send a payment link for the deposit"
                      : "We'll send you a push notification and update your bookings"}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">
                    {params.depositRequired === "true"
                      ? "Complete Payment"
                      : "Confirmation or Alternative"}
                  </Text>
                  <Text className="text-sm">
                    {params.depositRequired === "true"
                      ? "Pay the deposit to confirm your booking. If declined, no payment needed."
                      : "If confirmed, you're all set! If not, try booking another time"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6">
            <View className="flex-row items-start gap-2">
              <Info size={20} color="#f59e0b" className="mt-0.5" />
              <View className="flex-1">
                <Text className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Pro Tip
                </Text>
                <Text className="text-sm text-amber-700 dark:text-amber-300">
                  {(() => {
                    let text =
                      "Enable push notifications to get instant updates about your booking request";
                    return text;
                  })()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="p-6 border-t border-border">
        <Button
          onPress={navigateToBookingDetails}
          size="lg"
          className="w-full mb-3"
        >
          <Text>View Request Details</Text>
        </Button>

        <View className="flex-row gap-3">
          <Button variant="outline" onPress={navigateToHome} className="flex-1">
            <View className="flex-row items-center">
              <Home size={20} color="#800020" />
              <Text className="ml-2">Home</Text>
            </View>
          </Button>

          <Button variant="outline" onPress={handleShare} className="flex-1">
            <View className="flex-row items-center">
              <Share2 size={20} color="#800020" />
              <Text className="ml-2">Share</Text>
            </View>
          </Button>
        </View>

        <View className="flex-row items-center justify-center gap-2 mt-4">
          <Bell size={16} color="#666" />
          <Text className="text-sm text-muted-foreground text-center">
            We'll notify you as soon as the restaurant responds
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
