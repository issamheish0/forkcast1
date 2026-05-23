import React from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  SharedValue,
} from "react-native-reanimated";
import { Star, Heart } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import type { Favorite } from "@/hooks/useFavorites";
import { getDisplayCuisine } from "@/lib/cuisineUtils";

interface FavoritesGridCardProps {
  item: Favorite;
  onPress: (restaurantId: string) => void;
  onLongPress: (favoriteId: string, restaurantName: string) => void;
  onUnlike: (favoriteId: string, restaurantName: string) => void;
  removingId: string | null;
  fadeAnim: SharedValue<number>;
  scaleAnim: SharedValue<number>;
}

export const FavoritesGridCard: React.FC<FavoritesGridCardProps> = ({
  item,
  onPress,
  onLongPress,
  onUnlike,
  removingId,
  fadeAnim,
  scaleAnim,
}) => {
  const handleUnlikePress = (e: any) => {
    e.stopPropagation();
    onUnlike(item.id, item.restaurant.name);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: removingId === item.id ? fadeAnim.value : 1,
    transform: [{ scale: removingId === item.id ? scaleAnim.value : 1 }],
  }));

  return (
    <Animated.View style={[{ flex: 1, padding: 8 }, animatedStyle]}>
      <Pressable
        onPress={() => onPress(item.restaurant_id)}
        onLongPress={() => onLongPress(item.id, item.restaurant.name)}
        className="bg-card rounded-xl overflow-hidden shadow-sm"
      >
        <View className="relative">
          <Image
            {...({
              source: { uri: item.restaurant.main_image_url },
              optimizationPreset: "medium",
              className: "w-full h-32",
              contentFit: "cover",
            } as any)}
          />

          {/* Visited tag - top left */}
          {(item.total_bookings || 0) > 0 && (
            <View className="absolute top-2 left-2 bg-primary/90 rounded-full px-2 py-0.5 z-10">
              <Text className="text-[10px] text-white font-medium">
                Visited {item.total_bookings}x
              </Text>
            </View>
          )}

          {/* Unlike heart button - top right */}
          <Pressable
            onPress={handleUnlikePress}
            className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 z-10"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart size={14} color="#ef4444" fill="#ef4444" />
          </Pressable>
        </View>

        <View className="p-3">
          <Text className="font-semibold text-sm" numberOfLines={1}>
            {item.restaurant.name}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {getDisplayCuisine(
              item.restaurant.cuisine_type,
              (item.restaurant as any).secondary_cuisines,
              "Restaurant",
            )}
          </Text>

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-1">
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-xs">
                {item.restaurant.average_rating &&
                item.restaurant.average_rating > 0
                  ? item.restaurant.average_rating.toFixed(1)
                  : "-"}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {"$".repeat(item.restaurant.price_range)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
