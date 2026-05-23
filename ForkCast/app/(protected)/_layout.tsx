// app/(protected)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: themedColors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="restaurant/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="restaurant/menu/[restaurantId]" options={{ headerShown: false }} />
      <Stack.Screen name="booking/availability" options={{ headerShown: false }} />
      <Stack.Screen name="booking/create" options={{ headerShown: false }} />
      <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="offers" options={{ headerShown: false }} />
      <Stack.Screen name="favorites" options={{ headerShown: false }} />
      <Stack.Screen name="waiting-list" options={{ headerShown: false }} />
      <Stack.Screen name="waitlist" options={{ headerShown: false }} />
      <Stack.Screen name="my-waitlists" options={{ headerShown: false }} />
      <Stack.Screen name="invitations" options={{ headerShown: false }} />
      <Stack.Screen name="location-selector" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="cuisine/[cuisineId]" options={{ headerShown: false }} />
    </Stack>
  );
}
