import React from "react";
import { View } from "react-native";
import { Utensils, MapPin } from "lucide-react-native";

import { Text } from "@/components/ui/text";

interface MostVisitedRestaurant {
  id: string;
  name: string;
  visits: number;
}

interface ProfileFavoritesInsightsProps {
  mostVisitedCuisine: string;
  mostVisitedRestaurant: MostVisitedRestaurant | null;
}

export const ProfileFavoritesInsights: React.FC<
  ProfileFavoritesInsightsProps
> = ({ mostVisitedCuisine, mostVisitedRestaurant }) => {
  if (mostVisitedCuisine === "Not available" && !mostVisitedRestaurant) {
    return null;
  }

  return (
    <View className="mx-4 mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
      <Text className="font-semibold mb-2">Your Favorites</Text>
      {mostVisitedCuisine !== "Not available" && (
        <View className="flex-row items-center gap-2 mb-1">
          <Utensils size={16} color="#666" />
          <Text className="text-sm">
            Favorite cuisine:{" "}
            <Text className="font-medium">{mostVisitedCuisine}</Text>
          </Text>
        </View>
      )}
      {mostVisitedRestaurant && (
        <View className="flex-row items-center gap-2">
          <MapPin size={16} color="#666" />
          <Text className="text-sm">
            Most visited:{" "}
            <Text className="font-medium">{mostVisitedRestaurant.name}</Text> (
            {mostVisitedRestaurant.visits} visits)
          </Text>
        </View>
      )}
    </View>
  );
};
