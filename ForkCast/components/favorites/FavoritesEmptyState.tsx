import React from "react";
import { View } from "react-native";
import { Heart } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";

interface FavoritesEmptyStateProps {
  onDiscoverPress: () => void;
}

export const FavoritesEmptyState: React.FC<FavoritesEmptyStateProps> = ({
  onDiscoverPress,
}) => {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Heart size={64} color="#666" strokeWidth={1} />
      <H3 className="mt-4 text-center">No Favorites Yet</H3>
      <Muted className="mt-2 text-center px-8">
        Start exploring and add restaurants to your favorites for quick access
      </Muted>
      <Button variant="default" className="mt-6" onPress={onDiscoverPress}>
        <Text>Discover Restaurants</Text>
      </Button>
    </View>
  );
};
