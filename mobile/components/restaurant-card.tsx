import { Image, Pressable, Text, View } from "react-native";
import { Star } from "lucide-react-native";
import { Restaurant } from "@/lib/types";

function cuisineLabel(restaurant: Restaurant) {
  const extra = restaurant.cuisine_types?.length ?? 0;
  return `${restaurant.cuisine_type ?? "—"}${extra > 0 ? ` +${extra}` : ""}`;
}

export function RestaurantCard({
  restaurant,
  onPress,
  variant = "wide",
}: {
  restaurant: Restaurant;
  onPress: () => void;
  variant?: "wide" | "row";
}) {
  if (variant === "row") {
    return (
      <Pressable
        onPress={onPress}
        className="flex-row gap-3 rounded-2xl bg-card p-3 border border-border"
      >
        <Image
          source={{ uri: restaurant.main_image_url ?? undefined }}
          className="h-20 w-20 rounded-xl bg-muted"
        />
        <View className="flex-1 justify-center">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {cuisineLabel(restaurant)} · {"$".repeat(restaurant.price_range ?? 2)}
          </Text>
          <View className="mt-1 flex-row items-center gap-1">
            <Star size={14} color="#EAB308" fill="#EAB308" />
            <Text className="text-sm text-foreground">
              {Number(restaurant.average_rating ?? 0).toFixed(1)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="w-64 rounded-2xl bg-card border border-border overflow-hidden"
    >
      <Image
        source={{ uri: restaurant.main_image_url ?? undefined }}
        className="h-36 w-full bg-muted"
      />
      <View className="p-3">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {cuisineLabel(restaurant)} · {"$".repeat(restaurant.price_range ?? 2)}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Star size={14} color="#EAB308" fill="#EAB308" />
          <Text className="text-sm text-foreground">
            {Number(restaurant.average_rating ?? 0).toFixed(1)}
          </Text>
          <Text className="text-sm text-muted-foreground"> · {restaurant.address}</Text>
        </View>
      </View>
    </Pressable>
  );
}

