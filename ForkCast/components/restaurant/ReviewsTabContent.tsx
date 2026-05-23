import React from "react";
import { View, Pressable } from "react-native";
import { Star } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewCard } from "./ReviewCard";

import { Database } from "@/types/supabase";

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
};

interface ReviewSummaryData {
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
}

interface ReviewsTabContentProps {
  reviewSummary: ReviewSummaryData;
  reviews: Review[];
  showAllReviews: boolean;
  currentUserId?: string;
  onToggleShowAllReviews: () => void;
  onWriteReview: () => void;
}

const ReviewsTabContentComponent = ({
  reviewSummary,
  reviews,
  showAllReviews,
  currentUserId,
  onToggleShowAllReviews,
  onWriteReview,
}: ReviewsTabContentProps) => {
  return (
    <View className="px-4 mb-6">
      {/* Review Summary Section */}
      <View className="mb-6">
        <ReviewSummary reviewSummary={reviewSummary} />
      </View>

      {/* Write Review Button */}
      <View className="mb-6">
        <Button onPress={onWriteReview} variant="outline" className="w-full">
          <View className="flex-row items-center justify-center gap-2">
            <Star size={16} color="#666" />
            <Text>Write a Review</Text>
          </View>
        </Button>
      </View>

      {/* Individual Reviews */}
      {reviews.length > 0 ? (
        <View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold">Recent Reviews</Text>
            {reviews.length > 5 && (
              <Pressable onPress={onToggleShowAllReviews}>
                <Text className="text-primary text-sm">
                  {showAllReviews ? "Show Less" : "View All"}
                </Text>
              </Pressable>
            )}
          </View>

          {reviews.slice(0, showAllReviews ? undefined : 5).map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwner={currentUserId === review.user_id}
              showActions={false}
            />
          ))}

          {reviews.length > 5 && !showAllReviews && (
            <Button
              variant="outline"
              onPress={onToggleShowAllReviews}
              className="w-full mt-2"
            >
              <Text>View All {reviews.length} Reviews</Text>
            </Button>
          )}
        </View>
      ) : (
        <View className="bg-card border border-border rounded-lg p-6 items-center">
          <Star size={32} color="#d1d5db" />
          <Text className="mt-2 font-medium">No Reviews Yet</Text>
          <Muted className="text-center mt-1">
            Be the first to share your experience
          </Muted>
          <Button onPress={onWriteReview} variant="default" className="mt-4">
            <Text>Write First Review</Text>
          </Button>
        </View>
      )}
    </View>
  );
};

export const ReviewsTabContent = React.memo(ReviewsTabContentComponent);
