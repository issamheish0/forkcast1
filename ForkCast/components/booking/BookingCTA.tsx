// components/booking/BookingCTA.tsx - Updated with request booking support
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Calendar, CheckCircle, Send, Timer } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface BookingCTAProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  isDisabled: boolean;
  /** Short message explaining why the button is disabled */
  disabledHint?: string;
  bookingPolicy: "instant" | "request" | "approval"; // "approval" is alias for "request"
  invitedFriendsCount?: number;
  selectedOfferDiscount?: number;
  appliedPromoCode?: string | null;
  appliedPromoDiscount?: { type: "percentage" | "fixed_amount"; value: number } | null;
}

export const BookingCTA: React.FC<BookingCTAProps> = ({
  onSubmit,
  isSubmitting,
  isDisabled,
  disabledHint,
  bookingPolicy,
  invitedFriendsCount = 0,
  selectedOfferDiscount,
  appliedPromoCode,
  appliedPromoDiscount,
}) => {
  const isRequestBooking =
    bookingPolicy === "request" || bookingPolicy === "approval";

  // Different button text and icon based on booking policy
  const buttonText = isRequestBooking
    ? "Send Booking Request"
    : "Confirm Booking";

  const ButtonIcon = isRequestBooking ? Send : Calendar;

  return (
    <View className="p-4 bg-background border-t border-border">
      {/* Summary Info */}
      <View className="mb-3">
        <View className="flex-row flex-wrap gap-2 mb-2">
          {invitedFriendsCount > 0 && (
            <View className="bg-blue-100 dark:bg-blue-900/20 rounded-full px-3 py-1">
              <Text className="text-xs text-blue-800 dark:text-blue-200">
                +{invitedFriendsCount} friends invited
              </Text>
            </View>
          )}

          {selectedOfferDiscount && (
            <View className="bg-green-100 dark:bg-green-900/20 rounded-full px-3 py-1">
              <Text className="text-xs text-green-800 dark:text-green-200 font-medium">
                {selectedOfferDiscount}% OFF applied
              </Text>
            </View>
          )}

          {appliedPromoCode && appliedPromoDiscount && (
            <View className="bg-violet-100 dark:bg-violet-900/20 rounded-full px-3 py-1">
              <Text className="text-xs text-violet-800 dark:text-violet-200 font-medium">
                {appliedPromoCode} ·{" "}
                {appliedPromoDiscount.type === "percentage"
                  ? `${appliedPromoDiscount.value}% OFF`
                  : `$${appliedPromoDiscount.value} OFF`}
              </Text>
            </View>
          )}

        </View>

        {/* Request Booking Info */}
        {isRequestBooking && (
          <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-2">
            <View className="flex-row items-start gap-2">
              <Timer size={16} color="#f97316" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Request Booking
                </Text>
                <Text className="text-xs text-orange-700 dark:text-orange-300">
                  The restaurant will review and respond within 2 hours
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Instant Booking Info */}
        {!isRequestBooking && (
          <View className="flex-row items-center gap-2 justify-center">
            <CheckCircle size={16} color="#10b981" />
            <Text className="text-xs text-muted-foreground">
              Instant confirmation • No waiting
            </Text>
          </View>
        )}
      </View>

      {/* Disabled hint */}
      {isDisabled && !isSubmitting && disabledHint && (
        <Text className="text-xs text-amber-600 dark:text-amber-400 text-center mb-2">
          {disabledHint}
        </Text>
      )}

      {/* Submit Button */}
      <Button
        onPress={onSubmit}
        size="lg"
        disabled={isDisabled || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <View className="flex-row items-center justify-center gap-2">
            <ButtonIcon size={20} color="white" />
            <Text className="text-white font-bold text-lg">{buttonText}</Text>
          </View>
        )}
      </Button>

      {/* Terms Note */}
      <Text className="text-xs text-muted-foreground text-center mt-2">
        By {isRequestBooking ? "requesting" : "booking"}, you agree to the
        restaurant's terms and cancellation policy
      </Text>
    </View>
  );
};
