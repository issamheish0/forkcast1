import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface AboutSectionProps {
  restaurant: Restaurant;
  showFullDescription: boolean;
  onToggleDescription: () => void;
}

export const AboutSection = ({
  restaurant,
  showFullDescription,
  onToggleDescription,
}: AboutSectionProps) => {
  if (!restaurant.description) {
    return null;
  }

  return (
    <View className="px-4 mb-6">
      <H3 className="mb-2">About</H3>
      <P
        className="text-muted-foreground"
        numberOfLines={showFullDescription ? undefined : 3}
      >
        {restaurant.description}
      </P>
      {restaurant.description && restaurant.description.length > 150 && (
        <Pressable onPress={onToggleDescription} className="mt-1">
          <Text className="text-primary font-medium">
            {showFullDescription ? "Show Less" : "Read More"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};
