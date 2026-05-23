import { View, ActivityIndicator } from "react-native";
import React, { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { H1, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors, getActivityIndicatorColor } from "@/lib/utils";

export default function NotFound() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const [isAuthCallback, setIsAuthCallback] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Check if this might be an OAuth callback scenario
    const url = typeof window !== "undefined" ? window.location?.href : "";
    const hasAuthIndicators =
      url.includes("google") ||
      url.includes("access_token") ||
      url.includes("code=") ||
      url.includes("auth") ||
      Object.keys(params).some(
        (key) =>
          key.includes("token") ||
          key.includes("code") ||
          key.includes("google") ||
          key.includes("auth"),
      );

    if (hasAuthIndicators) {
      setIsAuthCallback(true);

      // Start countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // After countdown, redirect to welcome if still here
            router.replace("/welcome");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      // For regular 404s, redirect to welcome after a short delay
      const timer = setTimeout(() => {
        router.replace("/welcome");
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [params, router]);

  if (isAuthCallback) {
    return (
      <View className="flex flex-1 items-center justify-center bg-background p-4 gap-y-6">
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />
        <H1 className="text-center">Signing you in...</H1>
        <Muted className="text-center">
          Processing your authentication. Please wait...
        </Muted>
        <Muted className="text-center text-xs">
          Redirecting in {countdown} seconds if not completed
        </Muted>
      </View>
    );
  }

  return (
    <View className="flex flex-1 items-center justify-center bg-background p-4 gap-y-6">
      <H1 className="text-center">404</H1>
      <Muted className="text-center">This page could not be found.</Muted>
      <ActivityIndicator
        size="small"
        color={getActivityIndicatorColor(colorScheme)}
      />
      <Muted className="text-center text-xs">Redirecting to home...</Muted>
    </View>
  );
}
