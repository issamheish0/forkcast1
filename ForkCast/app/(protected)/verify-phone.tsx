import React, { useState, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Phone, AlertCircle } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { usePhoneVerification } from "@/hooks/usePhoneVerification";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  InternationalPhoneInput,
  isValidPhoneNumber,
  type ICountry,
} from "@/components/ui/international-phone-input";
import { getCountryByPhoneNumber } from "react-native-international-phone-number";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";
import type { ICountryCca2 } from "react-native-country-select";

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { sendCode, verifyCode, clearError, loading, error } =
    usePhoneVerification();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phone input state — allows entering/changing phone number
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  // The E.164 number that was sent an OTP (locked during OTP step)
  const [sentPhoneE164, setSentPhoneE164] = useState("");

  // Initialize phone input from profile if available
  React.useEffect(() => {
    const initial = profile?.phone_number?.trim() || "";
    if (initial) {
      const country = getCountryByPhoneNumber(initial);
      const parsed = parsePhoneNumberFromString(initial);
      if (country) setSelectedCountry(country);
      if (parsed) setPhoneNumber(parsed.nationalNumber || "");
    } else {
      // Default to Lebanon
      const defaultCountry = getCountryByPhoneNumber("+961");
      setSelectedCountry(defaultCountry ?? null);
      setPhoneNumber("");
    }
  }, [profile?.phone_number]);

  // Build E.164 from phone input
  const getPhoneE164 = useCallback((): string => {
    if (!selectedCountry || !phoneNumber.trim()) return "";
    const national = phoneNumber.replace(/^0+/, "").replace(/\s/g, "");
    const parsed = parsePhoneNumberFromString(
      national,
      selectedCountry.cca2 as CountryCode,
    );
    return parsed?.format("E.164") ?? "";
  }, [selectedCountry, phoneNumber]);

  const currentPhoneE164 = getPhoneE164();
  const hasValidPhone =
    currentPhoneE164.startsWith("+") &&
    selectedCountry != null &&
    isValidPhoneNumber(phoneNumber, selectedCountry);

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

  const handleSendCode = useCallback(async () => {
    if (!hasValidPhone) return;
    const result = await sendCode(currentPhoneE164);
    if (result.success) {
      setSentPhoneE164(currentPhoneE164);
      setStep("otp");
      setOtp("");
      setResendCooldown(60);
    }
  }, [currentPhoneE164, hasValidPhone, sendCode]);

  const handleVerify = useCallback(async () => {
    if (!sentPhoneE164 || otp.length !== 6) return;
    // verifyCode already calls refreshProfile() on success internally
    const result = await verifyCode(otp, sentPhoneE164);
    if (result.success) {
      router.back();
    } else if (result.needsResend) {
      // OTP was consumed but downstream failed — go back to send step
      setStep("phone");
      setOtp("");
      setSentPhoneE164("");
      setResendCooldown(0);
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    }
  }, [sentPhoneE164, otp, verifyCode, router]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !sentPhoneE164) return;
    const result = await sendCode(sentPhoneE164);
    if (result.success) {
      setOtp("");
      setResendCooldown(60);
    }
  }, [sentPhoneE164, sendCode, resendCooldown]);

  const handleChangeNumber = useCallback(() => {
    setStep("phone");
    setOtp("");
    setSentPhoneE164("");
    setResendCooldown(0);
    clearError();
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, [clearError]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="p-4 flex-1">
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#fff" : "#000"}
            />
          </Pressable>
          <H1 className="text-foreground">
            {step === "phone" ? "Verify Phone" : "Enter Code"}
          </H1>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center">
              <Phone size={40} color="#792339" />
            </View>
          </View>

          {step === "phone" ? (
            <>
              <P className="text-muted-foreground mb-4 text-center">
                Enter your phone number to receive a verification code via
                WhatsApp.
              </P>
              <View className="mb-4">
                <InternationalPhoneInput
                  value={phoneNumber}
                  onChangePhoneNumber={setPhoneNumber}
                  selectedCountry={selectedCountry}
                  onChangeSelectedCountry={setSelectedCountry}
                  label="Phone number"
                  defaultCountry={"LB" as ICountryCca2}
                  disabled={loading}
                  error={error || undefined}
                />
              </View>
              {error && (
                <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg mb-4">
                  <AlertCircle size={18} color="#ef4444" />
                  <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </Text>
                </View>
              )}
              <Button
                onPress={handleSendCode}
                disabled={loading || !hasValidPhone}
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text>Send verification code</Text>
                )}
              </Button>
            </>
          ) : (
            <>
              <View className="bg-muted rounded-lg p-3 mb-4">
                <Text className="text-center text-sm text-muted-foreground">
                  Code sent to
                </Text>
                <Text className="text-center font-medium text-foreground text-base mt-1">
                  {sentPhoneE164}
                </Text>
              </View>
              <Text className="text-sm font-medium mb-2 text-foreground">
                Verification code
              </Text>
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={isDark ? "#666" : "#999"}
                keyboardType="number-pad"
                maxLength={6}
                className="py-4 px-4 bg-muted border-2 border-input rounded-lg text-foreground text-center text-2xl tracking-widest mb-4"
                editable={!loading}
                autoFocus
                accessibilityLabel="Verification code"
                accessibilityHint="Enter the 6-digit code sent to your phone"
              />
              {error && (
                <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg mb-4">
                  <AlertCircle size={18} color="#ef4444" />
                  <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={handleResend}
                disabled={loading || resendCooldown > 0}
                className="mb-6"
              >
                <Text
                  className={`text-center text-sm ${
                    resendCooldown > 0
                      ? "text-muted-foreground"
                      : "text-primary"
                  }`}
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
                </Text>
              </Pressable>
              <Button
                onPress={handleVerify}
                disabled={loading || otp.length !== 6}
                size="lg"
                className="w-full mb-3"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text>Verify & continue</Text>
                )}
              </Button>
              <Button
                onPress={handleChangeNumber}
                variant="ghost"
                size="lg"
                disabled={loading}
              >
                <Text>Change number</Text>
              </Button>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
