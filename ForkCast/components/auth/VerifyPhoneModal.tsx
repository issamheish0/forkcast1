import React, { useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { X, Phone, AlertCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { usePhoneVerification } from "@/hooks/usePhoneVerification";
import { shouldShowPhoneVerificationUI } from "@/config/features";
import { InternationalPhoneInput } from "@/components/ui/international-phone-input";
import {
  getCountryByPhoneNumber,
  type ICountry,
} from "react-native-international-phone-number";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";
import type { ICountryCca2 } from "react-native-country-select";

export interface VerifyPhoneModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified?: () => void;
  showSkip?: boolean;
  /** Pre-filled E.164 phone (e.g. from profile) */
  initialPhoneE164: string | null | undefined;
}

export function VerifyPhoneModal({
  visible,
  onClose,
  onVerified,
  showSkip = true,
  initialPhoneE164,
}: VerifyPhoneModalProps) {
  const { colorScheme } = useColorScheme();
  const { sendCode, verifyCode, clearError, loading, error } =
    usePhoneVerification();

  const [step, setStep] = useState<"send" | "otp">("send");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  // Lock the phone number that was sent the OTP — use this for verify/resend
  const [sentPhoneE164, setSentPhoneE164] = useState("");
  const resendTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const getPhoneE164 = useCallback((): string => {
    const countryCode = (selectedCountry?.cca2 ?? "LB") as CountryCode;
    if (!phoneNumber.trim()) return "";
    const national = phoneNumber.replace(/^0+/, "").replace(/\s/g, "");
    const parsed = parsePhoneNumberFromString(national, countryCode);
    return parsed?.format("E.164") ?? "";
  }, [selectedCountry, phoneNumber]);

  const currentPhoneE164 = getPhoneE164();
  const hasValidPhone = currentPhoneE164.startsWith("+");

  useEffect(() => {
    if (!visible) {
      setStep("send");
      setOtp("");
      setResendCooldown(0);
      setSentPhoneE164("");
      return;
    }
    const initial = initialPhoneE164?.trim() || "";
    if (initial) {
      const country = getCountryByPhoneNumber(initial);
      const parsed = parsePhoneNumberFromString(initial);
      if (country) setSelectedCountry(country);
      if (parsed) setPhoneNumber(parsed.nationalNumber || "");
    } else {
      // Default to Lebanon (LB)
      const defaultCountry = getCountryByPhoneNumber("+961");
      if (defaultCountry) {
        setSelectedCountry(defaultCountry);
      } else {
        setSelectedCountry({ cca2: "LB", flag: "🇱🇧", name: { en: "Lebanon" }, callingCode: "961" } as any);
      }
      setPhoneNumber("");
    }
  }, [visible, initialPhoneE164]);

  const isDark = colorScheme === "dark";

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
      onVerified?.();
      onClose();
    } else if (result.needsResend) {
      // OTP was consumed but downstream failed — go back to send step
      setStep("send");
      setOtp("");
      setSentPhoneE164("");
      setResendCooldown(0);
    }
  }, [sentPhoneE164, otp, verifyCode, onVerified, onClose]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !sentPhoneE164) return;
    const result = await sendCode(sentPhoneE164);
    if (result.success) {
      setOtp("");
      setResendCooldown(60);
    }
  }, [sentPhoneE164, sendCode, resendCooldown]);

  if (!shouldShowPhoneVerificationUI()) return null;

  const otpStepContent = (
    <>
      <View className="bg-muted rounded-lg p-3 mb-2">
        <Text className="text-center text-sm text-muted-foreground">
          Code sent to {sentPhoneE164}
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
        className="py-4 px-4 bg-muted border-2 border-input rounded-lg text-foreground text-center text-xl tracking-widest mb-4"
        editable={!loading}
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
        className="mb-4"
      >
        <Text
          className={`text-center text-sm ${
            resendCooldown > 0 ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend code"}
        </Text>
      </Pressable>
      <View className="gap-3 pb-8">
        <Button
          onPress={handleVerify}
          disabled={loading || otp.length !== 6}
          size="lg"
          variant="default"
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text>Verify & continue</Text>
          )}
        </Button>
        <Button
          onPress={() => {
            setStep("send");
            setSentPhoneE164("");
            clearError();
          }}
          variant="ghost"
          size="lg"
          disabled={loading}
        >
          <Text>Change number</Text>
        </Button>
      </View>
    </>
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={onClose} />
          <View
            className="bg-background rounded-t-3xl p-6 pb-8 max-h-[85%]"
            style={{ paddingBottom: 32 }}
          >
            <TouchableOpacity
              onPress={onClose}
              className="absolute right-4 top-4 p-2 z-10"
            >
              <X size={24} color={isDark ? "#fff" : "#000"} />
            </TouchableOpacity>

            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center">
                <Phone size={32} color="#792339" />
              </View>
            </View>

            <H3 className="text-center mb-2">Verify Your Phone</H3>
            <P className="text-center text-muted-foreground mb-4">
              Restaurants may need to reach you. Verify your number to unlock
              booking.
            </P>

            {step === "send" ? (
              <>
                <View className="mb-4">
                  <InternationalPhoneInput
                    value={phoneNumber}
                    onChangePhoneNumber={setPhoneNumber}
                    selectedCountry={selectedCountry}
                    onChangeSelectedCountry={setSelectedCountry}
                    label="Phone number"
                    description="Tap the button below to send a 6-digit code to this number via WhatsApp."
                    defaultCountry={"LB" as ICountryCca2}
                    disabled={loading}
                    error={error || undefined}
                  />
                </View>
                <P className="text-center text-muted-foreground mb-3 text-sm">
                  You must tap the button to receive the code.
                </P>
                <View className="gap-3">
                  <Button
                    onPress={handleSendCode}
                    disabled={loading || !hasValidPhone}
                    size="lg"
                    variant="default"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text>Send verification code</Text>
                    )}
                  </Button>
                  {showSkip && (
                    <Button onPress={onClose} variant="outline" size="lg">
                      <Text>Skip for now</Text>
                    </Button>
                  )}
                </View>
              </>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
              >
                {otpStepContent}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
