import React from "react";
import { View } from "react-native";
import { Award } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { UserRating } from "@/components/rating/UserRating";
import SkeletonPlaceholder from "@/components/skeletons/SkeletonPlaceholder";

interface ProfileStatusCardsProps {
  profile: any;
  ratingStats?: {
    completion_rate: number;
  };
  currentRating: number;
  ratingLoading: boolean;
}

export const ProfileStatusCards: React.FC<ProfileStatusCardsProps> = ({
  profile,
  ratingStats,
  currentRating,
  ratingLoading,
}) => {
  return (
    <View className="mx-4 mb-6">
      {/* Reliability Score Card */}
      <View className="p-4 bg-card rounded-xl shadow-sm">
        <View className="flex-row items-center gap-2 mb-2">
          <Award size={20} color="#FFD700" />
          <Text className="font-bold text-sm">Reliability</Text>
        </View>
        {!ratingLoading && ratingStats ? (
          <>
            <UserRating rating={currentRating} size="sm" showNumber={false} />
            <Text className="text-lg font-bold text-primary mt-1">
              {currentRating.toFixed(1)}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {ratingStats.completion_rate.toFixed(0)}% completion rate
            </Text>
          </>
        ) : (
          <View className="py-2">
            <SkeletonPlaceholder width={80} height={16} borderRadius={4} />
            <SkeletonPlaceholder width={40} height={20} borderRadius={4} style={{ marginTop: 4 }} />
            <SkeletonPlaceholder width={100} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        )}
      </View>
    </View>
  );
};
