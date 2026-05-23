import React, { useState, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TextInput,
  findNodeHandle,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Phone,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
} from "lucide-react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { usePhoneVerification } from "@/hooks/usePhoneVerification";
import { shouldShowPhoneVerificationUI } from "@/config/features";
import {
  InternationalPhoneInput,
  isValidPhoneNumber,
  type ICountry,
} from "@/components/ui/international-phone-input";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";

// Utility function to format date input with automatic dashes (DD-MM-YYYY)
const formatDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
  }
};

// Utility function to convert DD-MM-YYYY to YYYY-MM-DD for database storage
const convertToDbFormat = (dateString: string): string => {
  const ddMmYyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateString.match(ddMmYyyyRegex);

  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return dateString;
};

// Utility function to convert YYYY-MM-DD to DD-MM-YYYY for display
const convertToDisplayFormat = (dateString: string): string => {
  const yyyyMmDdRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(yyyyMmDdRegex);

  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }

  return dateString;
};

// Utility function to validate date format
const isValidDateFormat = (dateString: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    dateString === date.toISOString().split("T")[0]
  );
};

// Form validation schema
const completeProfileSchema = z.object({
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(25, "First name must be less than 25 characters")
    .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid first name"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(25, "Last name must be less than 25 characters")
    .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid last name"),
  phone_number: z.string().min(1, "Phone number is required"),
  date_of_birth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((date) => {
      const ddMmYyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      return ddMmYyyyRegex.test(date);
    }, "Please enter a valid date in DD-MM-YYYY format")
    .refine((date) => {
      const dbFormat = convertToDbFormat(date);
      return isValidDateFormat(dbFormat);
    }, "Please enter a valid date")
    .refine((date) => {
      const dbFormat = convertToDbFormat(date);
      const parsedDate = new Date(dbFormat);
      const today = new Date();
      const age = today.getFullYear() - parsedDate.getFullYear();
      const monthDiff = today.getMonth() - parsedDate.getMonth();
      const dayDiff = today.getDate() - parsedDate.getDate();

      return (
        age > 13 ||
        (age === 13 && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)))
      );
    }, "You must be at least 13 years old")
    .refine((date) => {
      const dbFormat = convertToDbFormat(date);
      const parsedDate = new Date(dbFormat);
      const today = new Date();
      return parsedDate <= today;
    }, "Date of birth cannot be in the future"),
});

