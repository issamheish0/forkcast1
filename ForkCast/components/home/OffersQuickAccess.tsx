// components/home/OffersQuickAccess.tsx
import React from "react";
import { View, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Percent, Tag } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";

interface OffersQuickAccessProps {
  offerCount?: number;
  claimedCount?: number;
  onPress?: () => void;
}

/**
 * OffersQuickAccess - A subtle inline link to offers page
 * Shows when user has claimed offers ready to use
 */
export function OffersQuickAccess({
  claimedCount = 0,
  onPress,
}: OffersQuickAccessProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      router.push("/offers");
    }
  };

  if (claimedCount === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={handlePress}
      className="mx-4 mb-3 flex-row items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2.5 active:opacity-80"
    >
      <View className="flex-row items-center">
        <View className="bg-emerald-500 rounded-lg p-1.5 mr-2.5">
          <Tag size={14} color="white" />
        </View>
        <Text className="text-emerald-800 dark:text-emerald-200 font-semibold text-sm">
          {claimedCount} {claimedCount === 1 ? "offer" : "offers"} ready to use
        </Text>
      </View>
      <ChevronRight size={18} color={isDark ? "#6ee7b7" : "#059669"} />
    </Pressable>
  );
}

interface OfferRestaurantItemProps {
  restaurant: {
    id: string;
    name: string;
    main_image_url: string | null;
    cuisine_type: string | null;
  };
  discount: number;
  onPress: (id: string) => void;
}

function OfferRestaurantItem({
  restaurant,
  discount,
  onPress,
}: OfferRestaurantItemProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(restaurant.id);
  };

  return (
    <Pressable onPress={handlePress} className="mr-3 active:opacity-80">
      <View className="w-28">
        <View className="relative">
          <Image
            source={{ uri: restaurant.main_image_url || undefined }}
            className="w-28 h-28 rounded-xl"
            contentFit="cover"
          />
          <View className="absolute top-1.5 left-1.5 bg-emerald-500 px-1.5 py-0.5 rounded">
            <Text className="text-white text-[9px] font-bold">
              {discount}% OFF
            </Text>
          </View>
        </View>
        <Text className="font-medium text-xs mt-1.5" numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text className="text-muted-foreground text-[10px]" numberOfLines={1}>
          {getDisplayCuisine(
            restaurant.cuisine_type,
            (restaurant as any).secondary_cuisines,
            "Restaurant",
          )}
        </Text>
      </View>
    </Pressable>
  );
}

interface OffersRestaurantRowProps {
  restaurants: {
    id: string;
    name: string;
    main_image_url: string | null;
    cuisine_type: string | null;
    discount: number;
  }[];
  onRestaurantPress: (id: string) => void;
  onViewAllPress: () => void;
}

export function OffersRestaurantRow({
  restaurants,
  onRestaurantPress,
  onViewAllPress,
}: OffersRestaurantRowProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (!restaurants || restaurants.length === 0) {
    return null;
  }

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between px-4 mb-2">
        <View className="flex-row items-center">
          <Percent size={14} color={isDark ? "#6ee7b7" : "#059669"} />
          <Text className="font-semibold text-base ml-1.5">Special Offers</Text>
        </View>
        <Pressable onPress={onViewAllPress} className="flex-row items-center">
          <Text className="text-primary text-sm font-medium">View All</Text>
          <ChevronRight size={16} color={isDark ? "#6ee7b7" : "#059669"} />
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={restaurants}
        renderItem={({ item }) => (
          <OfferRestaurantItem
            restaurant={item}
            discount={item.discount}
            onPress={onRestaurantPress}
          />
        )}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
}

export function OffersMiniBanner({
  discount,
  onPress,
}: {
  discount?: number;
  onPress?: () => void;
}) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      router.push("/offers");
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg active:opacity-80"
    >
      <Percent
        size={12}
        color={colorScheme === "dark" ? "#4ade80" : "#16a34a"}
      />
      <Text className="text-emerald-700 dark:text-emerald-300 font-medium text-xs ml-1">
        {discount ? `${discount}% off` : "Offers"}
      </Text>
    </Pressable>
  );
}

export default OffersQuickAccess;
