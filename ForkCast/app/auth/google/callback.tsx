import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { H1, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { getActivityIndicatorColor } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";

export default function GoogleOAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const { session, initialized } = useAuth();
  const [countdown, setCountdown] = useState(15);
  const [processing, setProcessing] = useState(true);
  const hasNavigated = useRef(false);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
  }, [initialized, session, router, params]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-y-6">
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />

        <H1 className="text-center text-2xl">
          {processing ? "Completing Google Sign In..." : "Almost Ready!"}
        </H1>

        <Muted className="text-center text-lg">
          {processing
            ? "Setting up your account and preferences..."
            : "Finalizing your authentication."}
        </Muted>

        <View className="bg-muted/20 rounded-lg p-4 w-full">
          <Muted className="text-center text-sm">
            {processing
              ? "Processing OAuth tokens and setting up your session..."
              : "If this takes too long, you'll be redirected automatically."}
          </Muted>
        </View>

        <Muted className="text-center text-xs opacity-70">
          {countdown > 0
            ? `Auto-redirect in ${countdown} seconds`
            : "Redirecting now..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
