import React, { useState } from "react";
import {
  View,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { Calendar, AlertTriangle, Shield, X } from "lucide-react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Text } from "@/components/ui/text";
import { H2, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import {
  formatDDMMYYYYInput,
  isValidDDMMYYYYFormat,
  convertDDMMYYYYToYYYYMMDD,
} from "@/utils/birthday";

const dobSchema = z.object({
  dateOfBirth: z
    .string()
    .min(1, "Please enter your date of birth.")
    .refine((date) => {
      return isValidDDMMYYYYFormat(date);
    }, "Please enter a valid date in DD-MM-YYYY format.")
    .refine((date) => {
      // Convert DD-MM-YYYY to YYYY-MM-DD for validation
      const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(date);
      const parsedDate = new Date(yyyymmddFormat);
      const today = new Date();
      const age = today.getFullYear() - parsedDate.getFullYear();
      const monthDiff = today.getMonth() - parsedDate.getMonth();
      const dayDiff = today.getDate() - parsedDate.getDate();

      // Check if person is at least 13 years old
      return (
        age > 13 ||
        (age === 13 && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)))
      );
    }, "You must be at least 13 years old.")
    .refine((date) => {
      // Convert DD-MM-YYYY to YYYY-MM-DD for validation
      const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(date);
      const parsedDate = new Date(yyyymmddFormat);
      const today = new Date();
      return parsedDate <= today;
    }, "Date of birth cannot be in the future."),
});

type DOBFormData = z.infer<typeof dobSchema>;

interface DateOfBirthPromptProps {
  visible: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  mandatory?: boolean;
  title?: string;
  description?: string;
}

export const DateOfBirthPrompt: React.FC<DateOfBirthPromptProps> = ({
  visible,
  onComplete,
  onSkip,
  mandatory = false,
  title = "Add Your Date of Birth",
  description = "We need your date of birth for age verification at certain venues. This information can only be set once for security purposes.",
}) => {
  const { profile, updateProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DOBFormData>({
    resolver: zodResolver(dobSchema),
    defaultValues: {
      dateOfBirth: "",
    },
  });

  const handleSubmit = async (data: DOBFormData) => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      // Double-check that date_of_birth is not already set
      if (profile?.date_of_birth) {
        Alert.alert(
          "Already Set",
          "Your date of birth has already been set and cannot be changed.",
          [{ text: "OK", onPress: onComplete }],
        );
        return;
      }

      // Convert DD-MM-YYYY to YYYY-MM-DD for database storage
      const dobForDatabase = convertDDMMYYYYToYYYYMMDD(data.dateOfBirth);

      // Update profile with date of birth
      const { error } = await supabase
        .from("profiles")
        .update({ date_of_birth: dobForDatabase })
        .eq("id", profile?.id);

      if (error) {
        throw error;
      }

      // Update local profile state immediately
      await updateProfile({ date_of_birth: dobForDatabase });

      // Call onComplete immediately to hide the modal
      onComplete();

      // Show success alert after modal is hidden
      setTimeout(() => {
        Alert.alert(
          "Date of Birth Set",
          "Your date of birth has been successfully recorded. This information cannot be changed for security purposes.",
        );
      }, 100);
    } catch (error: any) {
      console.error("Error setting date of birth:", error);

      if (error.message?.includes("cannot be changed once set")) {
        Alert.alert(
          "Already Set",
          "Your date of birth has already been set and cannot be modified.",
          [{ text: "OK", onPress: onComplete }],
        );
      } else {
        Alert.alert(
          "Error",
          error.message || "Failed to set date of birth. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (mandatory) {
      Alert.alert(
        "Required Information",
        "Date of birth is required to continue. You can only set this once for security purposes.",
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Skip Date of Birth",
      "You can add your date of birth later in your profile settings. Some venues may require age verification for booking.",
      [
        { text: "Add Now", style: "default" },
        { text: "Skip", style: "cancel", onPress: onSkip },
      ],
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <TouchableWithoutFeedback onPress={() => {}}>
            <View className="bg-background w-full max-w-md rounded-xl p-6 shadow-lg">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Calendar size={24} className="text-primary mr-3" />
                  <H2 className="flex-1">{title}</H2>
                </View>
              </View>

              {/* Description */}
              <P className="text-muted-foreground mb-6 leading-relaxed">
                {description}
              </P>

              {/* Warning */}
              <View className="flex-row items-start bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg mb-6 border border-amber-200 dark:border-amber-800">
                <AlertTriangle
                  size={20}
                  className="text-amber-600 dark:text-amber-400 mt-0.5 mr-3"
                />
                <View className="flex-1">
                  <Text className="font-medium text-amber-700 dark:text-amber-300 mb-1">
                    One-Time Setting
                  </Text>
                  <Text className="text-sm text-amber-600 dark:text-amber-400">
                    Your date of birth can only be set once and cannot be
                    changed afterward for security and verification purposes.
                  </Text>
                </View>
              </View>

              {/* Form */}
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormInput
                      {...field}
                      label="Date of Birth"
                      placeholder="DD-MM-YYYY"
                      description="Enter your birth day, month, and year (dashes added automatically)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numeric"
                      maxLength={10}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      onChangeText={(text: string) => {
                        const formatted = formatDDMMYYYYInput(text);
                        field.onChange(formatted);
                      }}
                    />
                  )}
                />
              </Form>

              {/* Security Note */}
              <View className="flex-row items-center mt-4 mb-6">
                <Shield
                  size={16}
                  className="text-green-600 dark:text-green-400 mr-2"
                />
                <Text className="text-xs text-muted-foreground flex-1">
                  Your date of birth is used only for age verification and is
                  kept secure
                </Text>
              </View>

              {/* Actions */}
              <View className="flex-row gap-3">
                <Button
                  className="flex-1"
                  onPress={form.handleSubmit(handleSubmit)}
                  disabled={isSubmitting}
                >
                  <Calendar size={16} className="text-white mr-2" />
                  <Text className="text-white font-medium">
                    {isSubmitting ? "Setting..." : "Set Date of Birth"}
                  </Text>
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
