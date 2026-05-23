// app/(protected)/restaurant/[id]/reviews.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Star, Edit3, ChevronDown } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useRestaurantReviews } from "@/hooks/useRestaurantReviews";
import { ReviewsEmptyState } from "@/components/restaurant";

export default function RestaurantReviewsScreen() {
  const [isMounted, setIsMounted] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const params = useLocalSearchParams<{ id: string }>();
  const restaurantId = params?.id;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (restaurantId) {
      router.replace({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    } else {
      router.replace("/");
    }
  }, [router, restaurantId]);

  const {
    restaurant,
    reviews,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    handleLikeReview,
    handleWriteReview,
    handleDeleteReview,
    handleRefresh,
    loadMore,
  } = useRestaurantReviews(restaurantId!);

  if (loading && !restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Text className="mt-4 text-muted-foreground">Loading reviews...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const reviewSummary = (restaurant.review_summary ?? null) as {
    recommendation_percentage?: number | null;
    average_rating?: number | null;
  } | null;

  const averageRating =
    typeof reviewSummary?.average_rating === "number"
      ? reviewSummary.average_rating
      : (restaurant.average_rating ?? 0);

  // Calculate rating distribution
  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const total = reviews.length;

    reviews.forEach((review) => {
      const rating = review.rating as 1 | 2 | 3 | 4 | 5;
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
      }
    });

    return {
      distribution,
      total,
      percentages: {
        5: total > 0 ? Math.round((distribution[5] / total) * 100) : 0,
        4: total > 0 ? Math.round((distribution[4] / total) * 100) : 0,
        3: total > 0 ? Math.round((distribution[3] / total) * 100) : 0,
        2: total > 0 ? Math.round((distribution[2] / total) * 100) : 0,
        1: total > 0 ? Math.round((distribution[1] / total) * 100) : 0,
      },
    };
  };

  const ratingData = getRatingDistribution();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center gap-4 px-4 py-4 border-b border-border">
        <Pressable onPress={handleBack} className="flex-row items-center">
          <ChevronLeft size={24} color={isDark ? "#fff" : "#000"} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">Reviews</Text>
          <Text className="text-sm text-muted-foreground">
            {restaurant.name}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 py-6">
          {/* Rating Overview Card */}
          <View className="mb-8">
            <View className="flex-row items-start gap-8 mb-6">
              {/* Large Rating */}
              <View className="items-center">
                <Text className="text-5xl font-bold text-foreground">
                  {averageRating > 0 ? averageRating.toFixed(1) : "-"}
                </Text>
                <View className="flex-row gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      color="#f59e0b"
                      fill={star <= (averageRating || 0) ? "#f59e0b" : "none"}
                    />
                  ))}
                </View>
                <Text className="text-sm text-muted-foreground mt-2">
                  {restaurant.total_reviews || 0} reviews
                </Text>
              </View>

              {/* Rating Distribution */}
              <View className="flex-1">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <View
                    key={rating}
                    className="flex-row items-center gap-3 mb-2"
                  >
                    <Text className="text-sm text-muted-foreground w-6 text-right">
                      {rating}
                    </Text>
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <View className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <View
                        className="h-full bg-amber-400 rounded-full"
                        style={{
                          width: `${ratingData.percentages[rating as 1 | 2 | 3 | 4 | 5]}%`,
                        }}
                      />
                    </View>
                    <Text className="text-xs text-muted-foreground w-8 text-right">
                      {ratingData.percentages[rating as 1 | 2 | 3 | 4 | 5]}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <View>
              {reviews.map((review) => {
                const userName = review?.user?.full_name || "Anonymous";
                const userInitial = userName.charAt(0).toUpperCase();
                const getTimeAgo = (date: string) => {
                  const now = new Date();
                  const reviewDate = new Date(date);
                  const diffInSeconds = Math.floor(
                    (now.getTime() - reviewDate.getTime()) / 1000,
                  );

                  if (diffInSeconds < 60) return "Just now";
                  if (diffInSeconds < 3600)
                    return `${Math.floor(diffInSeconds / 60)}m ago`;
                  if (diffInSeconds < 86400)
                    return `${Math.floor(diffInSeconds / 3600)}h ago`;
                  if (diffInSeconds < 604800)
                    return `${Math.floor(diffInSeconds / 86400)}d ago`;
                  if (diffInSeconds < 2592000)
                    return `${Math.floor(diffInSeconds / 604800)}w ago`;
                  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
                };

                const isExpanded = expandedReviewId === review.id;

                return (
                  <Pressable
                    key={review.id}
                    onPress={() =>
                      setExpandedReviewId(isExpanded ? null : review.id)
                    }
                  >
                    <View className="mb-4 p-4 rounded-xl bg-card border border-border overflow-hidden">
                      {/* User Info Row */}
                      <View className="flex-row items-flex-start gap-3 mb-2">
                        {/* Avatar */}
                        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                          <Text className="text-sm font-semibold text-primary">
                            {userInitial}
                          </Text>
                        </View>

                        {/* Name and Time */}
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-bold text-foreground">
                              {userName}
                            </Text>
                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs text-muted-foreground">
                                {getTimeAgo(review.created_at || "")}
                              </Text>
                              <ChevronDown
                                size={16}
                                color="#9ca3af"
                                style={{
                                  transform: [
                                    { rotate: isExpanded ? "180deg" : "0deg" },
                                  ],
                                }}
                              />
                            </View>
                          </View>

                          {/* Stars under name */}
                          <View className="flex-row gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                color="#a41e34"
                                fill={
                                  star <= (review.rating || 0)
                                    ? "#a41e34"
                                    : "none"
                                }
                              />
                            ))}
                          </View>
                        </View>
                      </View>

                      {/* Review Text - Always show */}
                      <Text className="text-sm text-muted-foreground leading-5 mt-3">
                        {review.comment || "No comment"}
                      </Text>

                      {/* Expanded content - Additional ratings and tags */}
                      {isExpanded && (
                        <View className="mt-4 pt-4 border-t border-border/30">
                          {/* Additional Ratings */}
                          <View className="mb-4">
                            <Text className="text-xs font-semibold text-foreground mb-3">
                              Ratings
                            </Text>

                            {/* Service Rating */}
                            <View className="flex-row items-center justify-between mb-2">
                              <Text className="text-sm text-muted-foreground">
                                Service
                              </Text>
                              <View className="flex-row gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={11}
                                    color="#f59e0b"
                                    fill={star <= 4 ? "#f59e0b" : "none"}
                                  />
                                ))}
                              </View>
                            </View>

                            {/* Food Quality Rating */}
                            <View className="flex-row items-center justify-between mb-2">
                              <Text className="text-sm text-muted-foreground">
                                Food Quality
                              </Text>
                              <View className="flex-row gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={11}
                                    color="#f59e0b"
                                    fill={star <= 5 ? "#f59e0b" : "none"}
                                  />
                                ))}
                              </View>
                            </View>

                            {/* Ambiance Rating */}
                            <View className="flex-row items-center justify-between">
                              <Text className="text-sm text-muted-foreground">
                                Ambiance
                              </Text>
                              <View className="flex-row gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={11}
                                    color="#f59e0b"
                                    fill={star <= 4 ? "#f59e0b" : "none"}
                                  />
                                ))}
                              </View>
                            </View>
                          </View>

                          {/* Tags/Recommendations */}
                          <View className="flex-row flex-wrap gap-2">
                            <View className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                              <Text className="text-xs text-primary font-medium">
                                Would Visit Again
                              </Text>
                            </View>
                            <View className="px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                              <Text className="text-xs text-green-600 font-medium">
                                Would Recommend
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <Pressable
                  onPress={loadMore}
                  disabled={loadingMore}
                  className="mt-4 py-4"
                >
                  <View className="items-center justify-center py-2">
                    {loadingMore ? (
                      <ActivityIndicator
                        size="small"
                        color={colorScheme === "dark" ? "#fff" : "#000"}
                      />
                    ) : (
                      <Text className="text-primary font-semibold text-base">
                        Load More Reviews
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
            </View>
          ) : (
            <ReviewsEmptyState hasFilters={false} />
          )}
        </View>
      </ScrollView>

      {/* Write Review Button */}
      <View className="p-4 bg-background border-t border-border">
        <Button
          variant="default"
          onPress={handleWriteReview}
          className="w-full"
        >
          <View className="flex-row items-center gap-2">
            <Edit3 size={20} color="white" />
            <Text className="text-white font-bold text-lg">Write a Review</Text>
          </View>
        </Button>
      </View>
    </SafeAreaView>
  );
}
