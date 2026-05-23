import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
} from "react-native";
import { Phone, AlertCircle, X } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { BackHeader } from "@/components/ui/back-header";
import { H2, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { sendOTP, verifyOTP } from "@/hooks/usePhoneVerification";
import {
  InternationalPhoneInput,
  isValidPhoneNumber,
  type ICountry,
} from "@/components/ui/international-phone-input";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";

interface PhoneVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
  title?: string;
  description?: string;
  initialPhoneNumber?: string; // Pre-fill phone number if available
}

export function PhoneVerificationModal({
  visible,
  onClose,
  onVerified,
  onSkip,
  canSkip = true,
  title = "Verify Your Phone",
  description = "We need to verify your phone number to enable booking features.",
  initialPhoneNumber,
}: PhoneVerificationModalProps) {
  const { colorScheme } = useColorScheme();

  // Step 1: Phone entry, Step 2: OTP verification
  const [step, setStep] = useState<"phone" | "otp">("phone");

  // Phone number state
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Resend cooldown state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate E.164 format phone number using libphonenumber-js for correctness
  const phoneE164 = React.useMemo((): string => {
    if (!selectedCountry || !phoneNumber.trim()) return "";
    const national = phoneNumber.replace(/^0+/, "").replace(/\s/g, "");
    const parsed = parsePhoneNumberFromString(
      national,
      selectedCountry.cca2 as CountryCode,
    );
    return parsed?.format("E.164") ?? "";
  }, [selectedCountry, phoneNumber]);

  const handleSendOTP = useCallback(
    async (isResend = false) => {
      if (!phoneNumber || phoneNumber.length < 6) {
        setError("Please enter a valid phone number");
        return;
      }

      // Validate phone number with selected country
      if (!selectedCountry) {
        setError("Please select your country code");
        return;
      }

      if (!isValidPhoneNumber(phoneNumber, selectedCountry)) {
        setError("Please enter a valid phone number for the selected country");
        return;
      }

      // Check cooldown for resend
      if (isResend && resendCooldown > 0) {
        setError(`Please wait ${resendCooldown} seconds before resending`);
        return;
      }

      if (isResend) {
        setIsResending(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const result = await sendOTP(phoneE164);

        if (result.success) {
          if (!isResend) {
            setStep("otp");
          } else {
            // Clear OTP input on resend
            setOtpCode("");
          }

          // Start cooldown timer (60 seconds)
          setResendCooldown(60);

          Alert.alert(
            isResend ? "Code Resent" : "Code Sent",
            `A verification code has been sent to ${phoneE164}`,
            [{ text: "OK" }],
          );
        } else {
          setError(result.error || "Failed to send verification code");
        }
      } catch (err: any) {
        setError(err.message || "Failed to send verification code");
      } finally {
        if (isResend) {
          setIsResending(false);
        } else {
          setLoading(false);
        }
      }
    },
    [phoneNumber, phoneE164, resendCooldown, selectedCountry],
  );

  const handleVerifyOTP = useCallback(async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await verifyOTP(otpCode, phoneE164);

      if (result.success) {
        // Reset state immediately
        setStep("phone");
        setPhoneNumber("");
        setOtpCode("");
        setError("");

        Alert.alert(
          "Success!",
          "Your phone number has been verified successfully.",
          [
            {
              text: "OK",
              onPress: () => {
                onClose(); // Direct close without confirmation
                onVerified();
              },
            },
          ],
        );
      } else {
        setError(result.error || "Invalid verification code");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  }, [otpCode, phoneE164, onVerified, onClose]);

  const handleClose = useCallback(() => {
    // Clear cooldown timer
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    // If verification is mandatory and user tries to leave, show confirmation
    if (!canSkip) {
      Alert.alert(
        "Exit Verification?",
        "You'll need to verify your phone number to make bookings. You can complete this later from your profile.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Exit",
            onPress: () => {
              setStep("phone");
              setPhoneNumber("");
              setOtpCode("");
              setError("");
              setResendCooldown(0);
              onClose();
            },
          },
        ],
      );
      return;
    }

    // Can skip - close immediately
    setStep("phone");
    setPhoneNumber("");
    setOtpCode("");
    setError("");
    setResendCooldown(0);
    onClose();
  }, [onClose, canSkip]);

  const handleSkip = useCallback(() => {
    handleClose();
    onSkip?.();
  }, [handleClose, onSkip]);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [resendCooldown]);

  // Reset cooldown when modal closes
  useEffect(() => {
    if (!visible) {
      setResendCooldown(0);
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={canSkip ? handleClose : undefined}
    >
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {canSkip ? (
            <BackHeader title="Verify Phone" onBackPress={handleClose} />
          ) : (
            <View className="px-4 pt-4 pb-2">
              <View className="flex-row items-center justify-end">
                <Pressable
                  onPress={handleClose}
                  className="p-2 rounded-full bg-muted"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X
                    size={20}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="p-6">
              {/* Icon */}
              <View className="items-center mb-6">
                <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center">
                  <Phone size={40} color="#792339" />
                </View>
              </View>

              {/* Content */}
              <H2 className="text-center mb-3">{title}</H2>
              <P className="text-center text-muted-foreground mb-8">
                {description}
              </P>

              {/* Phone Entry Step */}
              {step === "phone" && (
                <View className="gap-4">
                  {/* International Phone Input */}
                  <InternationalPhoneInput
                    value={phoneNumber}
                    onChangePhoneNumber={(text: string) => {
                      setPhoneNumber(text);
                      setError("");
                    }}
                    selectedCountry={selectedCountry}
                    onChangeSelectedCountry={setSelectedCountry}
                    label="Phone Number"
                    description="Enter your number without the country code"
                    defaultCountry="LB"
                    error={error}
                  />

                  {/* Error Message */}
                  {error && (
                    <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <AlertCircle size={20} color="#ef4444" />
                      <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="gap-3 mt-2">
                    <Button
                      onPress={() => handleSendOTP(false)}
                      disabled={loading || !phoneNumber}
                      size="lg"
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="font-bold text-white">
                          Send Verification Code
                        </Text>
                      )}
                    </Button>
                    {canSkip && (
                      <Button onPress={handleSkip} variant="outline" size="lg">
                        <Text>Skip for Now</Text>
                      </Button>
                    )}
                  </View>
                </View>
              )}

              {/* OTP Verification Step */}
              {step === "otp" && (
                <View className="gap-4">
                  <View className="bg-muted/50 rounded-lg p-4 mb-2">
                    <Text className="text-sm text-center text-muted-foreground">
                      Code sent to
                    </Text>
                    <Text className="text-center font-medium mt-1 text-base">
                      {phoneE164}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setStep("phone");
                        setOtpCode("");
                        setError("");
                        setResendCooldown(0);
                        if (cooldownTimerRef.current) {
                          clearInterval(cooldownTimerRef.current);
                          cooldownTimerRef.current = null;
                        }
                      }}
                      className="mt-2"
                    >
                      <Text className="text-sm text-primary text-center">
                        Change Number
                      </Text>
                    </Pressable>
                  </View>

                  {/* OTP Input */}
                  <View>
                    <Text className="text-sm font-medium mb-2">
                      Verification Code
                    </Text>
                    <TextInput
                      value={otpCode}
                      onChangeText={(text) => {
                        setOtpCode(text.replace(/[^0-9]/g, ""));
                        setError("");
                      }}
                      placeholder="000000"
                      placeholderTextColor={
                        colorScheme === "dark" ? "#666" : "#999"
                      }
                      keyboardType="number-pad"
                      maxLength={6}
                      className="py-4 px-4 bg-card border-2 border-border rounded-lg text-foreground text-center text-2xl tracking-widest"
                      editable={!loading}
                      autoFocus
                      returnKeyType="done"
                      accessibilityLabel="Verification code"
                      accessibilityHint="Enter the 6-digit code sent to your phone"
                    />
                    <Text className="text-xs text-muted-foreground mt-1 text-center">
                      Enter the 6-digit code sent to your phone
                    </Text>
                  </View>

                  {/* Error Message */}
                  {error && (
                    <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <AlertCircle size={20} color="#ef4444" />
                      <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="gap-3 mt-2">
                    <Button
                      onPress={handleVerifyOTP}
                      disabled={loading || otpCode.length !== 6}
                      size="lg"
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="font-bold text-white">Verify</Text>
                      )}
                    </Button>
                    <Button
                      onPress={() => handleSendOTP(true)}
                      variant="ghost"
                      size="lg"
                      disabled={loading || isResending || resendCooldown > 0}
                    >
                      {isResending ? (
                        <View className="flex-row items-center gap-2">
                          <ActivityIndicator size="small" />
                          <Text>Sending...</Text>
                        </View>
                      ) : resendCooldown > 0 ? (
                        <Text>Resend Code ({resendCooldown}s)</Text>
                      ) : (
                        <Text>Resend Code</Text>
                      )}
                    </Button>
                    {canSkip && (
                      <Button onPress={handleSkip} variant="outline" size="lg">
                        <Text>Skip for Now</Text>
                      </Button>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
