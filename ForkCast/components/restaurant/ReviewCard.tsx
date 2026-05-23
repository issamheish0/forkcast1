import React, { useState, useEffect, memo } from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  ThumbsUp,
  MoreVertical,
  Calendar,
  MessageCircle,
  Reply,
  Flag,
  Check,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { Database } from "@/types/supabase";
import { useReviewReplies } from "@/hooks/useReviewReplies";
import { ReviewRepliesList } from "@/components/review/ReviewReply";
import {
  ReviewReplyComposer,
  ReviewReplyEdit,
} from "@/components/review/ReviewReplyComposer";
import { ReportReviewModal } from "@/components/review/ReportReviewModal";
import { useAuth } from "@/context/supabase-provider";
import { useReviewReports } from "@/hooks/useReviewReports";
import { useColorScheme } from "@/lib/useColorScheme";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

// Enhanced review type with all new fields
type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
};

interface ReviewCardProps {
  review: Review;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onLike?: () => void;
  showActions?: boolean;
  variant?: "default" | "compact";
  showReplyComposer?: boolean;
  restaurantId?: string;
}

const ReviewCardComponent: React.FC<ReviewCardProps> = ({
  review,
  isOwner = false,
  onEdit,
  onDelete,
  onLike,
  showActions = true,
  variant = "default",
  showReplyComposer = false,
  restaurantId,
}) => {
  const [showFullReview, setShowFullReview] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showReplies, setShowReplies] = useState(true); // Show replies by default
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { isAlreadyReported, checkIfReported } = useReviewReports();
  const isDark = colorScheme === "dark";

  // Check if current user is the review owner
  const isCurrentUserOwner = profile?.id === review.user_id || isOwner;

  // Check if this review has already been reported by current user
  const isReported = isAlreadyReported(review.id);

  // Check reported status when component mounts or review changes
  useEffect(() => {
    if (profile?.id && review.id) {
      checkIfReported(review.id);
    }
  }, [profile?.id, review.id]);

  const {
    replies,
    loading,
    submitting,
    createReply,
    deleteReply,
    updateReply,
  } = useReviewReplies({ reviewId: review.id });

  const isLongReview = review.comment && review.comment.length > 150;
  const displayComment =
    showFullReview || !isLongReview
      ? review.comment
      : `${review.comment?.substring(0, 150)}...`;

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return formatDateToDDMMYYYY(date);
  };

  const handleReplySubmit = async (replyMessage: string): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      await createReply(review.id, replyMessage);
      setShowReplyModal(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleReplyEdit = (replyId: string, currentMessage: string) => {
    // This will be called when the edit button is pressed
    setIsEditingReply(true);
    // You can add logic here to show an edit modal or inline editor
  };

  const handleReplyDelete = async (replyId: string) => {
    try {
      await deleteReply(replyId);
    } catch {
      // Error handled by hook
    }
  };

  const handleReportSubmitted = () => {
    // The hook will automatically update the isReported state
  };

  const renderStars = (rating: number, size: number = 16) => {
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

  const renderDetailedRatings = () => {
    const ratings = [
      { label: "Food", value: review.food_rating },
      { label: "Service", value: review.service_rating },
      { label: "Ambiance", value: review.ambiance_rating },
      { label: "Value", value: review.value_rating },
    ].filter((r) => r.value && r.value > 0);

    if (ratings.length === 0) return null;

    return (
      <View className="mt-3 p-3 bg-muted/20 rounded-lg">
        <View className="flex-row flex-wrap gap-4">
          {ratings.map((rating) => (
            <View key={rating.label} className="flex-1 min-w-[70px]">
              <Text className="text-xs text-muted-foreground mb-1">
                {rating.label}
              </Text>
              {renderStars(rating.value!, 12)}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const openOwnerActions = () => {
    if (!showActions || !isCurrentUserOwner) return;

    const buttons = [
      onEdit
        ? {
            text: "Edit",
            onPress: () => onEdit?.(),
          }
        : undefined,
      onDelete
        ? {
            text: "Delete",
            style: "destructive" as const,
            onPress: () => {
              Alert.alert("Delete review?", "This action cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => onDelete?.(),
                },
              ]);
            },
          }
        : undefined,
      { text: "Cancel", style: "cancel" as const },
    ].filter(Boolean) as { text: string; onPress?: () => void; style?: any }[];

    Alert.alert("Review options", undefined, buttons);
  };

  return (
    <View className="bg-card border border-border rounded-lg p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-2">
        <Pressable
          className="flex-row items-center flex-1"
          onPress={() => router.push(`/social/profile/${review.user_id}`)}
        >
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
            {review.user.avatar_url ? (
              <Image
                source={{ uri: review.user.avatar_url }}
                className="w-10 h-10 rounded-full"
                contentFit="cover"
                optimizationPreset="thumbnail"
              />
            ) : (
              <Text className="text-primary font-semibold">
                {review?.user?.full_name?.charAt(0)?.toUpperCase()}
              </Text>
            )}
          </View>

          <View className="flex-1">
            <Text className="font-semibold text-sm">
              {review?.user?.full_name}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              {renderStars(review.rating)}
              <Muted className="text-xs">{formatDate(review.created_at)}</Muted>
            </View>
          </View>
        </Pressable>

        {showActions && isCurrentUserOwner && (
          <Pressable className="p-1" onPress={openOwnerActions}>
            <MoreVertical size={16} color="#666" />
          </Pressable>
        )}
      </View>

      {/* Review Content */}
      {review.comment && (
        <P className="text-sm leading-5 mb-3">{review.comment}</P>
      )}

      {/* Detailed Ratings */}
      {renderDetailedRatings()}

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {review.tags.map((tag, index) => (
            <View key={index} className="bg-primary/10 px-2 py-1 rounded-full">
              <Text className="text-xs text-primary font-medium">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <View className="mt-3">
          <View className="flex-row gap-2">
            {review.photos
              .slice(0, variant === "compact" ? 3 : 4)
              .map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  className={
                    variant === "compact"
                      ? "w-20 h-20 rounded-lg"
                      : "w-16 h-16 rounded-lg flex-1"
                  }
                  contentFit="cover"
                  optimizationPreset="medium"
                />
              ))}
            {review.photos.length > (variant === "compact" ? 3 : 4) && (
              <View
                className={
                  variant === "compact"
                    ? "w-20 h-20 rounded-lg bg-muted items-center justify-center"
                    : "w-16 h-16 rounded-lg bg-muted items-center justify-center"
                }
              >
                <Text className="text-xs text-muted-foreground">
                  +{review.photos.length - (variant === "compact" ? 3 : 4)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Footer with recommendations */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
        <View className="flex-row gap-4">
          {review.recommend_to_friend && (
            <View className="flex-row items-center gap-1">
              <ThumbsUp size={14} color="#10b981" />
              <Text className="text-xs text-green-600">
                {variant === "compact" ? "Recommends" : "Recommends to friends"}
              </Text>
            </View>
          )}
          {review.visit_again && (
            <View className="flex-row items-center gap-1">
              <Calendar size={12} color="#3b82f6" />
              <Text className="text-xs text-blue-600">
                {variant === "compact"
                  ? "Would visit again"
                  : "Will visit again"}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {/* View/Hide replies toggle - only show if there are replies */}
          {replies.length > 0 && (
            <Pressable
              onPress={() => setShowReplies(!showReplies)}
              className="flex-row items-center gap-1"
            >
              <MessageCircle size={14} color="#6366f1" />
              <Text className="text-xs text-indigo-600 font-medium">
                {showReplies ? "Hide" : "Show"} {replies.length}{" "}
                {replies.length === 1 ? "reply" : "replies"}
              </Text>
            </Pressable>
          )}

          {/* Reply button for restaurant owners */}
          {showReplyComposer &&
            !replies.some((reply) => reply.restaurant_id === restaurantId) && (
              <Pressable
                onPress={() => setShowReplyModal(true)}
                className="flex-row items-center gap-1"
              >
                <Reply size={14} color="#6366f1" />
                <Text className="text-xs text-indigo-600">Reply</Text>
              </Pressable>
            )}

          {/* Report button: show different states based on report status */}
          {showActions &&
            !isCurrentUserOwner &&
            (isReported ? (
              <View className="flex-row items-center gap-1 bg-green-50 px-2 py-1 rounded opacity-60">
                <Check size={14} color="#10b981" />
                <Text className="text-xs text-green-600 font-medium">
                  Reported
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowReportModal(true)}
                className="flex-row items-center gap-1 bg-red-50 px-2 py-1 rounded active:opacity-70"
              >
                <Flag size={14} color="#ef4444" />
                <Text className="text-xs text-red-500 font-medium">Report</Text>
              </Pressable>
            ))}
        </View>
      </View>

      {/* Replies Section */}
      {showReplies && replies.length > 0 && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <ReviewRepliesList
            replies={replies}
            onEditReply={showReplyComposer ? handleReplyEdit : undefined}
            onDeleteReply={showReplyComposer ? handleReplyDelete : undefined}
            loading={loading}
          />
        </View>
      )}

      {/* Reply Composer Modal */}
      {showReplyModal && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <ReviewReplyComposer
            onSubmit={handleReplySubmit}
            onCancel={() => setShowReplyModal(false)}
            isSubmitting={submitting}
          />
        </View>
      )}

      {/* Report Review Modal */}
      {showReportModal && (
        <ReportReviewModal
          reviewId={review.id}
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={handleReportSubmitted}
        />
      )}
    </View>
  );
};

// Memoize to prevent unnecessary re-renders in lists
export const ReviewCard = memo(ReviewCardComponent);
