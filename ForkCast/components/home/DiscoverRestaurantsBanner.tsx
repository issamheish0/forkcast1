// components/home/DiscoverRestaurantsBanner.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Search, ChefHat } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";

interface DiscoverRestaurantsBannerProps {
  onPress?: () => void;
}

export function DiscoverRestaurantsBanner({
  onPress,
}: DiscoverRestaurantsBannerProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to search tab
      router.push("/(protected)/(tabs)/search");
    }
  };

  // Use foreground color for icons to match the app's color scheme
  const iconColor = colorScheme === "dark" ? "#ffffff" : "#000000";

  const borderColor = colorScheme === "dark" ? "#ffffff" : "#3b82f6";

  return (
    <Pressable
      onPress={handlePress}
      className="mx-4 mb-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/50 rounded-2xl overflow-hidden"
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        borderWidth: 0.5,
        borderColor: borderColor,
      })}
    >
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <ChefHat size={20} color={iconColor} />
            <View className="flex-1">
              <Text
                className={`text-sm font-bold ${
                  colorScheme === "dark" ? "text-white" : "text-foreground"
                }`}
              >
                Discover All Restaurants
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Explore our complete collection
              </Text>
            </View>
          </View>
          <View className="bg-primary rounded-lg px-3 py-1.5">
            <Text className="text-xs font-semibold text-primary-foreground">
              Explore
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
