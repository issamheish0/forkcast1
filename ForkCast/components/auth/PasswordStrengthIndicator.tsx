import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { InputValidator } from "@/lib/security";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  const validation = password
    ? InputValidator.validatePassword(password)
    : null;

  if (!password) return null;

  const getStrengthColor = () => {
    if (!validation) return "bg-gray-300";
    switch (validation.strength) {
      case "weak":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "strong":
        return "bg-green-500";
      default:
        return "bg-gray-300";
    }
  };

  const getStrengthWidth = () => {
    if (!validation) return "0%";
    switch (validation.strength) {
      case "weak":
        return "33%";
      case "medium":
        return "66%";
      case "strong":
        return "100%";
      default:
        return "0%";
    }
  };

  const getStrengthText = () => {
    if (!validation) return "";
    switch (validation.strength) {
      case "weak":
        return "Weak";
      case "medium":
        return "Medium";
      case "strong":
        return "Strong";
      default:
        return "";
    }
  };

  const getStrengthTextColor = () => {
    if (!validation) return "text-gray-500";
    switch (validation.strength) {
      case "weak":
        return "text-red-500";
      case "medium":
        return "text-yellow-600";
      case "strong":
        return "text-green-600";
      default:
        return "text-gray-500";
    }
  };

  return (
    <View className="mt-2 gap-2">
      {/* Strength Bar */}
      <View className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <View
          className={`h-full ${getStrengthColor()} rounded-full`}
          style={{ width: getStrengthWidth() }}
        />
      </View>

      {/* Strength Text and Tips */}
      <View className="flex-row items-center justify-between">
        <Text className={`text-xs font-medium ${getStrengthTextColor()}`}>
          {getStrengthText()}
        </Text>
        {validation && validation.strength !== "strong" && (
          <Text className="text-xs text-muted-foreground">
            {validation.strength === "weak"
              ? "Add numbers or special characters"
              : "Add more variety for strong password"}
          </Text>
        )}
      </View>
    </View>
  );
}
