import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  View,
  Alert,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import * as z from "zod";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";

import { SafeAreaView } from "@/components/safe-area-view";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useNetwork } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { mapAuthError, isProviderCancellation } from "@/lib/authErrors";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(64, "Please enter fewer than 64 characters."),
});

export default function SignIn() {
  const { signIn, appleSignIn, googleSignIn } = useAuth();
  const { isOffline, hasInitialized: networkReady } = useNetwork();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === "dark";

  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check if Apple Authentication is available
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

  async function onSubmit(data: z.infer<typeof formSchema>) {
    // Offline pre-check: avoids a confusing low-level fetch failure if the
    // user submits with no connectivity. Only enforce once NetInfo has had
    // a chance to initialize (otherwise we may block on first render).
    if (networkReady && isOffline) {
      Alert.alert(
        "No internet connection",
        "You appear to be offline. Connect to the internet and try again.",
      );
      return;
    }

    try {
      setIsEmailLoading(true);
      await signIn(data.email, data.password);
      router.replace("/(protected)/(tabs)");
      form.reset();
    } catch (error: unknown) {
      const mapped = mapAuthError(error);
      Alert.alert(mapped.title, mapped.message, [
        { text: "OK", style: "default" },
      ]);
    } finally {
      setIsEmailLoading(false);
    }
  }

  const handleAppleSignIn = async () => {
    if (networkReady && isOffline) {
      Alert.alert(
        "No internet connection",
        "You appear to be offline. Connect to the internet and try again.",
      );
      return;
    }
    try {
      setIsAppleLoading(true);
      const { error } = await appleSignIn();
      if (error && !isProviderCancellation(error)) {
        const mapped = mapAuthError(error);
        Alert.alert(mapped.title, mapped.message);
      }
    } catch (err: unknown) {
      if (isProviderCancellation(err)) return;
      const mapped = mapAuthError(err);
      Alert.alert(mapped.title, mapped.message);
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (networkReady && isOffline) {
      Alert.alert(
        "No internet connection",
        "You appear to be offline. Connect to the internet and try again.",
      );
      return;
    }
    try {
      setIsGoogleLoading(true);
      const { error } = await googleSignIn();
      if (error && !isProviderCancellation(error)) {
        const mapped = mapAuthError(error);
        Alert.alert(mapped.title, mapped.message);
      }
    } catch (err: unknown) {
      if (isProviderCancellation(err)) return;
      const mapped = mapAuthError(err);
      Alert.alert(mapped.title, mapped.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isLoading = isEmailLoading || isAppleLoading || isGoogleLoading;

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={["top", "bottom"]}>
      {/* Fixed Header */}
      <View className="p-4 pb-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
          <View className="flex-1">
            <H1 className="self-start text-white">Welcome Back</H1>
            <P className="text-white/90 mt-2">
              Sign in to discover and book amazing restaurants
            </P>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 gap-4">
          {/* Email/Password Form */}
          <Form {...form}>
            <View className="gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormInput
                    label="Email"
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    className="bg-gray-100 dark:bg-gray-800 py-2"
                    {...field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <View className="relative">
                    <FormInput
                      label="Password"
                      placeholder="Enter your password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showPassword}
                      className="bg-gray-100 dark:bg-gray-800 py-2"
                      {...field}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={20}
                        color={isDark ? "#9CA3AF" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              />
              <TouchableOpacity
                onPress={() => router.push("/forgot-password")}
                className="mt-2 self-end"
              >
                <Text className="text-white/80 font-medium">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>
          </Form>

          {/* Sign In Button */}
          <TouchableOpacity
            onPress={form.handleSubmit(onSubmit)}
            disabled={isLoading}
            className={`h-14 rounded-lg mt-6 items-center justify-center ${
              isLoading ? "opacity-50" : ""
            }`}
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
            {isEmailLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-medium text-white">Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Social Sign In Section */}
          <View className="items-center mt-4">
            <View className="flex-row items-center w-full mb-4">
              <View className="flex-1 h-px bg-white/20" />
              <Text className="mx-4 text-sm text-white/80">
                or continue with
              </Text>
              <View className="flex-1 h-px bg-white/20" />
            </View>

            <View className="flex-row gap-3 w-full">
              {/* Phone Sign In */}
              <TouchableOpacity
                onPress={() => router.push("/phone-sign-in")}
                disabled={isLoading}
                className="flex-1"
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
                <View className="rounded-md h-12 items-center justify-center flex-row gap-2">
                  <Ionicons name="call-outline" size={20} color="#fff" />
                  <Text className="text-white font-medium">Phone</Text>
                </View>
              </TouchableOpacity>

              {/* Apple Sign In Button */}
              {Platform.OS === "ios" && appleAuthAvailable && (
                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  className="flex-1"
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
                  <View className="rounded-md h-12 items-center justify-center flex-row gap-2">
                    {isAppleLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={20} color="#fff" />
                        <Text className="text-white font-medium">Apple</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {/* Google Sign In Button */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                className="flex-1"
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
                <View className="rounded-md h-12 items-center justify-center flex-row gap-2">
                  {isGoogleLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#fff" />
                      <Text className="text-white font-medium">Google</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row items-center gap-2 justify-center mt-6">
            <Text className="text-white/80">Don&apos;t have an account?</Text>
            <Text
              className="text-white font-medium"
              onPress={() => router.replace("/sign-up")}
            >
              Sign Up
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