type CompleteProfileFormData = z.infer<typeof completeProfileSchema>;

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, user, refreshProfile, setPostAuthNavigation } = useAuth();
  const { colorScheme } = useColorScheme();
  const themed = getThemedColors(colorScheme);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhoneCountry, setSelectedPhoneCountry] =
    useState<ICountry | null>(null);
  const [verificationStep, setVerificationStep] = useState<"form" | "verify">(
    "form",
  );
  const [savedPhoneE164, setSavedPhoneE164] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isDobFocused, setIsDobFocused] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    sendCode,
    verifyCode,
    clearError,
    loading: verifyLoading,
    error: verifyError,
  } = usePhoneVerification();

  // Refs for input navigation
  const lastNameRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const dobContainerRef = useRef<View>(null);

  const scrollToDobInput = useCallback(() => {
    if (!dobContainerRef.current || !scrollViewRef.current) return;

    const scrollViewNode = findNodeHandle(scrollViewRef.current);
    if (!scrollViewNode) return;

    dobContainerRef.current.measureLayout(
      scrollViewNode,
      (_x: number, y: number) => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 120),
          animated: true,
        });
      },
      () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      },
    );
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      if (!isDobFocused) return;
      setTimeout(scrollToDobInput, 60);
    });

    return () => {
      subscription.remove();
    };
  }, [isDobFocused, scrollToDobInput]);

  React.useEffect(() => {
    if (resendCooldown > 0) {
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendTimerRef.current) {
              clearInterval(resendTimerRef.current);
              resendTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [resendCooldown]);

  // Split name helper
  const splitName = useCallback((fullName: string) => {
    const nameParts = (fullName || "").trim().split(/\s+/);
    return {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
    };
  }, []);

  // Get best available name from user metadata or profile
  const getBestAvailableName = useCallback(() => {
    if (user?.user_metadata) {
      const appleName = user.user_metadata.full_name || user.user_metadata.name;
      if (appleName && appleName !== "User") {
        return appleName;
      }
    }
    if (profile?.full_name && profile.full_name !== "User") {
      return profile.full_name;
    }
    return "";
  }, [user, profile]);

  // Get default values for the form
  const getDefaultValues = useCallback((): CompleteProfileFormData => {
    const bestName = getBestAvailableName();
    const { first_name, last_name } = splitName(bestName);

    return {
      first_name:
        profile?.first_name && profile.first_name !== "User"
          ? profile.first_name
          : first_name !== "User"
            ? first_name
            : "",
      last_name: profile?.last_name || last_name || "",
      phone_number: profile?.phone_number || "",
      date_of_birth: profile?.date_of_birth
        ? convertToDisplayFormat(profile.date_of_birth)
        : "",
    };
  }, [profile, getBestAvailableName, splitName]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset,
  } = useForm<CompleteProfileFormData>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: getDefaultValues(),
    mode: "onChange",
  });

  // Refresh profile on mount so we have latest from DB (e.g. after sign-up redirect)
  React.useEffect(() => {
    if (profile?.id) {
      refreshProfile();
    }
  }, [profile?.id, refreshProfile]);

  // When profile loads with data, reset form so phone/DOB etc. are visible (fixes empty fields when DB has data)
  React.useEffect(() => {
    if (
      profile?.first_name != null ||
      profile?.last_name != null ||
      profile?.phone_number != null ||
      profile?.date_of_birth != null
    ) {
      reset(getDefaultValues());
    }
  }, [
    profile?.first_name,
    profile?.last_name,
    profile?.phone_number,
    profile?.date_of_birth,
    reset,
  ]);

  // Watch form values to check completion status
  const watchedValues = watch();

  // Check if all required fields are filled (basic check for button state)
  const isFormFilled =
    watchedValues.first_name?.trim() &&
    watchedValues.last_name?.trim() &&
    watchedValues.phone_number?.trim() &&
    watchedValues.date_of_birth?.trim();

  const onSubmit = async (data: CompleteProfileFormData) => {
    Keyboard.dismiss();

    // Validate phone number
    if (!selectedPhoneCountry) {
      Alert.alert("Country Required", "Please select your country code.", [
        { text: "OK" },
      ]);
      return;
    }

    if (!isValidPhoneNumber(data.phone_number, selectedPhoneCountry)) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid phone number for the selected country.",
        [{ text: "OK" }],
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Format phone number with country code using libphonenumber-js
      const national = data.phone_number.replace(/^0+/, "").replace(/\s/g, "");
      const parsed = parsePhoneNumberFromString(
        national,
        selectedPhoneCountry.cca2 as CountryCode,
      );
      const phoneE164 = parsed?.format("E.164") ?? "";

      if (!phoneE164) {
        Alert.alert(
          "Invalid Phone Number",
          "Could not format your phone number. Please check and try again.",
          [{ text: "OK" }],
        );
        return;
      }

      const updateData = {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        full_name: `${data.first_name.trim()} ${data.last_name.trim()}`.trim(),
        phone_number: phoneE164,
        date_of_birth: convertToDbFormat(data.date_of_birth),
      };

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile?.id);

      if (error) {
        // Handle phone number uniqueness error
        if (error.code === "23505" && error.message?.includes("phone")) {
          Alert.alert(
            "Phone Number Already Exists",
            "An account already exists with this phone number. Please use a different phone number.",
            [{ text: "OK" }],
          );
          return;
        }
        throw error;
      }

      // Update local profile state
      await updateProfile(updateData);

      if (shouldShowPhoneVerificationUI()) {
        setSavedPhoneE164(phoneE164);
        setVerificationStep("verify");
        setOtp("");
        setResendCooldown(0);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
        router.replace("/onboarding");
      }
    } catch (error: any) {
      console.error("Error completing profile:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to complete your profile. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendVerificationCode = useCallback(async () => {
    if (!savedPhoneE164) return;
    const result = await sendCode(savedPhoneE164);
    if (result.success) setResendCooldown(60);
  }, [savedPhoneE164, sendCode]);

  const handleVerifyAndContinue = useCallback(async () => {
    if (!savedPhoneE164 || otp.length !== 6) return;
    // Tell the auth provider to navigate to onboarding (not home) if the
    // phone_change verifyOtp fires a new session via onAuthStateChange.
    setPostAuthNavigation("/onboarding");
    // verifyCode already calls refreshProfile() on success internally
    const result = await verifyCode(otp, savedPhoneE164);
    if (result.success) {
      router.replace("/onboarding");
    } else if (result.needsResend) {
      // OTP was consumed but downstream failed — user must send a new code
      setOtp("");
      setResendCooldown(0);
      clearError();
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    }
  }, [savedPhoneE164, otp, verifyCode, router, clearError, setPostAuthNavigation]);

  const handleResendCode = useCallback(async () => {
    if (resendCooldown > 0 || !savedPhoneE164) return;
    const result = await sendCode(savedPhoneE164);
    if (result.success) {
      setOtp("");
      setResendCooldown(60);
    }
  }, [savedPhoneE164, sendCode, resendCooldown]);

  if (
    shouldShowPhoneVerificationUI() &&
    verificationStep === "verify" &&
    savedPhoneE164
  ) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="pt-8 pb-8">
              <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-6 self-center">
                <Phone size={40} color="#792339" />
              </View>
              <H1 className="text-center mb-2">Verify Your Phone</H1>
              <P className="text-center text-muted-foreground mb-4">
                Tap the button below to send a 6-digit code to your number via
                WhatsApp. Then enter the code you receive.
              </P>
              <View className="bg-muted rounded-lg p-4 mb-4">
                <Text className="text-center font-medium text-foreground">
                  {savedPhoneE164}
                </Text>
              </View>
              <Button
                onPress={handleSendVerificationCode}
                disabled={verifyLoading || resendCooldown > 0}
                size="lg"
                variant="default"
                className="mb-6"
              >
                <Text>
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Send verification code"}
                </Text>
              </Button>
              <Text className="text-sm font-medium mb-2 text-foreground">
                Verification code
              </Text>
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={themed.mutedForeground}
                keyboardType="number-pad"
                maxLength={6}
                className="py-4 px-4 bg-muted border-2 border-input rounded-lg text-foreground text-center text-xl tracking-widest mb-4"
                editable={!verifyLoading}
                accessibilityLabel="Verification code"
                accessibilityHint="Enter the 6-digit code sent to your phone"
              />
              {verifyError && (
                <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg mb-4">
                  <AlertTriangle size={18} color="#ef4444" />
                  <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                    {verifyError}
                  </Text>
                </View>
              )}
              <Button
                onPress={handleVerifyAndContinue}
                disabled={verifyLoading || otp.length !== 6}
                size="lg"
                className="w-full mb-3"
              >
                <Text>
                  {verifyLoading ? "Verifying..." : "Verify & continue"}
                </Text>
              </Button>
              <Button
                onPress={() => {
                  setVerificationStep("form");
                  setSavedPhoneE164(null);
                  setOtp("");
                }}
                variant="outline"
                size="lg"
                disabled={verifyLoading}
              >
                <Text>Change number</Text>
              </Button>
              <Button
                onPress={() => {
                  Alert.alert(
                    "Skip Verification?",
                    "You can verify your phone later from your profile. Phone verification is required before making bookings.",
                    [
                      { text: "Stay", style: "cancel" },
                      {
                        text: "Skip for Now",
                        onPress: () => router.replace("/onboarding"),
                      },
                    ],
                  );
                }}
                variant="ghost"
                size="lg"
                disabled={verifyLoading}
              >
                <Text className="text-muted-foreground">Skip for now</Text>
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 px-6 py-8">
              {/* Header */}
              <Animated.View
                entering={FadeInDown.duration(500).delay(100)}
                className="mb-8"
              >
                <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-6 self-center">
                  <User size={40} color="#792339" />
                </View>
                <H1 className="text-center mb-3">Complete Your Profile</H1>
                <P className="text-center text-muted-foreground">
                  We need a few details to personalize your experience and
                  enable all features.
                </P>
              </Animated.View>

              {/* Form Fields */}
              <Animated.View
                entering={FadeInDown.duration(500).delay(200)}
                className="gap-5"
              >
                {/* Name Section */}
                <View className="gap-4">
                  <View className="flex-row items-center gap-2 mb-1">
                    <User size={18} color={themed.mutedForeground} />
                    <Text className="text-sm font-medium text-muted-foreground">
                      Your Name
                    </Text>
                  </View>

                  {/* First Name */}
                  <Controller
                    control={control}
                    name="first_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View>
                        <Label className="mb-2">First Name</Label>
                        <Input
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="John"
                          autoCapitalize="words"
                          autoCorrect={false}
                          autoComplete="given-name"
                          returnKeyType="next"
                          onSubmitEditing={() => lastNameRef.current?.focus()}
                          className={errors.first_name ? "border-red-500" : ""}
                        />
                        {errors.first_name && (
                          <Text className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {errors.first_name.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />

                  {/* Last Name */}
                  <Controller
                    control={control}
                    name="last_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View>
                        <Label className="mb-2">Last Name</Label>
                        <Input
                          ref={lastNameRef}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="Doe"
                          autoCapitalize="words"
                          autoCorrect={false}
                          autoComplete="family-name"
                          returnKeyType="next"
                          className={errors.last_name ? "border-red-500" : ""}
                        />
                        {errors.last_name && (
                          <Text className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {errors.last_name.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />
                </View>

                {/* Divider */}
                <View className="h-px bg-border my-2" />

                {/* Phone Number Section */}
                <View>
                  <View className="flex-row items-center gap-2 mb-3">
                    <Phone size={18} color={themed.mutedForeground} />
                    <Text className="text-sm font-medium text-muted-foreground">
                      Phone Number
                    </Text>
                  </View>

                  <Controller
                    control={control}
                    name="phone_number"
                    render={({ field: { onChange, value } }) => (
                      <InternationalPhoneInput
                        value={value}
                        onChangePhoneNumber={onChange}
                        selectedCountry={selectedPhoneCountry}
                        onChangeSelectedCountry={setSelectedPhoneCountry}
                        label=""
                        description="Required for booking confirmations"
                        defaultCountry="LB"
                        error={errors.phone_number?.message}
                      />
                    )}
                  />
                </View>

                {/* Divider */}
                <View className="h-px bg-border my-2" />

                {/* Date of Birth Section */}
                <View>
                  <View className="flex-row items-center gap-2 mb-3">
                    <Calendar size={18} color={themed.mutedForeground} />
                    <Text className="text-sm font-medium text-muted-foreground">
                      Date of Birth
                    </Text>
                  </View>

                  {/* Warning Box */}
                  <View className="flex-row items-start bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg mb-4 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle
                      size={18}
                      color="#d97706"
                      style={{ marginRight: 10, marginTop: 2 }}
                    />
                    <View className="flex-1">
                      <Text className="font-medium text-amber-700 dark:text-amber-300 text-sm">
                        One-Time Setting
                      </Text>
                      <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Your date of birth can only be set once for security
                        purposes.
                      </Text>
                    </View>
                  </View>

                  <Controller
                    control={control}
                    name="date_of_birth"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View ref={dobContainerRef}>
                        <Input
                          ref={dobRef}
                          value={value}
                          onChangeText={(text) => {
                            const formatted = formatDateInput(text);
                            onChange(formatted);
                          }}
                          onBlur={() => {
                            setIsDobFocused(false);
                            onBlur();
                          }}
                          onFocus={() => {
                            setIsDobFocused(true);
                            setTimeout(scrollToDobInput, 180);
                          }}
                          placeholder="DD-MM-YYYY"
                          keyboardType="numeric"
                          maxLength={10}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          className={
                            errors.date_of_birth ? "border-red-500" : ""
                          }
                        />
                        <Text className="text-xs text-muted-foreground mt-1">
                          Enter your birth day, month, and year (dashes added
                          automatically)
                        </Text>
                        {errors.date_of_birth && (
                          <Text className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {errors.date_of_birth.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />

                  {/* Security Note */}
                  <View className="flex-row items-center mt-3">
                    <Shield
                      size={14}
                      color="#16a34a"
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-xs text-muted-foreground flex-1">
                      Used for age verification at certain venues
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Spacer */}
              <View className="flex-1 min-h-8" />

              {/* Submit Button */}
              <Animated.View
                entering={FadeInUp.duration(500).delay(300)}
                className="pt-4"
              >
                <Button
                  onPress={handleSubmit(onSubmit)}
                  disabled={isSubmitting || !isFormFilled}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle
                    size={18}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-semibold text-base">
                    {isSubmitting ? "Saving..." : "Complete Profile"}
                  </Text>
                </Button>

                <Muted className="text-center mt-4">
                  All fields are required to continue
                </Muted>
              </Animated.View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
