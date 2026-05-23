import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert } from "react-native";
import * as z from "zod";
import { useRouter, useLocalSearchParams } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { passwordFieldSchema, PASSWORD_MIN_LENGTH } from "@/lib/validators/password";
import { mapAuthError } from "@/lib/authErrors";

const formSchema = z
  .object({
    token: z.string().min(1, "Token is required."),
    password: passwordFieldSchema,
    confirmPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function PasswordTokenEntry() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      if (!email) {
        throw new Error("Email is required.");
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: data.token,
        type: "recovery",
      });

      if (verifyError) {
        throw verifyError;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        throw updateError;
      }

      Alert.alert("Success", "Your password has been updated successfully.", [
        { text: "OK", onPress: () => router.push("/sign-in") },
      ]);
    } catch (error: unknown) {
      const mapped = mapAuthError(error);
      Alert.alert(mapped.title, mapped.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background p-4 mt-8" edges={["bottom"]}>
      <View className="flex-1 gap-4 web:m-4">
        <View>
          <H1 className="self-start">Enter Token</H1>
          <P className="text-muted-foreground mt-2">
            Enter the token from your email and set a new password.
          </P>
        </View>

        <Form {...form}>
          <View className="gap-4">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormInput
                  label="Token"
                  placeholder="Enter the token from your email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <View>
                  <FormInput
                    label="New Password"
                    placeholder="Enter your new password"
                    description="At least 6 characters with uppercase and lowercase letters. Numbers and special characters are optional but recommended."
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    {...field}
                    onChangeText={(value) => {
                      field.onChange(value);
                      setPasswordValue(value);
                    }}
                  />
                  <PasswordStrengthIndicator password={passwordValue} />
                </View>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormInput
                  label="Confirm New Password"
                  placeholder="Confirm your new password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  {...field}
                />
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
