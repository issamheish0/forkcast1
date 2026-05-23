// components/ui/back-header.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { H2 } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

interface BackHeaderProps {
  title: string;
  rightElement?: React.ReactNode;
  onBackPress?: () => void;
}

export const BackHeader = ({
  title,
  rightElement,
  onBackPress,
}: BackHeaderProps) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View className="px-4 pt-4 pb-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={handleBack}
            className="p-2 rounded-full bg-muted mr-3"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <View className="mt-2">
            <H2 className="text-2xl">{title}</H2>
          </View>
        </View>
        {rightElement ? rightElement : <View style={{ width: 44 }} />}
      </View>
    </View>
  );
};
