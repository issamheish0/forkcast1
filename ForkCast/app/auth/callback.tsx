import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { H1, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { getActivityIndicatorColor } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const { session, initialized } = useAuth();
  const [countdown, setCountdown] = useState(15);
  const [processing, setProcessing] = useState(true);
  const hasNavigated = useRef(false);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine the provider from params or URL
  const provider =
    params.provider ||
    (typeof window !== "undefined" && window.location?.href?.includes("google")
      ? "Google"
      : "OAuth");

  useEffect(() => {
    // Wait for auth to initialize
    if (!initialized) {
      return;
    }

    // ACTIVE SESSION POLLING: Check for session every 500ms
    pollInterval.current = setInterval(() => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;

        // Clear all timers
        if (pollInterval.current) clearInterval(pollInterval.current);

        // Navigate to home immediately
        router.replace("/(protected)/(tabs)");
      }
    }, 500);

    // Start countdown timer as fallback
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.replace("/welcome");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Stop processing indicator after platform-specific delay
    const processingDelay = Platform.OS === "android" ? 4000 : 2000;
    const processingTimer = setTimeout(() => {
      setProcessing(false);
    }, processingDelay);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      clearInterval(timer);
      clearTimeout(processingTimer);
    };
  }, [initialized, session, router, params, provider]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-y-6">
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />

        <H1 className="text-center text-2xl">
          {processing ? `Signing you in with ${provider}...` : "Almost there!"}
        </H1>

        <Muted className="text-center">
          {processing
            ? `Please wait while we complete your ${provider} authentication.`
            : "Finalizing your authentication process."}
        </Muted>

        <View className="bg-muted/20 rounded-lg p-4 w-full">
          <Muted className="text-center text-sm">
            {processing
              ? "Processing authentication tokens..."
              : "Taking longer than usual? You'll be redirected soon."}
          </Muted>
        </View>

        <Muted className="text-center text-xs opacity-70">
          {countdown > 0 ? `Redirecting in ${countdown}s` : "Redirecting..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
