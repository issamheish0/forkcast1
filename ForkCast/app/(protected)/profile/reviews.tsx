import { supabase } from "@/config/supabase";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Card } from "@/components/ui/card";
import { ReviewsScreenSkeleton } from "@/components/skeletons/ReviewsScreenSkeleton";
import { Star } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { BackHeader } from "@/components/ui/back-header";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { useAuth } from "@/context/supabase-provider";

interface Review {
  id: string;
  booking_id: string;
  user_id: string;
  restaurant_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  restaurant?: { name: string } | null;
}

const fetchReviews = async (id: string) => {
  if (!id) {
    return [];
  }

  try {
    const { data: reviews, error: errorReviews } = await supabase
      .from("reviews")
      .select("*, restaurant:restaurants(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (errorReviews) {
      console.error("❌ Supabase error:", errorReviews);
      throw errorReviews;
    }

    return reviews ?? [];
  } catch (error) {
    console.error("❌ Error in fetchReviews:", error);
    throw error;
  }
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  // Use param id when viewing someone else's reviews; otherwise current user (e.g. from profile "My Reviews")
  const userId = (params.id ?? user?.id) as string | undefined;
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    const loadReviews = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchReviews(userId);
        setReviews(data ?? []);
      } catch (error) {
        console.error("❌ Error in loadReviews:", error);
        setReviews([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadReviews();
  }, [userId]);

  const renderStars = (rating: number) => {
    return Array(5)
      .fill(0)
      .map((_, index) => (
        <Star
          key={index}
          size={16}
          fill={index < rating ? "#FFD700" : "none"}
          color={index < rating ? "#FFD700" : isDark ? "#666" : "#D3D3D3"}
        />
      ));
  };

  if (isLoading) {
    return <ReviewsScreenSkeleton />;
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#000" : "#f5f5f5" },
      ]}
    >
      <BackHeader title="Your Reviews" />

      <ScrollView style={styles.content}>
        {reviews.length === 0 ? (
          <Text style={[styles.noReviews, { color: isDark ? "#999" : "#666" }]}>
            No reviews yet
          </Text>
        ) : (
          reviews.map((review) => (
            <Card
              key={review.id}
              style={[
                styles.reviewCard,
                { backgroundColor: isDark ? "#1a1a1a" : "#fff" },
              ]}
            >
              <Text
                style={[
                  styles.restaurantName,
                  { color: isDark ? "#fff" : "#111" },
                ]}
                numberOfLines={1}
              >
                {review.restaurant?.name ?? "Unknown restaurant"}
              </Text>
              <Text style={[styles.date, { color: isDark ? "#999" : "#666" }]}>
                {formatDateToDDMMYYYY(new Date(review.created_at))}
              </Text>
              <View style={styles.ratingContainer}>
                {renderStars(review.rating)}
              </View>
              {review.comment ? (
                <Text
                  style={[
                    styles.comment,
                    { color: isDark ? "#e5e5e5" : "#333" },
                  ]}
                >
                  {review.comment}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header styles removed in favor of BackHeader component
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    marginBottom: 8,
    opacity: 0.8,
  },
  ratingContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  comment: {
    fontSize: 15,
    lineHeight: 22,
  },
  noReviews: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 32,
  },
});
