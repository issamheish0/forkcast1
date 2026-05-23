// app/(protected)/booking/success.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, ScrollView, Share, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle,
  Clock,
  Home,
  MapPin,
  Share2,
  Users,
  Gift,
  TableIcon,
  Info,
  AlertTriangle,
  Copy,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Confetti from "react-native-confetti";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { formatLebanonDateLong, formatLebanonTime, parseFromLebanonTZ } from "@/utils/lebanonTime";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";

const formatDietaryRestriction = (r: string) =>
  r.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const formatTablePreference = (p: string) =>
  p.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

interface BookingSuccessParams {
  bookingId: string;
  restaurantName: string;
  restaurantId?: string;
  confirmationCode: string;
  earnedPoints?: string;
  appliedOffer?: string;
  invitedFriends?: string;
  isGroupBooking?: string;
  userTier?: string;
  offerTitle?: string;
  offerDiscount?: string;
  tableInfo?: string; // "single" or "combined"
  bookingDate?: string;
  bookingTime?: string;
}

export default function BookingSuccessScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useLocalSearchParams<any>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const confettiRef = React.useRef<any>(null);

  // State
  const [offerDetails, setOfferDetails] = useState<{
    estimatedSavings: number;
    title: string;
  } | null>(null);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [bookingDetails, setBookingDetails] = useState<{
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
    table_preferences?: string[] | null;
    party_size?: number;
    booking_time?: string;
    confirmation_code?: string;
  } | null>(null);

  // Parse params once
  const parsedParams = useMemo(
    () => ({
      hasOffer: params.appliedOffer === "true",
      invitedFriendsCount: params.invitedFriends
        ? parseInt(params.invitedFriends)
        : 0,
      isGroupBooking: params.isGroupBooking === "true",
      offerDiscount: params.offerDiscount ? parseInt(params.offerDiscount) : 0,
      tableInfo: params.tableInfo || "single",
    }),
    [params],
  );

  // Fetch full booking details (restaurant + detail fields)
  useEffect(() => {
    if (!params.bookingId) return;

    const fetchBookingDetails = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select(`
            party_size,
            booking_time,
            confirmation_code,
            occasion,
            special_requests,
            dietary_notes,
            table_preferences,
            restaurant_id(
              id, name, address, location, staticCoordinates, coordinates
            )
          `)
          .eq("id", params.bookingId)
          .single();

        if (!error && data) {
          setRestaurantData((data as any).restaurant_id);
          setBookingDetails({
            occasion: data.occasion,
            special_requests: data.special_requests,
            dietary_notes: data.dietary_notes,
            table_preferences: data.table_preferences,
            party_size: data.party_size,
            booking_time: data.booking_time,
            confirmation_code: data.confirmation_code,
          });
        }
      } catch (err) {
        console.error("Error fetching booking details:", err);
      }
    };

    fetchBookingDetails();
  }, [params.bookingId]);

  // Calculate offer details for value summary
  useEffect(() => {
    if (parsedParams.hasOffer && params.offerTitle) {
      // Estimate savings based on party size and discount
      const partySize = parsedParams.invitedFriendsCount + 1;
      const estimatedMealCost = partySize * 30; // Rough estimate $30 per person
      const estimatedSavings =
        (estimatedMealCost * parsedParams.offerDiscount) / 100;

      setOfferDetails({
        estimatedSavings,
        title: params.offerTitle,
      });
    }
  }, [
    parsedParams.hasOffer,
    params.offerTitle,
    parsedParams.offerDiscount,
    parsedParams.invitedFriendsCount,
  ]);

  // Confetti and haptic effects
  useEffect(() => {
    // Trigger confetti animation
    if (confettiRef.current) {
      confettiRef.current.startConfetti();
    }

    // Success haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Stop confetti after 3 seconds
    const timeout = setTimeout(() => {
      if (confettiRef.current) {
        confettiRef.current.stopConfetti();
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  // Enhanced share message
  const shareMessage = useMemo(() => {
    let message = `I just booked a table at ${params.restaurantName}! 🎉\nConfirmation: ${params.confirmationCode}`;

    if (parsedParams.hasOffer) {
      message += `\nSaved ${parsedParams.offerDiscount}% with a special offer!`;
    }

    if (parsedParams.isGroupBooking) {
      message += `\nDining with ${parsedParams.invitedFriendsCount} friend${parsedParams.invitedFriendsCount > 1 ? "s" : ""}`;
    }

    return message;
  }, [
    params.restaurantName,
    params.confirmationCode,
    parsedParams.hasOffer,
    parsedParams.offerDiscount,
    parsedParams.isGroupBooking,
    parsedParams.invitedFriendsCount,
  ]);

  // Navigation handlers
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${params.restaurantName}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [shareMessage, params.restaurantName]);

  const navigateToBookingDetails = useCallback(() => {
    router.replace({
      pathname: "/booking/[id]",
      params: { id: params.bookingId },
    });
  }, [router, params.bookingId]);

  const navigateToHome = useCallback(() => {
    router.replace("/(protected)/(tabs)");
  }, [router]);

  if (!isMounted) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Confetti ref={confettiRef} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-8">
          {/* Success Animation Area */}
          <View className="items-center mb-8">
            <View className="bg-green-100 dark:bg-green-900/30 rounded-full p-6 mb-6">
              <CheckCircle size={80} color="#10b981" strokeWidth={2} />
            </View>

            <H1 className="text-3xl font-bold text-center mb-2">
              Booking Confirmed!
            </H1>
            <P className="text-center text-muted-foreground text-lg">
              Your table at{" "}
              <Text className="font-semibold text-primary">
                {(restaurantData as any)?.name || params.restaurantName}
              </Text>{" "}
              is confirmed
            </P>
          </View>

          {/* Confirmation Code Card */}
          <View className="bg-card border-2 border-green-500 rounded-2xl p-6 mb-6">
            <View className="items-center">
              <Muted className="text-sm mb-2">Confirmation Code</Muted>
              <Text className="text-3xl font-bold tracking-wider text-primary">
                {bookingDetails?.confirmation_code || params.confirmationCode || "Loading..."}
              </Text>
              <Pressable
                onPress={async () => {
                  const code = bookingDetails?.confirmation_code || params.confirmationCode;
                  if (!code) return;
                  await Clipboard.setStringAsync(code);
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert("Copied!", `Code ${code} copied to clipboard`);
                }}
                className="flex-row items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg"
              >
                <Copy size={16} color="#666" />
                <Text className="text-sm text-muted-foreground">Tap to copy · Show at restaurant</Text>
              </Pressable>
            </View>
          </View>

          {/* Details section — same layout as Request Sent */}
          <View className="bg-muted/30 rounded-xl p-4 mb-6">
            <H3 className="mb-4">Details</H3>

            {/* Date & Time */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-4 border border-border">
              <Text className="text-center text-sm text-muted-foreground mb-1">DATE & TIME</Text>
              <Text className="text-center text-xl font-bold mb-1">
                {bookingDetails?.booking_time
                  ? formatLebanonDateLong(parseFromLebanonTZ(bookingDetails.booking_time))
                  : params.bookingDate
                    ? formatLebanonDateLong(parseFromLebanonTZ(params.bookingDate))
                    : ""}
              </Text>
              <Text className="text-center text-lg font-semibold text-primary">
                {bookingDetails?.booking_time
                  ? formatLebanonTime(parseFromLebanonTZ(bookingDetails.booking_time))
                  : params.bookingTime || ""}
              </Text>
            </View>

            {/* Guest Information */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <Users size={18} color="#666" />
                <Text className="font-semibold text-base">Guest Information</Text>
              </View>
              <Text className="text-lg font-medium text-primary mb-2">
                {bookingDetails?.party_size ?? parsedParams.invitedFriendsCount + 1}{" "}
                {(bookingDetails?.party_size ?? parsedParams.invitedFriendsCount + 1) === 1 ? "Guest" : "Guests"}
              </Text>
              {bookingDetails?.occasion && bookingDetails.occasion !== "none" && (
                <View className="mt-2">
                  <Text className="text-sm text-muted-foreground mb-1">Occasion</Text>
                  <Text className="text-sm font-medium capitalize text-primary">
                    {bookingDetails.occasion}
                  </Text>
                </View>
              )}
            </View>

            {/* Table Preferences */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <TableIcon size={18} color="#666" />
                <Text className="font-semibold text-base">Table Preferences</Text>
              </View>
              {bookingDetails?.table_preferences && bookingDetails.table_preferences.length > 0 ? (
                <Text className="text-sm text-muted-foreground">
                  {bookingDetails.table_preferences.map(formatTablePreference).join(", ")}
                </Text>
              ) : (
                <Text className="text-sm text-muted-foreground italic">No specific preferences</Text>
              )}
            </View>

            {/* Special Requests */}
            {bookingDetails?.special_requests && (
              <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Info size={18} color="#666" />
                  <Text className="font-semibold text-base">Special Requests</Text>
                </View>
                <Text className="text-sm text-muted-foreground">{bookingDetails.special_requests}</Text>
              </View>
            )}

            {/* Dietary Notes */}
            {bookingDetails?.dietary_notes && bookingDetails.dietary_notes.length > 0 && (
              <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-border mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <AlertTriangle size={18} color="#f59e0b" />
                  <Text className="font-semibold text-base">Dietary Notes</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {bookingDetails.dietary_notes.map(formatDietaryRestriction).join(", ")}
                </Text>
              </View>
            )}
          </View>

          {/* Special Offer Applied Card */}
          {parsedParams.hasOffer && params.offerTitle && (
            <View className="border border-green-300 dark:border-green-700/50 rounded-xl p-4 mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Gift size={20} color="#10b981" />
                  <Text className="font-semibold text-green-800 dark:text-green-200">Special Offer Applied!</Text>
                </View>
                <View className="bg-green-600 rounded-full px-3 py-1">
                  <Text className="text-white font-bold text-sm">{parsedParams.offerDiscount}% OFF</Text>
                </View>
              </View>
              <Text className="text-green-700 dark:text-green-300 text-sm">{params.offerTitle}</Text>
            </View>
          )}

          {/* Group Booking Info */}
          {parsedParams.isGroupBooking && (
            <View className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-3">
                <Users size={24} color="#8b5cf6" />
                <View className="flex-1">
                  <Text className="font-semibold text-purple-800 dark:text-purple-200">Group Booking Created</Text>
                  <Text className="text-sm text-purple-700 dark:text-purple-300">
                    {parsedParams.invitedFriendsCount} friend{parsedParams.invitedFriendsCount > 1 ? "s have" : " has"} been invited to join you
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* What's Next */}
          <View className="mt-2 mb-6">
            <H3 className="mb-4">What's Next?</H3>
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <Calendar size={20} color="#6b7280" className="mt-1" />
                <View className="flex-1">
                  <Text className="font-medium">We'll send you a reminder</Text>
                  <Muted className="text-sm">You'll receive a notification 2 hours before your reservation</Muted>
                </View>
              </View>
              <View className="flex-row items-start gap-3">
                <MapPin size={20} color="#6b7280" className="mt-1" />
                <View className="flex-1">
                  <Text className="font-medium">Get directions</Text>
                  <Muted className="text-sm">Check the booking details for maps and contact info</Muted>
                  {restaurantData && (
                    <View className="mt-2">
                      <DirectionsButton
                        restaurant={restaurantData}
                        variant="button"
                        size="sm"
                        backgroundColor="bg-primary/10"
                        borderColor="border-primary/20"
                        iconColor="#3b82f6"
                        textColor="text-primary"
                        className="w-fit"
                      />
                    </View>
                  )}
                </View>
              </View>
              {parsedParams.isGroupBooking && (
                <View className="flex-row items-start gap-3">
                  <Users size={20} color="#6b7280" className="mt-1" />
                  <View className="flex-1">
                    <Text className="font-medium">Manage your group booking</Text>
                    <Muted className="text-sm">Track who's coming in the booking details</Muted>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View className="p-6 border-t border-border">
        <Button
          onPress={navigateToBookingDetails}
          size="lg"
          className="w-full mb-3"
        >
          <Text className="text-white font-bold">View Booking Details</Text>
        </Button>

        <View className="flex-row gap-3">
          <Button variant="outline" onPress={navigateToHome} className="flex-1">
            <Home size={20} color="#800020" />
            <Text className="ml-2">Home</Text>
          </Button>

          <Button variant="outline" onPress={handleShare} className="flex-1">
            <Share2 size={20} color="#800020" />
            <Text className="ml-2">Share</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
