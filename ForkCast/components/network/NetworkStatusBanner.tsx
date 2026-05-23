// components/network/NetworkStatusBanner.tsx
import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  Wifi,
  WifiOff,
  Signal,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useNetwork } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { getIconColor } from "@/lib/utils";

interface NetworkStatusBannerProps {
  showWhenOnline?: boolean;
  autoDismiss?: number; // ms
  position?: "top" | "bottom";
  onDismiss?: () => void;
}

export function NetworkStatusBanner({
  showWhenOnline = false,
  autoDismiss,
  position = "top",
  onDismiss,
}: NetworkStatusBannerProps) {
  const { networkState, isOnline, refresh } = useNetwork();
  const { colorScheme } = useColorScheme();
  const [visible, setVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useSharedValue(0);

  // Determine if banner should be shown
  const shouldShow =
    visible &&
    (!isOnline ||
      (showWhenOnline && isOnline) ||
      networkState.isSlowConnection);

  // Auto-dismiss logic
  useEffect(() => {
    if (autoDismiss && isOnline && !networkState.isSlowConnection) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, isOnline, networkState.isSlowConnection]);

  // Slide animation
  useEffect(() => {
    slideAnim.value = withTiming(shouldShow ? 1 : 0, { duration: 300 });
  }, [shouldShow]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const getBannerConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        message: "No internet connection",
        submessage: "Please check your connection and try again",
        bgColor: "bg-red-500",
        textColor: "text-white",
        showRefresh: true,
      };
    }

    if (networkState.isSlowConnection) {
      return {
        icon: Signal,
        message: "Slow connection detected",
        submessage: `${networkState.connectionQuality} quality - Some features may be limited`,
        bgColor: "bg-yellow-500 dark:bg-yellow-600",
        textColor: "text-black dark:text-white",
        showRefresh: true,
      };
    }

    if (showWhenOnline && isOnline) {
      return {
        icon: CheckCircle,
        message: "Connected",
        submessage: `${networkState.type} - ${networkState.connectionQuality} quality`,
        bgColor: "bg-green-500",
        textColor: "text-white",
        showRefresh: false,
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;

  const animatedStyle = useAnimatedStyle(() => {
    const translateY =
      slideAnim.value === 1 ? 0 : position === "top" ? -100 : 100;
    return {
      transform: [{ translateY: translateY * (1 - slideAnim.value) }],
    };
  });

  return (
    <Animated.View
      style={[animatedStyle]}
      className={`w-full ${config.bgColor} ${position === "top" ? "pt-safe" : "pb-safe"}`}
    >
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center flex-1">
          <Icon
            size={20}
            color={getIconColor(config.textColor, colorScheme)}
            strokeWidth={2}
          />
          <View className="ml-3 flex-1">
            <Text className={`font-semibold ${config.textColor}`}>
              {config.message}
            </Text>
            {config.submessage && (
              <Text className={`text-xs ${config.textColor} opacity-90 mt-0.5`}>
                {config.submessage}
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {config.showRefresh && (
            <Pressable
              onPress={handleRefresh}
              disabled={refreshing}
              className="p-2"
            >
              <RefreshCw
                size={18}
                color={getIconColor(config.textColor, colorScheme)}
                strokeWidth={2}
                className={refreshing ? "animate-spin" : ""}
              />
            </Pressable>
          )}
          <Pressable onPress={handleDismiss} className="p-2">
            <X
              size={18}
              color={getIconColor(config.textColor, colorScheme)}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
