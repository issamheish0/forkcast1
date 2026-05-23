// app/(protected)/waitlist/[id].tsx - Waitlist Entry Details Page
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Alert,
  ActivityIndicator,
  Pressable,
  Share,
} from "react-native";
import WaitlistDetailsSkeleton from "@/components/skeletons/WaitlistDetailsSkeleton";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Users,
  Trash2,
  AlertCircle,
  CheckCircle,
  MapPin,
  TableIcon,
  Bell,
  Info,
  ChevronRight,
  Copy,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import {
  formatDateToDDMMYYYY,
  formatDateLong,
  formatDateShort,
} from "@/utils/birthday";
import { getDisplayCuisine } from "@/lib/cuisineUtils";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { NavigationHeader } from "@/components/ui/navigation-header";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { useWaitlist } from "@/hooks/useWaitlist";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { TABLE_TYPE_INFO } from "@/types/waitlist";

interface WaitlistEntry {
  id: string;
  user_id: string;
  restaurant_id: string;
  desired_date: string;
  desired_time_range: string;
  party_size: number;
  table_type: string;
  status: "active" | "notified" | "booked" | "expired" | "cancelled";
  special_requests?: string;
  notified_at?: string;
  notification_expires_at?: string;
  expires_at?: string;
  converted_booking_id?: string;
  created_at?: string;
  updated_at?: string;
  is_scheduled_entry?: boolean;
  restaurant?: {
    id: string;
    name: string;
    address: string;
    main_image_url?: string;
    phone_number?: string;
    cuisine_type?: string;
    tier?: "basic" | "pro";
  };
}

