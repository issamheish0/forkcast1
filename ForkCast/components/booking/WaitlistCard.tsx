// components/booking/WaitlistCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import {
  Clock,
  Calendar,
  Users,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from "lucide-react-native";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

import { Text } from "@/components/ui/text";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { H3 } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { cn } from "@/lib/utils";
import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";
import type { EnhancedWaitlistEntry } from "@/hooks/useBookings";
import { TABLE_TYPE_INFO } from "@/types/waitlist";

// Helper functions for status handling
const getStatusInfo = (status: string, tier?: string) => {
  switch (status) {
    case "expired":
      return {
        icon: AlertCircle,
        text: "Expired (Waitlist)",
        color: "#6b7280",
        bgColor: "#f3f4f6",
      };
    case "cancelled":
      return {
        icon: AlertCircle,
        text: "Cancelled",
        color: "#dc2626",
        bgColor: "#fef2f2",
      };
    case "notified":
      return {
        icon: AlertCircle,
        text: "Table Available",
        color: "#10b981",
        bgColor: "#ecfdf5",
      };
    case "booked":
      return {
        icon: CheckCircle,
        text: "Converted to Booking",
        color: "#10b981",
        bgColor: "#ecfdf5",
      };
    default:
      return {
        icon: Clock,
        text: tier === "basic" ? "Waitlisted" : "Waitlisted",
        color: "#f59e0b",
        bgColor: "#fef3c7",
      };
  }
};

interface WaitlistCardProps {
  waitlistEntry: EnhancedWaitlistEntry;
  variant?: "upcoming" | "past";
  onPress?: () => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  processingWaitlistId?: string | null;
}

export const WaitlistCard = React.memo<WaitlistCardProps>(
  ({
    waitlistEntry,
    variant = "upcoming",
    onPress,
    onNavigateToRestaurant,
    processingWaitlistId,
  }) => {
    const { colorScheme } = useColorScheme();

    const formatDate = (date: string) => {
      const d = parseISO(date);
      if (isToday(d)) return "Today";
      if (isTomorrow(d)) return "Tomorrow";
      return format(d, "MMM d");
    };

    const isNotified = waitlistEntry.status === "notified";
    const isProcessing = processingWaitlistId === waitlistEntry.id;

    const tableTypeInfo = TABLE_TYPE_INFO[
      waitlistEntry.table_type as keyof typeof TABLE_TYPE_INFO
    ] || { icon: "🍽️", label: "Table" };
    const statusInfo = getStatusInfo(waitlistEntry.status);

    const handlePress = () => {
      if (onPress) {
        onPress();
      }
    };

    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-lg overflow-hidden mb-3 border border-border shadow-sm",
        )}
        disabled={isProcessing}
        style={{ opacity: isProcessing ? 0.6 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={`Waitlist entry for ${waitlistEntry.restaurant?.name || "restaurant"} on ${formatDate(waitlistEntry.desired_date)}`}
        accessibilityHint="Tap to view waitlist details and options"
      >
        {/* Restaurant Header */}
        <View className="flex-row p-3">
          <Image
            {...({
              source: {
                uri:
                  waitlistEntry.restaurant?.main_image_url ||
                  "https://via.placeholder.com/60x60?text=No+Image",
              },
              optimizationPreset: "medium",
              className: "w-16 h-16 rounded-lg bg-muted",
              contentFit: "cover",
              onError: () => {},
              placeholder: "https://via.placeholder.com/60x60?text=Loading",
              transition: 200,
              accessibilityLabel: `Image of ${waitlistEntry.restaurant?.name || "restaurant"}`,
            } as any)}
          />
          <View className="flex-1 ml-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <H3 className="mb-1 text-base">
                  {waitlistEntry.restaurant?.name || "Restaurant"}
                </H3>
                <Text className="text-muted-foreground text-xs mb-1">
                  {getDisplayCuisine(
                    waitlistEntry.restaurant?.cuisine_type,
                    (waitlistEntry.restaurant as any)?.secondary_cuisines,
                    "Cuisine",
                  )}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {waitlistEntry.restaurant?.address || "Address"}
                </Text>
              </View>
              <ChevronRight size={16} color={colors[colorScheme].muted} />
            </View>
          </View>
        </View>

        {/* Waitlist Details - Compact Layout */}
        <View className="px-3 pb-3">
          {/* --- Core Details Section - More Prominent --- */}
          <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center gap-2">
                <Calendar size={14} color={colors[colorScheme].primary} />
                <Text className="font-semibold text-sm text-primary dark:text-white">
                  {formatDate(waitlistEntry.desired_date)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Clock size={14} color={colors[colorScheme].primary} />
                <Text className="font-semibold text-sm text-primary dark:text-white">
                  {waitlistEntry.desired_time_range}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={14} color={colors[colorScheme].primary} />
                <Text className="text-sm font-medium text-primary dark:text-white">
                  {waitlistEntry.party_size}{" "}
                  {waitlistEntry.party_size === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
              {waitlistEntry.table_type !== "any" && (
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm">{tableTypeInfo.icon}</Text>
                  <Text className="text-xs text-primary dark:text-white">
                    {tableTypeInfo.label}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Special Requests / Notes Preview */}
          {waitlistEntry.special_requests && (
            <View className="bg-muted/30 rounded-lg p-2 mb-2">
              <Text className="text-xs text-muted-foreground">
                Note: {waitlistEntry.special_requests}
              </Text>
            </View>
          )}

          {/* Status Bar - Using helper function for cleaner code */}
          <View
            className="w-full py-3 px-4 mb-3 rounded-lg"
            style={{ backgroundColor: statusInfo.bgColor }}
          >
            <View className="flex-row items-center justify-center gap-2">
              {React.createElement(statusInfo.icon, {
                size: 16,
                color: statusInfo.color,
              })}
              <Text
                className="text-sm font-semibold"
                style={{ color: statusInfo.color }}
              >
                {statusInfo.text}
              </Text>
              {waitlistEntry.expires_at &&
                waitlistEntry.status === "active" && (
                  <Text className="text-xs text-muted-foreground">
                    (Expires:{" "}
                    {format(parseISO(waitlistEntry.expires_at), "h:mm a")})
                  </Text>
                )}
            </View>
          </View>

          {/* Notification Alert - Only show for notified entries */}
          {isNotified && variant === "upcoming" && (
            <View className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <View className="flex-row items-center">
                <CheckCircle size={16} color="#10b981" />
                <Text className="ml-2 text-sm font-medium text-green-800 dark:text-green-200">
                  Table Available!
                </Text>
              </View>
              <Text className="text-xs text-green-700 dark:text-green-300 mt-1">
                A table is ready! Tap to book now
              </Text>
            </View>
          )}

          {/* Expiration Warning */}
        </View>
      </Pressable>
    );
  },
);

WaitlistCard.displayName = "WaitlistCard";
