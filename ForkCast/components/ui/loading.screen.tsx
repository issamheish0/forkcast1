import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { getActivityIndicatorColor, getThemedColors } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";

export function LoadingScreen({
  message = "Loading...",
}: {
  message?: string;
}) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: themedColors.background,
      }}
      className="flex-1 justify-center items-center bg-background"
    >
      <ActivityIndicator
        size="large"
        color={getActivityIndicatorColor(colorScheme)}
      />
      <Text
        style={{
          color: themedColors.foreground,
          marginTop: 16,
        }}
        className="text-foreground mt-4"
      >
        {message}
      </Text>
    </View>
  );
}
