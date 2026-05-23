import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert, TouchableOpacity } from "react-native";
import * as z from "zod";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { P } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { BackHeader } from "@/components/ui/back-header";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuditLog } from "@/hooks/useAuditLog";

import {
  passwordFieldSchema,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validators/password";
import { mapAuthError } from "@/lib/authErrors";

const formSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordFieldSchema,
    confirmPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Please confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function PasswordReset() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isLoading, setIsLoading] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [newPasswordValue, setNewPasswordValue] = React.useState("");
  const { logProfileUpdated } = useAuditLog();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);

      // First, verify the current password by attempting to sign in
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error("No authenticated user found");
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: data.currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Log the password change (sensitive profile update)
      await logProfileUpdated({
        changed_fields: ["password"],
        sensitive_fields_changed: true,
      });

      Alert.alert("Success", "Your password has been updated successfully.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: unknown) {
      // "Current password is incorrect" was thrown manually above; preserve it
      // verbatim because the mapper would otherwise classify it as GENERIC.
      if (
        error instanceof Error &&
        error.message === "Current password is incorrect"
      ) {
        Alert.alert("Incorrect password", error.message);
      } else {
        const mapped = mapAuthError(error);
        Alert.alert(mapped.title, mapped.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView
      className="flex-1 bg-background p-4"
      edges={["top", "bottom"]}
    >
      <BackHeader title="Change Password" />

      <View className="flex-1 gap-4 web:m-4 px-4 mt-2">
        <P className="text-muted-foreground">
          Enter your current password and choose a new one.
        </P>

        <Form {...form}>
          <View className="gap-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <View className="relative">
                  <FormInput
                    label="Current Password"
                    placeholder="Enter your current password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showCurrentPassword}
                    {...field}
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showCurrentPassword ? "eye-off" : "eye"}
                      size={20}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <View className="relative">
                  <FormInput
                    label="New Password"
                    placeholder="Enter your new password"
                    description="At least 6 characters with uppercase and lowercase letters. Numbers and special characters are optional but recommended."
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showNewPassword}
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
                  <PasswordStrengthIndicator password={newPasswordValue} />
                </View>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <View className="relative">
                  <FormInput
                    label="Confirm New Password"
                    placeholder="Re-enter your new password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showConfirmPassword}
                    {...field}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
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

      <View className="gap-4 web:m-4">
        <Button
          size="default"
          variant="default"
          onPress={form.handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text>Update Password</Text>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}
