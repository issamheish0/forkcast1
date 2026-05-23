import React from "react";
import { ScrollView, View, Pressable } from "react-native";
import { Star } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";

// Interactive rating component for detailed ratings
const CategoryRating: React.FC<{
  rating: number;
  onRatingChange: (rating: number) => void;
  label: string;
}> = ({ rating, onRatingChange, label }) => {
  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-medium">{label}</Text>
        <View className="flex-row items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => {
                onRatingChange(star);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="p-1"
            >
              <Star
                size={24}
                color="#FFD700"
                fill={star <= rating ? "#FFD700" : "transparent"}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

interface DetailedRatings {
  food: number;
  service: number;
  ambiance: number;
  value: number;
}

interface DetailedRatingsStepProps {
  ratings: DetailedRatings;
  onRatingsChange: (ratings: DetailedRatings) => void;
  onIndividualRatingChange?: (
    category: keyof DetailedRatings,
    rating: number,
  ) => void;
}

export const DetailedRatingsStep: React.FC<DetailedRatingsStepProps> = ({
  ratings,
  onRatingsChange,
  onIndividualRatingChange,
}) => {
  const handleRatingChange = (
    category: keyof DetailedRatings,
    rating: number,
  ) => {
    const newRatings = { ...ratings, [category]: rating };
    onRatingsChange(newRatings);
    onIndividualRatingChange?.(category, rating);
  };

  const ratingCategories = [
    {
      key: "food" as keyof DetailedRatings,
      label: "Food Quality",
      description: "Taste, presentation, authenticity",
    },
    {
      key: "service" as keyof DetailedRatings,
      label: "Service",
      description: "Staff friendliness, speed, attentiveness",
    },
    {
      key: "ambiance" as keyof DetailedRatings,
      label: "Ambiance",
      description: "Atmosphere, decor, noise level",
    },
    {
      key: "value" as keyof DetailedRatings,
      label: "Value for Money",
      description: "Portion size, pricing, overall value",
    },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="py-4">
      <View className="gap-6">
        {ratingCategories.map(({ key, label, description }) => (
          <View key={key}>
            <CategoryRating
              rating={ratings[key]}
              onRatingChange={(rating) => handleRatingChange(key, rating)}
              label={label}
            />
            <Muted className="text-sm mt-1">{description}</Muted>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