// Component to display the restaurant header
const WaitlistDetailsHeader: React.FC<{
  restaurant: any;
  onPress?: () => void;
}> = ({ restaurant, onPress }) => {
  return (
    <Pressable onPress={onPress} className="bg-card border-b border-border">
      <View className="flex-row p-4">
        <Image
          source={{
            uri:
              restaurant?.main_image_url ||
              "https://via.placeholder.com/80x80?text=No+Image",
          }}
          optimizationPreset="medium"
          className="w-24 h-24 rounded-lg"
          contentFit="cover"
          onError={() => {}}
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <H3 className="mb-1">{restaurant?.name || "Restaurant"}</H3>
              <P className="text-muted-foreground text-sm mb-2">
                {getDisplayCuisine(
                  restaurant?.cuisine_type,
                  (restaurant as any)?.secondary_cuisines,
                  "Various Cuisine",
                )}
              </P>
              <View className="flex-row items-center gap-1 mb-2">
                <MapPin size={14} color={colors.light.primary} />
                <Text
                  className="text-sm text-muted-foreground"
                  numberOfLines={2}
                >
                  {restaurant?.address || "Address not available"}
                </Text>
              </View>
            </View>
            <View className="ml-2">
              <ChevronRight size={20} color="#666" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function WaitlistDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { cancelWaitlist, convertWaitlistToBooking } = useWaitlist();

  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [converting, setConverting] = useState(false);

  // Share waitlist entry
  const shareWaitlistEntry = async () => {
    if (!waitlistEntry) return;

    try {
      const statusText = (() => {
        switch (waitlistEntry.status) {
          case "active":
            return "I'm on the waitlist";
          case "notified":
            return "I've been notified about a table";
          case "booked":
            return "I've secured a table from the waitlist";
          case "cancelled":
            return "My waitlist entry was cancelled";
          case "expired":
            return "My waitlist entry expired";
          default:
            return "I'm on the waitlist";
        }
      })();

      const formattedDate = format(
        parseISO(waitlistEntry.desired_date),
        "EEEE, MMM d, yyyy",
      );

      const shareMessage = `${statusText} at ${waitlistEntry.restaurant?.name} for ${formattedDate} around ${waitlistEntry.desired_time_range} for ${waitlistEntry.party_size} ${waitlistEntry.party_size === 1 ? "person" : "people"}.`;

      await Share.share({
        message: shareMessage,
        title: `Waitlist for ${waitlistEntry.restaurant?.name}`,
      });
    } catch {
      // Ignore share errors
    }
  };

  // Fetch waitlist entry details
  useEffect(() => {
    if (id) {
      fetchWaitlistEntry();
    }
  }, [id]);

  const fetchWaitlistEntry = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("waitlist")
        .select(
          `
          *,
          restaurant:restaurants!waitlist_restaurant_id_fkey (
            id,
            name,
            address,
            main_image_url,
            phone_number,
            cuisine_type,
            tier
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        Alert.alert("Error", "Could not load waitlist details");
        router.back();
        return;
      }

      setWaitlistEntry(data);
    } catch {
      Alert.alert("Error", "Something went wrong");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEEE, MMM d, yyyy");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#f59e0b"; // amber/warning color
      case "notified":
        return "#10b981"; // green/success color
      case "booked":
        return "#10b981"; // green/success color
      case "expired":
        return colors[colorScheme].muted;
      case "cancelled":
        return colors[colorScheme].destructive;
      default:
        return colors[colorScheme].muted;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return {
          label: "Waiting",
          icon: Clock,
          color: "#f59e0b",
          bgColor: "#fff7ed",
          description:
            "Your waitlist entry is active. We'll notify you when a table becomes available.",
        };
      case "notified":
        return {
          label: "Table Available",
          icon: Bell,
          color: "#10b981",
          bgColor: "#ecfdf5",
          description:
            "A table has become available! Book now before this opportunity expires.",
        };
      case "booked":
        return {
          label: "Booked",
          icon: CheckCircle,
          color: "#10b981",
          bgColor: "#ecfdf5",
          description:
            "Congratulations! You've successfully converted this waitlist entry to a booking.",
        };
      case "expired":
        return {
          label: "Expired",
          icon: AlertCircle,
          color: "#6b7280",
          bgColor: "#f3f4f6",
          description: "This waitlist entry has expired.",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          icon: Trash2,
          color: "#dc2626",
          bgColor: "#fef2f2",
          description: "This waitlist entry has been cancelled.",
        };
      default:
        return {
          label: "Unknown",
          icon: AlertCircle,
          color: "#6b7280",
          bgColor: "#f3f4f6",
          description: "Status unknown.",
        };
    }
  };

  const handleCancel = async () => {
    if (!waitlistEntry) return;

    setCancelling(true);
    try {
      const success = await cancelWaitlist(
        waitlistEntry.id,
        waitlistEntry.restaurant?.name,
      );
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        router.back();
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleNavigateToRestaurant = () => {
    if (waitlistEntry?.restaurant_id) {
      router.push(`/(protected)/restaurant/${waitlistEntry.restaurant_id}`);
    }
  };

  const handleBookNow = async () => {
    if (!waitlistEntry || waitlistEntry.status !== "notified") return;

    setConverting(true);
    try {
      const result = await convertWaitlistToBooking(waitlistEntry.id);

      if (result.success && result.bookingId) {
        // Success! Provide haptic feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        // Show success alert
        Alert.alert(
          "Booking Confirmed! 🎉",
          `Your table at ${waitlistEntry.restaurant?.name} has been booked successfully!`,
          [
            {
              text: "View Booking",
              onPress: () => {
                router.replace(`/(protected)/booking/${result.bookingId}`);
              },
            },
          ],
        );
      } else {
        // Show error alert
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Booking Failed",
          result.error ||
            "Failed to convert waitlist to booking. Please try again.",
        );
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return <WaitlistDetailsSkeleton />;
  }

  if (!waitlistEntry) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Waitlist Details"
          onBack={() => router.back()}
        />
        <View className="flex-1 justify-center items-center p-6">
          <AlertCircle size={48} color={colors[colorScheme].muted} />
          <Text className="mt-4 text-lg font-semibold">
            Waitlist Entry Not Found
          </Text>
          <Text className="mt-2 text-muted-foreground text-center">
            This waitlist entry might have been removed or doesn&apos;t exist.
          </Text>
          <Button className="mt-6 rounded-md" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const tableTypeInfo =
    TABLE_TYPE_INFO[waitlistEntry.table_type as keyof typeof TABLE_TYPE_INFO] ||
    TABLE_TYPE_INFO.any;

  // Allow cancellation for all entries except those already booked or cancelled
  const canCancel =
    waitlistEntry.status !== "booked" &&
    waitlistEntry.status !== "cancelled" &&
    !waitlistEntry.converted_booking_id;

  // Only show Book Now for notified entries
  const showBookNow = waitlistEntry.status === "notified";

  const waitlistDate = parseISO(waitlistEntry.desired_date);
  const isDateToday = isToday(waitlistDate);
  const isDateTomorrow = isTomorrow(waitlistDate);

  // Get status configuration
  const statusConfig = getStatusConfig(waitlistEntry.status);
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <NavigationHeader
        title="Waitlist Details"
        onBack={() => router.back()}
        showShare={true}
        onShare={shareWaitlistEntry}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Restaurant Header - Using the same component style as Booking */}
        <WaitlistDetailsHeader
          restaurant={waitlistEntry.restaurant}
          onPress={handleNavigateToRestaurant}
        />

        {/* Status Section */}
        <View className="px-4 py-4 border-b border-border">
          <View
            className="p-4 rounded-lg"
            style={{ backgroundColor: statusConfig.bgColor }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-3">
                <StatusIcon size={24} color={statusConfig.color} />
                <Text
                  className="font-bold text-lg"
                  style={{ color: statusConfig.color }}
                >
                  {statusConfig.label}
                </Text>
              </View>
            </View>
            <Text className="text-sm" style={{ color: statusConfig.color }}>
              {statusConfig.description}
            </Text>
          </View>

          {/* Combined Expiry Information */}
          {(waitlistEntry.status === "active" && waitlistEntry.expires_at) ||
          (waitlistEntry.status === "notified" &&
            waitlistEntry.notification_expires_at) ? (
            <View
              className="mt-3 rounded-lg p-4 border"
              style={{
                backgroundColor:
                  waitlistEntry.status === "active" ? "#fff7ed" : "#fef9c3",
                borderColor:
                  waitlistEntry.status === "active" ? "#fdba74" : "#fde047",
              }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Clock
                  size={20}
                  color={
                    waitlistEntry.status === "active"
                      ? colors[colorScheme].primary
                      : "#f59e0b"
                  }
                />
                <Text
                  className="font-semibold"
                  style={{
                    color:
                      waitlistEntry.status === "active" ? "#9a3412" : "#854d0e",
                  }}
                >
                  {waitlistEntry.status === "active"
                    ? "Waitlist Expires"
                    : "Table Offer Expires"}
                </Text>
              </View>
              <Text
                className="text-sm"
                style={{
                  color:
                    waitlistEntry.status === "active" ? "#9a3412" : "#854d0e",
                }}
              >
                {waitlistEntry.status === "active"
                  ? `This waitlist entry will expire on ${format(parseISO(waitlistEntry.expires_at || ""), "EEEE, MMMM d, yyyy 'at' h:mm a")}`
                  : `This table offer expires on ${format(parseISO(waitlistEntry.notification_expires_at || ""), "EEEE, MMMM d, yyyy 'at' h:mm a")}. Book now to secure your table.`}
              </Text>

              <Text
                className="text-xs mt-2"
                style={{
                  color:
                    waitlistEntry.status === "active" ? "#c2410c" : "#a16207",
                }}
              >
                Created:{" "}
                {waitlistEntry.created_at
                  ? format(
                      parseISO(waitlistEntry.created_at),
                      "MMM d, yyyy 'at' h:mm a",
                    )
                  : "N/A"}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Waitlist Information */}
        <View className="px-4 py-4">
          <H3 className="mb-4 text-foreground">Waitlist Information</H3>

          {/* Main Waitlist Details Card */}
          <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            {/* Date and Time Row - Combined Format */}
            <View className="mb-4">
              <View className="flex-row items-start gap-3 mb-3">
                <View className="bg-primary/10 rounded-full p-2">
                  <Calendar size={18} color={colors[colorScheme].primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    DESIRED DATE & TIME
                  </Text>
                  <Text className="font-semibold text-base text-primary dark:text-white">
                    {isDateToday
                      ? "Today"
                      : isDateTomorrow
                        ? "Tomorrow"
                        : formatDateLong(waitlistDate)}
                    {!isDateToday && !isDateTomorrow && (
                      <Text className="text-sm">
                        {", "}
                        {waitlistDate.getFullYear()}
                      </Text>
                    )}
                    <Text className="text-primary dark:text-white">
                      {" at "}
                      {waitlistEntry.desired_time_range}
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Party Size */}
              <View className="flex-row items-center gap-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2">
                  <Users size={18} color={colors[colorScheme].primary} />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground mb-1">
                    GUESTS
                  </Text>
                  <Text className="font-medium text-foreground">
                    {waitlistEntry.party_size}{" "}
                    {waitlistEntry.party_size === 1 ? "Guest" : "Guests"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Table Preference */}
            <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
              <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                <TableIcon size={18} color={colors[colorScheme].primary} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">
                  TABLE PREFERENCE
                </Text>
                <View className="flex-row items-center">
                  <Text className="font-medium text-foreground mr-2">
                    {tableTypeInfo.label}
                  </Text>
                  <Text className="text-sm">{tableTypeInfo.icon}</Text>
                </View>
              </View>
            </View>

            {/* Special Requests */}
            {waitlistEntry.special_requests && (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <Info size={18} color={colors[colorScheme].primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    SPECIAL REQUESTS
                  </Text>
                  <Text className="text-sm text-foreground">
                    {waitlistEntry.special_requests}
                  </Text>
                </View>
              </View>
            )}

            {/* Just showing creation date */}
            <View className="border-t border-primary/20 pt-3 mb-3 flex-row items-center">
              <View className="bg-primary/10 rounded-full p-2 mr-3">
                <Clock size={18} color={colors[colorScheme].primary} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">
                  CREATED ON
                </Text>
                <Text className="font-medium text-foreground">
                  {waitlistEntry.created_at
                    ? format(
                        parseISO(waitlistEntry.created_at),
                        "MMMM d, yyyy 'at' h:mm a",
                      )
                    : "N/A"}
                </Text>
              </View>
            </View>

            {/* Reference Code Section */}
            <View className="pt-3">
              <Text className="font-semibold mb-3 text-foreground">
                Reference Code
              </Text>
              <Pressable
                onPress={() => {}}
                className="flex-row items-center justify-between bg-background rounded-lg p-3 border border-border"
              >
                <Text className="font-mono font-bold text-xl tracking-wider text-foreground">
                  {waitlistEntry.id.slice(0, 8).toUpperCase()}
                </Text>
                <Copy size={20} color={colors[colorScheme].mutedForeground} />
              </Pressable>
              <Text className="text-xs text-muted-foreground mt-2">
                Use this code when contacting the restaurant about your waitlist
                entry
              </Text>
            </View>
          </View>
        </View>

        {/* WhatsApp contact would go here if restaurant has it */}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>

      {/* Action Buttons */}
      <View className="absolute bottom-4 left-0 right-0 bg-background border-t border-border">
        <View className="p-6">
          {/* For expired waitlist - only View Restaurant button */}
          {waitlistEntry.status === "expired" ? (
            <Button
              variant="default"
              onPress={handleNavigateToRestaurant}
              className="w-full rounded-md h-12"
            >
              <Text className="font-medium text-primary-foreground">
                View Restaurant
              </Text>
            </Button>
          ) : (
            /* For all other statuses - Call and Cancel/Book buttons */
            <View className="flex-row gap-4">
              {/* Left Button - Call Restaurant */}
              <Button
                variant="outline"
                onPress={() => {
                  if (waitlistEntry?.restaurant?.phone_number) {
                    // This would trigger the phone dialer in a real implementation
                    Alert.alert(
                      "Call Restaurant",
                      `Calling ${waitlistEntry.restaurant.name}: ${waitlistEntry.restaurant.phone_number}`,
                    );
                  } else {
                    Alert.alert(
                      "No Phone Number",
                      "This restaurant doesn't have a phone number listed.",
                    );
                  }
                }}
                className="flex-1 rounded-md h-12 border-border"
              >
                <Text className="font-medium text-foreground">
                  Call Restaurant
                </Text>
              </Button>

              {/* Right Button - Cancel Waitlist or Book Now */}
              <Button
                variant={
                  waitlistEntry.status === "notified"
                    ? "default"
                    : "destructive"
                }
                onPress={
                  waitlistEntry.status === "notified"
                    ? handleBookNow
                    : handleCancel
                }
                disabled={!canCancel || cancelling || converting}
                className="flex-1 rounded-md h-12"
              >
                {cancelling || converting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-primary-foreground font-semibold">
                    {waitlistEntry.status === "notified"
                      ? "Book Now"
                      : waitlistEntry.status === "booked"
                        ? "View Booking"
                        : "Cancel Waitlist"}
                  </Text>
                )}
              </Button>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
