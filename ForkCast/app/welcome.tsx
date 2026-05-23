// app/welcome.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// No background images; use theme primary color as background

export default function WelcomeScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { appleSignIn, googleSignIn, continueAsGuest } = useAuth();
  const isDark = colorScheme === "dark";

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  // No slideshow state; static primary background

  const appIcon = require("@/assets/transparent-icon.png");

  const slotWords = ["Book", "Discover", "Earn", "Share", "Review"];
  const [slotIndex, setSlotIndex] = useState(0);
  const slotOpacity = useSharedValue(1);
  const slotTranslateY = useSharedValue(0);

  const slotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: slotOpacity.value,
    transform: [{ translateY: slotTranslateY.value }],
  }));

  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      if (Platform.OS === "ios") {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          setAppleAuthAvailable(isAvailable);
        } catch {
          setAppleAuthAvailable(false);
        }
      }
    };

    checkAppleAuthAvailability();
  }, []);

  // Slot-like word loop
  useEffect(() => {
    const interval = setInterval(() => {
      slotOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          slotTranslateY.value = 6;
          slotOpacity.value = withTiming(1, { duration: 220 });
          slotTranslateY.value = withTiming(0, { duration: 220 });
        }
      });
      setSlotIndex((prev) => (prev + 1) % slotWords.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);
      const { error } = await appleSignIn();

      if (error) {
        if (error.message !== "User canceled Apple sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Apple sign in failed.",
          );
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Sign In Error",
        err.message || "Failed to sign in with Apple.",
      );
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const { error } = await googleSignIn();

      if (error) {
        const msg = error.message || "";
        const isFalsePositive =
          msg.includes("code verifier") ||
          msg.includes("User canceled Google sign-in");
        if (!isFalsePositive) {
          Alert.alert(
            "Sign In Error",
            msg || "Google sign in failed.",
          );
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Sign In Error",
        err.message || "Failed to sign in with Google.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    try {
      setIsGuestLoading(true);
      await continueAsGuest();
    } catch (err: any) {
      Alert.alert("Error", "Failed to continue as guest. Please try again.");
    } finally {
      setIsGuestLoading(false);
    }
  };

  const isLoading = isAppleLoading || isGoogleLoading || isGuestLoading;

  return (
    <View className="flex-1 bg-primary">
      <SafeAreaView className="flex flex-1 px-3" edges={["top"]}>
        <View className="flex flex-1 items-center justify-center px-6">
          <Image source={appIcon} className="w-32 h-32 rounded-2xl mb-6" />
          <H1 className="text-center mb-2 text-white">Welcome to ForkCast</H1>
          <Text className="text-center max-w-md text-lg leading-relaxed text-white/90">
            Discover and book from a wide variety of restaurants
          </Text>
          <Text className="text-center mt-2 text-white/80 text-lg">
            Here you can
          </Text>
          <Animated.View style={slotAnimatedStyle}>
            <Text className="text-center mt-3 text-white font-semibold text-lg">
              {slotWords[slotIndex]}
            </Text>
          </Animated.View>
        </View>

        <View
          className="rounded-3xl overflow-hidden mt-auto mx-3 mb-12"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 14,
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 20,
              paddingBottom: 24,
              backgroundColor: isDark
                ? "rgba(0,0,0,0.55)"
                : "rgba(255,255,255,0.75)",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.06)",
            }}
          >
            {/* Primary Actions */}
            <View className="gap-y-3 mb-6">
              <Button
                size="lg"
                variant="default"
                onPress={() => router.push("/sign-up")}
                disabled={isLoading}
                className="h-14 rounded-lg"
              >
                <Text>Create Account</Text>
              </Button>

              <Button
                size="lg"
                variant="outline"
                onPress={() => router.push("/sign-in")}
                disabled={isLoading}
                className="h-14 rounded-lg"
              >
                <Text>Sign In</Text>
              </Button>
            </View>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View
                className={`flex-1 h-[1px] ${isDark ? "bg-white/20" : "bg-black/20"}`}
              />
              <Text
                className={`mx-4 text-sm ${isDark ? "text-white/80" : "text-black/70"}`}
              >
                or continue with
              </Text>
              <View
                className={`flex-1 h-[1px] ${isDark ? "bg-white/20" : "bg-black/20"}`}
              />
            </View>

            {/* Social Login Buttons */}
            <View className="flex-row mb-4" style={{ gap: 12 }}>
              {Platform.OS === "ios" && appleAuthAvailable && (
                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  className={`flex-row items-center justify-center h-14 rounded-lg ${
                    isAppleLoading ? "opacity-50" : ""
                  }`}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    backgroundColor: isDark ? "#1a1a1a" : "#000",
                    borderWidth: 1.5,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(255,255,255,0.2)",
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={24} color="#fff" />
                      <Text className="ml-2 font-semibold text-white text-base">
                        Apple
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                className={`flex-row items-center justify-center h-14 rounded-lg ${
                  isGoogleLoading ? "opacity-50" : ""
                }`}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  minWidth:
                    Platform.OS === "ios" && appleAuthAvailable
                      ? 120
                      : undefined,
                  backgroundColor: isDark ? "#1a1a1a" : "#000",
                  borderWidth: 1.5,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(255,255,255,0.2)",
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={24} color="#fff" />
                    <Text className="ml-2 font-semibold text-white text-base">
                      Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Guest Option */}
            <TouchableOpacity
              onPress={handleContinueAsGuest}
              disabled={isLoading}
              className="items-center justify-center h-14 rounded-lg"
              activeOpacity={0.7}
              style={{
                backgroundColor: "#000",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              {isGuestLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="font-medium text-white">Browse as Guest</Text>
              )}
            </TouchableOpacity>

            {/* Terms */}
            <Text
              className={`text-center text-xs mt-6 leading-relaxed ${isDark ? "text-white/70" : "text-black/60"}`}
            >
              By continuing, you agree to our{"\n"}
              Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
