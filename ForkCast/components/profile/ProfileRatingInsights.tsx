import React from "react";
import { View, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { UserRating } from "@/components/rating/UserRating";

interface ProfileRatingInsightsProps {
  ratingStats: {
    total_bookings: number;
    completion_rate: number;
    rating_trend: string;
  };
  currentRating: number;
  onPress: () => void;
}

export const ProfileRatingInsights: React.FC<ProfileRatingInsightsProps> = ({
  ratingStats,
  currentRating,
  onPress,
}) => {
  if (!ratingStats || ratingStats.total_bookings === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-semibold text-blue-800">
          Reliability Insights
        </Text>
        <ChevronRight size={16} color="#2563eb" />
      </View>
      <View className="flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="text-blue-700 text-sm">
            Completion Rate:{" "}
            <Text className="font-medium">
              {ratingStats.completion_rate.toFixed(0)}%
            </Text>
          </Text>
          <Text className="text-blue-700 text-sm">
            Rating Trend:{" "}
            <Text className="font-medium">{ratingStats.rating_trend}</Text>
          </Text>
        </View>
        <UserRating rating={currentRating} size="md" showNumber={true} />
      </View>
    </Pressable>
  );
};
