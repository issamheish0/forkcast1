import * as React from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Phone, AlertCircle } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { mapAuthError } from "@/lib/authErrors";
import {
  InternationalPhoneInput,
  isValidPhoneNumber,
  type ICountry,
} from "@/components/ui/international-phone-input";
import type { ICountryCca2 } from "react-native-country-select";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";

export default function PhoneSignIn() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // Step 1: Phone entry, Step 2: OTP verification
  const [step, setStep] = React.useState<"phone" | "otp">("phone");

  // Phone number state
  const [selectedCountry, setSelectedCountry] = React.useState<ICountry | null>(
    null,
  );
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [phoneE164, setPhoneE164] = React.useState("");

  // OTP state
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const cooldownTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const isDark = colorScheme === "dark";

  // Build E.164 phone number using libphonenumber for correct formatting
  const getPhoneE164 = React.useCallback((): string => {
    if (!selectedCountry || !phoneNumber.trim()) return "";
    const nationalNumber = phoneNumber.replace(/^0+/, "").replace(/\s/g, "");
    const parsed = parsePhoneNumberFromString(
      nationalNumber,
      selectedCountry.cca2 as CountryCode,
    );
    return parsed?.format("E.164") ?? "";
  }, [selectedCountry, phoneNumber]);

  // Cooldown timer effect
  React.useEffect(() => {
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

  const handleSendOTP = async (): Promise<void> => {
    if (!selectedCountry) {
      setError("Please select your country");
      return;
    }
    if (!phoneNumber || phoneNumber.length < 6) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!isValidPhoneNumber(phoneNumber, selectedCountry)) {
      setError("Please enter a valid phone number for the selected country");
      return;
    }

    const e164 = getPhoneE164();
    if (!e164.startsWith("+")) {
      setError("Invalid phone number format");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Only send OTP if an account exists for this phone (sign-in, not sign-up)
      const { data: checkData, error: checkErr } =
        await supabase.functions.invoke("check-phone-for-sign-in", {
          body: { phone: e164 },
        });
      if (checkErr) {
        throw new Error("Could not check account. Please try again.");
      }
      if (checkData?.exists !== true) {
        if (checkData?.status === "unverified") {
          setError(
            checkData.message ??
              "This phone is linked to an account but not yet verified. Please sign in with your email and verify your phone from your profile.",
          );
        } else {
          setError("No account with this phone number. Please sign up first.");
        }
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { channel: "whatsapp" },
      });

      if (otpError) {
        throw otpError;
      }

      setPhoneE164(e164);
      setStep("otp");
      setResendCooldown(60);
      setOtp("");
      Alert.alert("Code Sent", `A verification code has been sent to ${e164}`, [
        { text: "OK" },
      ]);
    } catch (err: unknown) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (): Promise<void> => {
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    if (!phoneE164) {
      setError("Phone number is missing. Please start over.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: otp,
        type: "sms",
      });

      if (verifyError) {
        throw verifyError;
      }

      if (!data.session) {
        throw new Error("No session created after verification");
      }

      // Auth provider will handle navigation via onAuthStateChange
    } catch (err: unknown) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async (): Promise<void> => {
    if (resendCooldown > 0) {
      setError(`Please wait ${resendCooldown} seconds before resending`);
      return;
    }
    if (!phoneE164) return;

    try {
      setResending(true);
      setError("");

      const { error: resendError } = await supabase.auth.signInWithOtp({
        phone: phoneE164,
        options: { channel: "whatsapp" },
      });

      if (resendError) {
        throw resendError;
      }

      setOtp("");
      setResendCooldown(60);
      Alert.alert(
        "Code Resent",
        `A new verification code has been sent to ${phoneE164}`,
        [{ text: "OK" }],
      );
    } catch (err: unknown) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
    } finally {
      setResending(false);
    }
  };

  const handleGoBack = (): void => {
    if (step === "otp") {
      setStep("phone");
      setOtp("");
      setError("");
      setResendCooldown(0);
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={["top", "bottom"]}>
      <View className="p-4 pb-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleGoBack}
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
            <H1 className="self-start text-white">
              {step === "phone" ? "Sign In with Phone" : "Verify Code"}
            </H1>
            <P className="text-white/90 mt-2">
              {step === "phone"
                ? "Enter your phone number to receive a verification code"
                : "Enter the 6-digit code sent to your phone"}
            </P>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 gap-6 py-8">
            <View className="items-center">
              <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center">
                <Phone size={40} color="#fff" />
              </View>
            </View>

            {step === "phone" ? (
              <>
                <View>
                  <InternationalPhoneInput
                    value={phoneNumber}
                    onChangePhoneNumber={(v) => {
                      setPhoneNumber(v);
                      setError("");
                    }}
                    selectedCountry={selectedCountry}
                    onChangeSelectedCountry={(c) => {
                      setSelectedCountry(c);
                      setError("");
                    }}
                    error={error || undefined}
                    label="Phone Number"
                    defaultCountry={"LB" as ICountryCca2}
                    disabled={loading}
                  />
                </View>

                {error && (
                  <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <AlertCircle size={20} color="#ef4444" />
                    <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                      {error}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSendOTP}
                  disabled={loading}
                  className={`h-14 rounded-lg items-center justify-center ${
                    loading ? "opacity-50" : ""
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
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-medium text-white">Send Code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View className="bg-white/10 rounded-lg p-4">
                  <Text className="text-sm text-center text-white/70">
                    Code sent to
                  </Text>
                  <Text className="text-center font-medium mt-1 text-white text-base">
                    {phoneE164}
                  </Text>
                </View>

                <View>
                  <Text className="text-sm font-medium mb-2 text-white">
                    Verification Code
                  </Text>
                  <TextInput
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text.replace(/[^0-9]/g, ""));
                      setError("");
                    }}
                    placeholder="000000"
                    placeholderTextColor={isDark ? "#666" : "#999"}
                    keyboardType="number-pad"
                    maxLength={6}
                    className="py-4 px-4 bg-gray-100 dark:bg-gray-800 border-2 border-input rounded-lg text-foreground text-center text-2xl tracking-widest"
                    editable={!loading}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyOTP}
                    accessibilityLabel="Verification code"
                    accessibilityHint="Enter the 6-digit code sent to your phone"
                  />
                </View>

                {error && (
                  <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <AlertCircle size={20} color="#ef4444" />
                    <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                      {error}
                    </Text>
                  </View>
                )}

                <View className="items-center">
                  <Pressable
                    onPress={handleResendOTP}
                    disabled={resending || resendCooldown > 0}
                    style={({ pressed }) => ({
                      opacity:
                        pressed || resending || resendCooldown > 0 ? 0.6 : 1,
                    })}
                  >
                    {resending ? (
                      <View className="flex-row items-center gap-2">
                        <ActivityIndicator size="small" color="#fff" />
                        <Text className="text-white">Sending...</Text>
                      </View>
                    ) : resendCooldown > 0 ? (
                      <Text className="text-white/70">
                        Resend code in {resendCooldown}s
                      </Text>
                    ) : (
                      <Text className="text-white font-medium">
                        Didn&apos;t receive the code? Resend
                      </Text>
                    )}
                  </Pressable>
                </View>

                <TouchableOpacity
                  onPress={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className={`h-14 rounded-lg items-center justify-center ${
                    loading || otp.length !== 6 ? "opacity-50" : ""
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
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="font-medium text-white">
                      Verify & Sign In
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
