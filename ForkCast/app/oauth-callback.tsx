import React, { useEffect, useState, useRef } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { SafeAreaView } from "@/components/safe-area-view";
import { useAuth } from "@/context/supabase-provider";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/config/supabase";

// This MUST be called at module level in the screen that receives the OAuth redirect.
// On Android it closes the Chrome Custom Tab when the exp:// deep link arrives.
WebBrowser.maybeCompleteAuthSession();

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session, initialized } = useAuth();
  const { logOAuthLogin } = useAuditLog();
  const [countdown, setCountdown] = useState(30);
  const hasNavigated = useRef(false);
  const hasLoggedAuth = useRef(false);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  const dot1Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot1.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot1.value, [0, 1], [0, -6]) }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot2.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot2.value, [0, 1], [0, -6]) }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot3.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot3.value, [0, 1], [0, -6]) }],
  }));

  const navigateHome = (resolvedSession: { user?: { app_metadata?: { provider?: string } } }) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    if (pollInterval.current) clearInterval(pollInterval.current);
    if (!hasLoggedAuth.current) {
      hasLoggedAuth.current = true;
      const provider = resolvedSession.user?.app_metadata?.provider as "google" | "apple" | undefined;
      if (provider === "google" || provider === "apple") {
        logOAuthLogin(provider).catch(console.error);
      }
    }
    router.replace("/(protected)/(tabs)");
  };

  // Handle code in URL params (deep link may carry ?code= directly)
  useEffect(() => {
    const code = params.code as string | undefined;
    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (!error && data?.session) navigateHome(data.session);
    }).catch(() => {});
  }, [params.code]);

  // Handle URL from Linking (for cases where params aren't parsed by router)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes("code=") && !url.includes("access_token")) return;
      const { data, error } = await supabase.auth.exchangeCodeForSession(url).catch(() => ({ data: null, error: null }));
      if (!error && data?.session) navigateHome(data.session);
    };
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Poll both context session and supabase.auth.getSession() directly
    // so we catch the session regardless of whether onAuthStateChange fired
    const check = async () => {
      // Context session updated
      if (session) { navigateHome(session); return; }
      // Direct check from storage
      const { data: { session: stored } } = await supabase.auth.getSession();
      if (stored) navigateHome(stored);
    };

    pollInterval.current = setInterval(check, 500);

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

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      clearInterval(timer);
    };
  }, [initialized, session, router]);

  useEffect(() => {
    const start = (val: typeof dot1, delay: number) => {
      setTimeout(() => {
        val.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 400 }),
          ),
          -1,
          false,
        );
      }, delay);
    };
    start(dot1, 0);
    start(dot2, 160);
    start(dot3, 320);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8 gap-y-8">
        {/* Animated dots */}
        <View className="flex-row gap-x-3 items-center">
          <Animated.View style={dot1Style} className="w-3 h-3 rounded-full bg-primary" />
          <Animated.View style={dot2Style} className="w-3 h-3 rounded-full bg-primary" />
          <Animated.View style={dot3Style} className="w-3 h-3 rounded-full bg-primary" />
        </View>

        <View className="items-center gap-y-2">
          <Text className="text-2xl font-bold text-foreground text-center">
            Signing you in
          </Text>
          <Text className="text-base text-muted-foreground text-center">
            Just a moment...
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
