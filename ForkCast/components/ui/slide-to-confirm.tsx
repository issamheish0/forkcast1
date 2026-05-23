// components/ui/slide-to-confirm.tsx
import React, { useState } from "react";
import { View, PanResponder, useColorScheme } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronRight, Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";

interface SlideToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
  confirmText?: string;
  slideText?: string;
  width?: number;
  height?: number;
}

export function SlideToConfirm({
  onConfirm,
  disabled = false,
  confirmText = "Confirm",
  slideText = "Slide to confirm",
  width = 300,
  height = 60,
}: SlideToConfirmProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const slideAnim = useSharedValue(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const thumbWidth = 80;
  const maxSlide = width - thumbWidth - 8;

  const handleConfirm = () => {
    onConfirm();
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !isConfirmed,
    onMoveShouldSetPanResponder: () => !disabled && !isConfirmed,
    onPanResponderGrant: () => {
      // Nothing to stop with reanimated
    },
    onPanResponderMove: (evt, gestureState) => {
      if (disabled || isConfirmed) return;

      const value = Math.min(Math.max(0, gestureState.dx), maxSlide);
      slideAnim.value = value;

      // Simple haptic feedback
      const progress = value / maxSlide;
      if (progress > 0.9) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (disabled || isConfirmed) return;

      const currentValue = gestureState.dx;

      if (currentValue > maxSlide * 0.8) {
        // Confirm
        setIsConfirmed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        slideAnim.value = withTiming(maxSlide, { duration: 200 }, () => {
          runOnJS(handleConfirm)();
        });
      } else {
        // Reset
        slideAnim.value = withTiming(0, { duration: 300 });
      }
    },
  });

  const trackAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    const bgColors = isDark
      ? ["#2B1517", "#4A2427", "#7D1F2A"]
      : ["#E8D4C9", "#D19B94", "#7D1F2A"];

    // Smoothly interpolate across the three color stops as the thumb slides.
    const backgroundColor = interpolateColor(
      slideAnim.value,
      [0, maxSlide * 0.5, maxSlide],
      bgColors,
    );

    return { backgroundColor };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
  }));

  const confirmTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      slideAnim.value,
      [0, maxSlide],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const slideTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      slideAnim.value,
      [0, maxSlide],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View className="items-center">
      <View
        className="overflow-hidden justify-center border border-border"
        style={{
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: isDark ? "hsl(345, 15%, 18%)" : "hsl(25, 30%, 88%)",
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: height / 2,
            },
            trackAnimatedStyle,
          ]}
        />

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            {
              width: thumbWidth,
              height: height - 8,
              borderRadius: (height - 8) / 2,
              backgroundColor: "#ffffff",
              borderWidth: 2,
              borderColor: isDark ? "#4A2427" : "#D19B94",
              justifyContent: "center",
              alignItems: "center",
              margin: 4,
              elevation: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              zIndex: 1,
            },
            thumbAnimatedStyle,
          ]}
        >
          {isConfirmed ? (
            <Check size={20} className="text-primary" />
          ) : (
            <ChevronRight size={20} className="text-muted-foreground" />
          )}
        </Animated.View>

        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
            },
            confirmTextStyle,
          ]}
        >
          <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
            {confirmText}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
            },
            slideTextStyle,
          ]}
        >
          <Text
            style={{
              color: isDark ? "#9CA3AF" : "#6B7280",
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {slideText}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
