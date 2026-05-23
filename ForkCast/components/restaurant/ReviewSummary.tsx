import React from "react";
import { View } from "react-native";
import { Star } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

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

export const ReviewSummary = ({ reviewSummary }: ReviewSummaryProps) => {
  const renderStars = (rating: number, size: number = 20) => {
    const validRating = rating || 0;
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            color="#f59e0b"
            fill={star <= validRating ? "#f59e0b" : "transparent"}
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (rating: number, count: number) => {
    const percentage =
      (reviewSummary.total_reviews || 0) > 0
        ? (count / (reviewSummary.total_reviews || 1)) * 100
        : 0;

    return (
      <View className="flex-row items-center gap-3 mb-2">
        <View className="flex-row items-center gap-1 w-12">
          <Text className="text-sm">{rating}</Text>
          <Star size={12} color="#f59e0b" fill="#f59e0b" />
        </View>

        <View className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <View
            className="h-full bg-amber-400 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </View>

        <Text className="text-xs text-muted-foreground w-8 text-right">
          {count > 0 ? count : "-"}
        </Text>
      </View>
    );
  };

  // Safely get values with fallbacks
  const avgRating = reviewSummary.average_rating || 0;
  const totalReviews = reviewSummary.total_reviews || 0;
  const recommendationPercentage = reviewSummary.recommendation_percentage || 0;

  return (
    <View>
      <View className="flex-row items-center justify-between mb-4">
        <H3>Reviews & Ratings</H3>
        <View className="flex-row items-center gap-1">
          <Star size={20} color="#f59e0b" fill="#f59e0b" />
          <Text className="font-bold text-lg">
            {avgRating > 0 ? avgRating.toFixed(1) : "-"}
          </Text>
          <Text className="text-muted-foreground">({totalReviews})</Text>
        </View>
      </View>

      <View className="bg-card p-4 rounded-lg mb-4">
        {/* Overall Rating */}
        <View className="items-center mb-6">
          <Text className="text-4xl font-bold mb-2">
            {avgRating > 0 ? avgRating.toFixed(1) : "-"}
          </Text>
          {renderStars(Math.round(avgRating), 24)}
          <Text className="text-muted-foreground mt-2">
            Based on {totalReviews} reviews
          </Text>
          <Text className="text-green-600 text-sm mt-1">
            {recommendationPercentage}% would recommend
          </Text>
        </View>

        {/* Rating Distribution */}
        <View className="mb-6">
          <Text className="font-semibold mb-3">Rating Distribution</Text>
          {[5, 4, 3, 2, 1].map((rating) => (
            <View key={rating}>
              {renderRatingBar(
                rating,
                reviewSummary.rating_distribution[rating] || 0,
              )}
            </View>
          ))}
        </View>

        {/* Detailed Category Ratings */}
        <View>
          <Text className="font-semibold mb-3">Category Breakdown</Text>
          <View className="grid grid-cols-2 gap-4">
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm">Food</Text>
                <View className="flex-row items-center gap-1">
                  {renderStars(
                    Math.round(reviewSummary.detailed_ratings?.food_avg || 0),
                    14,
                  )}
                  <Text className="text-xs ml-1">
                    {(reviewSummary.detailed_ratings?.food_avg || 0).toFixed(1)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm">Service</Text>
                <View className="flex-row items-center gap-1">
                  {renderStars(
                    Math.round(
                      reviewSummary.detailed_ratings?.service_avg || 0,
                    ),
                    14,
                  )}
                  <Text className="text-xs ml-1">
                    {(reviewSummary.detailed_ratings?.service_avg || 0).toFixed(
                      1,
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm">Ambiance</Text>
                <View className="flex-row items-center gap-1">
                  {renderStars(
                    Math.round(
                      reviewSummary.detailed_ratings?.ambiance_avg || 0,
                    ),
                    14,
                  )}
                  <Text className="text-xs ml-1">
                    {(
                      reviewSummary.detailed_ratings?.ambiance_avg || 0
                    ).toFixed(1)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm">Value</Text>
                <View className="flex-row items-center gap-1">
                  {renderStars(
                    Math.round(reviewSummary.detailed_ratings?.value_avg || 0),
                    14,
                  )}
                  <Text className="text-xs ml-1">
                    {(reviewSummary.detailed_ratings?.value_avg || 0).toFixed(
                      1,
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};
