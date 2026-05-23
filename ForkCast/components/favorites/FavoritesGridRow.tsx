import React from "react";
import { View } from "react-native";
import { SharedValue } from "react-native-reanimated";
import { FavoritesGridCard } from "./FavoritesGridCard";
import type { FavoritePair } from "@/hooks/useFavoritesFilters";

interface FavoritesGridRowProps {
  item: FavoritePair;
  onPress: (restaurantId: string) => void;
  onLongPress: (favoriteId: string, restaurantName: string) => void;
  onUnlike: (favoriteId: string, restaurantName: string) => void;
  removingId: string | null;
  fadeAnim: SharedValue<number>;
  scaleAnim: SharedValue<number>;
}

export const FavoritesGridRow: React.FC<FavoritesGridRowProps> = ({
  item: pair,
  onPress,
  onLongPress,
  onUnlike,
  removingId,
  fadeAnim,
  scaleAnim,
}) => {
  return (
    <View className="flex-row">
      <FavoritesGridCard
        item={pair[0]}
        onPress={onPress}
        onLongPress={onLongPress}
        onUnlike={onUnlike}
        removingId={removingId}
        fadeAnim={fadeAnim}
        scaleAnim={scaleAnim}
      />
      {pair[1] ? (
        <FavoritesGridCard
          item={pair[1]}
          onPress={onPress}
          onLongPress={onLongPress}
          onUnlike={onUnlike}
          removingId={removingId}
          fadeAnim={fadeAnim}
          scaleAnim={scaleAnim}
        />
      ) : (
        <View className="flex-1 p-2" />
      )}
    </View>
  );
};
