import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  View,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import * as z from "zod";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { auditLogger } from "@/lib/audit";
import { passwordFieldSchema } from "@/lib/validators/password";
import { mapAuthError } from "@/lib/authErrors";

// Schema for Step 1: Email
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

// Schema for Step 2: OTP
const otpSchema = z.object({
  token: z.string().min(6, "Token must be at least 6 characters."),
});

// Schema for Step 3: New Password.
// Use the centralized passwordFieldSchema so the policy here matches
// sign-up + Supabase backend (8+ chars, upper, lower, digit). Previously
// this screen accepted a weaker 6-char password missing the digit
// requirement, which the backend would silently reject as `weak_password`.
const passwordSchema = z
  .object({
    newPassword: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type Step = "EMAIL" | "OTP";

export default function ForgotPassword() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [currentStep, setCurrentStep] = useState<Step>("EMAIL");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");

  // Password visibility states
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");

  // Forms
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // Step 1: Send Reset Email
  const onEmailSubmit = async (data: z.infer<typeof emailSchema>) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(data.email);

      if (error) throw error;

      // Log password reset request
      await auditLogger.logPasswordResetRequest(data.email);

      setEmail(data.email);
      setCurrentStep("OTP");
      Alert.alert(
        "Code Sent",
        "Please check your email for the verification code.",
      );
    } catch (error: unknown) {
      const mapped = mapAuthError(error);
      Alert.alert(mapped.title, mapped.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and Set Password (combined)
  const onOtpAndPasswordSubmit = async (data: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      setIsLoading(true);

      // First verify the OTP - this creates a session
      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email,
          token: data.token,
          type: "recovery",
        });

      if (verifyError) throw verifyError;

      // Immediately update the password before navigation can occur
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) throw updateError;

      // Log password reset completion
      if (verifyData?.user?.id) {
        await auditLogger.logPasswordResetComplete(verifyData.user.id);
      }

      Alert.alert("Success", "Your password has been reset successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/(protected)/(tabs)"),
        },
      ]);
    } catch (error: unknown) {
      const mapped = mapAuthError(error);
      Alert.alert(mapped.title, mapped.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "EMAIL":
        return (
          <View key="email-step" className="gap-4">
            <P className="text-muted-foreground mb-4">
              Enter your email address and we'll send you a code to reset your
              password.
            </P>
            <Form {...emailForm}>
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormInput
                    label="Email"
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    className="bg-gray-100 dark:bg-gray-800"
                    {...field}
                  />
                )}
              />
            </Form>
            <Button
              onPress={emailForm.handleSubmit(onEmailSubmit)}
              disabled={isLoading}
              className="mt-4"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-medium">Send Code</Text>
              )}
            </Button>
          </View>
        );

      case "OTP":
        return (
          <View key="otp-step" className="gap-4">
            <P className="text-muted-foreground mb-4">
              Enter the 6-digit code sent to {email} and set your new password.
            </P>

            <View className="gap-4">
              <Form {...otpForm}>
                <FormField
                  control={otpForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormInput
                      label="Verification Code"
                      placeholder="123456"
                      keyboardType="number-pad"
                      maxLength={6}
                      className="bg-gray-100 dark:bg-gray-800 text-center text-lg tracking-widest"
                      {...field}
                    />
                  )}
                />
              </Form>

              <Form {...passwordForm}>
                <View className="gap-4">
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <View className="relative">
                        <FormInput
                          label="New Password"
                          placeholder="Enter new password"
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry={!showNewPassword}
                          className="bg-gray-100 dark:bg-gray-800"
                          {...field}
                          onChangeText={(value) => {
                            field.onChange(value);
                            setNewPasswordValue(value);
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showNewPassword ? "eye-off" : "eye"}
                            size={20}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                          />
                        </TouchableOpacity>
                        <PasswordStrengthIndicator
                          password={newPasswordValue}
                        />
                      </View>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <View className="relative">
                        <FormInput
                          label="Confirm Password"
                          placeholder="Confirm new password"
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry={!showConfirmPassword}
                          className="bg-gray-100 dark:bg-gray-800"
                          {...field}
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showConfirmPassword ? "eye-off" : "eye"}
                            size={20}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                </View>
              </Form>
            </View>

            <Button
              onPress={() => {
                // Validate both forms and combine data
                const tokenValue = otpForm.getValues("token");
                const passwordValues = passwordForm.getValues();

                if (!tokenValue || tokenValue.length < 6) {
                  Alert.alert(
                    "Error",
                    "Please enter the 6-digit verification code.",
                  );
                  return;
                }

                if (
                  !passwordValues.newPassword ||
                  passwordValues.newPassword.length < 6
                ) {
                  Alert.alert(
                    "Error",
                    "Password must be at least 6 characters.",
                  );
                  return;
                }

                if (
                  passwordValues.newPassword !== passwordValues.confirmPassword
                ) {
                  Alert.alert("Error", "Passwords do not match.");
                  return;
                }

                // Password validation
                if (
                  !/^(?=.*[a-z])(?=.*[A-Z])/.test(passwordValues.newPassword)
                ) {
                  Alert.alert(
                    "Error",
                    "Password must contain at least one uppercase and one lowercase letter.",
                  );
                  return;
                }

                onOtpAndPasswordSubmit({
                  token: tokenValue,
                  newPassword: passwordValues.newPassword,
                  confirmPassword: passwordValues.confirmPassword,
                });
              }}
              disabled={isLoading}
              className="mt-4"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-medium">Reset Password</Text>
              )}
            </Button>

            <TouchableOpacity
              onPress={() => setCurrentStep("EMAIL")}
              disabled={isLoading}
              className="items-center mt-4"
            >
              <Text className="text-primary">Change Email</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="p-4 pb-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => {
              if (currentStep === "EMAIL") {
                router.back();
              } else if (currentStep === "OTP") {
                setCurrentStep("EMAIL");
              }
            }}
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
            <H1 className="self-start text-white">Forgot Password</H1>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 mt-6 bg-background rounded-t-3xl p-6 -mx-4 h-full">
          {renderStepContent()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
