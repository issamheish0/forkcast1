import React from "react";
import { View } from "react-native";
import { Gift, Utensils, Star, MessageSquare } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface BookingSpecialRequestsProps {
  booking: {
    occasion?: string | null;
    dietary_notes?: string[] | null;
    table_preferences?: string[] | null;
    special_requests?: string | null;
  };
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

export const BookingSpecialRequests: React.FC<BookingSpecialRequestsProps> = ({
  booking,
}) => {
  const hasSpecialRequests =
    booking.occasion ||
    (booking.dietary_notes && booking.dietary_notes.length > 0) ||
    (booking.table_preferences && booking.table_preferences.length > 0) ||
    booking.special_requests;

  if (!hasSpecialRequests) {
    return null;
  }

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Special Requests</H3>
      <View className="bg-muted/30 rounded-lg p-4 space-y-3">
        {booking.occasion && (
          <View>
            <Text className="font-medium flex-row items-center">
              <Gift size={16} color="#666" className="mr-2" />
              Occasion:
            </Text>
            <Text className="text-muted-foreground capitalize">
              {booking.occasion}
            </Text>
          </View>
        )}

        {booking.dietary_notes && booking.dietary_notes.length > 0 && (
          <View>
            <Text className="font-medium flex-row items-center">
              <Utensils size={16} color="#666" className="mr-2" />
              Dietary Requirements:
            </Text>
            <Text className="text-muted-foreground">
              {booking.dietary_notes.map(formatDietaryRestriction).join(", ")}
            </Text>
          </View>
        )}

        {booking.table_preferences && booking.table_preferences.length > 0 && (
          <View>
            <Text className="font-medium flex-row items-center">
              <Star size={16} color="#666" className="mr-2" />
              Table Preferences:
            </Text>
            <Text className="text-muted-foreground">
              {booking.table_preferences.map(formatTablePreference).join(", ")}
            </Text>
          </View>
        )}

        {booking.special_requests && (
          <View>
            <Text className="font-medium flex-row items-center">
              <MessageSquare size={16} color="#666" className="mr-2" />
              Special Notes:
            </Text>
            <Text className="text-muted-foreground">
              {booking.special_requests}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
