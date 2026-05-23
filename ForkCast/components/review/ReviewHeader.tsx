import React from "react";
import { View, Pressable, Alert } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

interface ReviewHeaderProps {
  title: string;
  subtitle?: string;
  currentStep?: number;
  totalSteps?: number;
  onBack?: () => void;
  showProgress?: boolean;
}

export const ReviewHeader: React.FC<ReviewHeaderProps> = ({
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
  showProgress = false,
}) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#fff' : '#374151';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      Alert.alert(
        "Cancel Review",
        "Are you sure you want to cancel? Your progress will be lost.",
        [
          { text: "Continue Writing", style: "cancel" },
          {
            text: "Cancel Review",
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
    }
  };

  return (
    <>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={handleBack} className="p-2 -ml-2">
            <ChevronLeft size={24} color={iconColor} />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text className="text-center font-semibold">{title}</Text>
            {subtitle && (
              <Muted className="text-center text-sm">{subtitle}</Muted>
            )}
          </View>
          <View className="w-10" />
        </View>
      </View>

      {/* Progress Bar */}
      {showProgress &&
        currentStep !== undefined &&
        totalSteps !== undefined && (
          <View className="h-1 bg-muted">
            <View
              className="h-full bg-primary"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </View>
        )}
    </>
  );
};
