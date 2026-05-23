// components/booking/PendingPaymentBanner.tsx
// Banner component that shows when a user has a pending payment checkout
// Displays countdown timer and allows user to complete or cancel payment

import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Clock, CreditCard, X } from "lucide-react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface PendingPaymentBannerProps {
  bookingId: string;
  restaurantName: string;
  expiresAt: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function PendingPaymentBanner({
  bookingId,
  restaurantName,
  expiresAt,
  onComplete,
  onDismiss,
}: PendingPaymentBannerProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const themeColors = colors[colorScheme] ?? colors.light;

  const [timeRemaining, setTimeRemaining] = useState<{
    minutes: number;
    seconds: number;
    expired: boolean;
  }>({ minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const expiryTime = new Date(expiresAt);
      const now = new Date();
      const diffMs = expiryTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true });
        return;
      }

      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      setTimeRemaining({ minutes, seconds, expired: false });
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onComplete) {
      onComplete();
    } else {
      router.push(`/booking/${bookingId}`);
    }
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss?.();
  };

  // Don't render if expired
  if (timeRemaining.expired) {
    return null;
  }

  // Determine urgency color
  const isUrgent = timeRemaining.minutes < 3;
  const urgentColor = "#EF4444"; // red-500
  const normalColor = themeColors.primary;
  const accentColor = isUrgent ? urgentColor : normalColor;

  const formattedTime = `${timeRemaining.minutes}:${timeRemaining.seconds.toString().padStart(2, "0")}`;

  return (
    <View
      className="mx-4 my-2 rounded-xl overflow-hidden"
      style={{
        backgroundColor: isUrgent
          ? "rgba(239, 68, 68, 0.1)"
          : `${themeColors.primary}10`,
        borderWidth: 1,
        borderColor: isUrgent
          ? "rgba(239, 68, 68, 0.3)"
          : `${themeColors.primary}30`,
      }}
    >
      <Pressable onPress={handleComplete} className="p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              <CreditCard size={20} color={accentColor} />
            </View>
            <View className="flex-1">
              <Text
                className="font-semibold text-sm"
                style={{ color: themeColors.foreground }}
              >
                Payment Pending
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: themeColors.mutedForeground }}
                numberOfLines={1}
              >
                {restaurantName}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <View
              className="flex-row items-center px-3 py-1.5 rounded-full mr-2"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              <Clock size={14} color={accentColor} />
              <Text
                className="ml-1.5 font-bold text-sm"
                style={{ color: accentColor }}
              >
                {formattedTime}
              </Text>
            </View>

            {onDismiss && (
              <Pressable
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="p-1"
              >
                <X size={18} color={themeColors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        <View className="mt-3">
          <Text
            className="text-xs"
            style={{
              color: isUrgent ? urgentColor : themeColors.mutedForeground,
            }}
          >
            {isUrgent
              ? "⚠️ Payment expires soon! Tap to complete now."
              : "Tap to complete your deposit payment."}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
