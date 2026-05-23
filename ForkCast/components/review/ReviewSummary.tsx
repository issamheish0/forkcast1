import React from "react";
import { Star, ThumbsUp } from "lucide-react-native";
import { View, Text } from "react-native";
import { Muted } from "../ui/typography";

// components/review/ReviewSummary.tsx
interface ReviewSummaryProps {
  reviewSummary: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
    detailed_ratings: {
      food_avg: number;
      service_avg: number;
      ambiance_avg: number;
      value_avg: number;
    };
    recommendation_percentage: number;
  };
}

export function ReviewSummary({ reviewSummary }: ReviewSummaryProps) {
  const renderStars = (rating: number, size: number = 20) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            color="#f59e0b"
            fill={star <= rating ? "#f59e0b" : "transparent"}
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (rating: number, count: number) => {
    const total = reviewSummary.total_reviews;
    const percentage = total > 0 ? (count / total) * 100 : 0;

    return (
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-xs w-4">{rating}</Text>
        <Star size={12} color="#792339" fill="#792339" />
        <View className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <View
            className="h-full bg-yellow-400"
            style={{ width: `${percentage}%` }}
          />
        </View>
        <Text className="text-xs w-8 text-right text-muted-foreground">
          {count}
        </Text>
      </View>
    );
  };

  if (reviewSummary.total_reviews === 0) {
    return (
      <View className="bg-card border border-border rounded-lg p-4">
        <Text className="text-center text-muted-foreground">
          No reviews yet. Be the first to review!
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-card border border-border rounded-lg p-4">
      {/* Overall Rating */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="items-center">
          <Text className="text-3xl font-bold">
            {reviewSummary.average_rating.toFixed(1)}
          </Text>
          {renderStars(Math.round(reviewSummary.average_rating))}
          <Muted className="text-xs mt-1">
            {reviewSummary.total_reviews} review
            {reviewSummary.total_reviews !== 1 ? "s" : ""}
          </Muted>
        </View>

        <View className="flex-1 ml-6">
          {[5, 4, 3, 2, 1].map((rating) =>
            renderRatingBar(
              rating,
              reviewSummary.rating_distribution[rating.toString()] || 0,
            ),
          )}
        </View>
      </View>

      {/* Detailed Ratings */}
      <View className="border-t border-border pt-4">
        <Text className="font-semibold mb-3">Detailed Ratings</Text>
        <View className="flex-row flex-wrap gap-4">
          {Object.entries(reviewSummary.detailed_ratings).map(
            ([key, value]) => {
              if (!value) return null;
              const label = key
                .replace("_avg", "")
                .replace(/^\w/, (c) => c.toUpperCase());

              return (
                <View key={key} className="flex-1 min-w-[70px]">
                  <Text className="text-xs text-muted-foreground mb-1">
                    {label}
                  </Text>
                  {renderStars(Math.round(value), 14)}
                  <Text className="text-xs mt-1">{value.toFixed(1)}</Text>
                </View>
              );
            },
          )}
        </View>
      </View>

      {/* Recommendation Rate */}
      {reviewSummary.recommendation_percentage > 0 && (
        <View className="border-t border-border pt-4 mt-4">
          <View className="flex-row items-center gap-2">
            <ThumbsUp size={16} color="#792339" />
            <Text className="text-sm">
              {reviewSummary.recommendation_percentage}% recommend to friends
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
