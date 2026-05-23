import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

interface TabButtonProps {
  title: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
  className?: string;
}

export function TabButton({
  title,
  isActive,
  onPress,
  count,
  className = "",
}: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-4 items-center border-b-2 ${
        isActive ? "border-primary" : "border-transparent"
      } ${className}`}
    >
      <View className="flex-row items-center gap-2">
        <Text
          className={`font-medium ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {title}
        </Text>
        {typeof count === "number" && count > 0 && (
          <View
            className={`px-2 py-0.5 rounded-full min-w-[20px] items-center ${
              isActive ? "bg-primary" : "bg-muted"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isActive ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
