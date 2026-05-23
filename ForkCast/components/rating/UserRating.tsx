import React from "react";
import { View, Pressable } from "react-native";
import { Star, StarHalf } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface UserRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  showLabel?: boolean;
  interactive?: boolean;
  onPress?: () => void;
  className?: string;
}

export function UserRating({
  rating,
  size = "md",
  showNumber = true,
  showLabel = false,
  interactive = false,
  onPress,
  className,
}: UserRatingProps) {
  const sizes = {
    sm: { star: 12, text: "text-xs" },
    md: { star: 16, text: "text-sm" },
    lg: { star: 20, text: "text-base" },
  };

  const config = sizes[size];
  const roundedRating = Math.round(rating * 2) / 2; // Round to nearest 0.5

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        // Full star
        stars.push(
          <Star key={i} size={config.star} fill="#FFD700" color="#FFD700" />,
        );
      } else if (i - 0.5 <= roundedRating) {
        // Half star
        stars.push(
          <StarHalf
            key={i}
            size={config.star}
            fill="#FFD700"
            color="#FFD700"
          />,
        );
      } else {
        // Empty star
        stars.push(
          <Star
            key={i}
            size={config.star}
            fill="transparent"
            color="#E5E7EB"
          />,
        );
      }
    }
    return stars;
  };

  const getReliabilityLabel = (rating: number): string => {
    if (rating >= 4.5) return "Excellent";
    if (rating >= 4.0) return "Very Good";
    if (rating >= 3.5) return "Good";
    if (rating >= 3.0) return "Fair";
    return "Needs Improvement";
  };

  const getReliabilityColor = (rating: number): string => {
    if (rating >= 4.5) return "text-green-600";
    if (rating >= 4.0) return "text-blue-600";
    if (rating >= 3.5) return "text-yellow-600";
    if (rating >= 3.0) return "text-orange-600";
    return "text-red-600";
  };

  const Component = interactive ? Pressable : View;

  return (
    <Component
      onPress={interactive ? onPress : undefined}
      className={cn("flex-row items-center gap-1", className)}
    >
      <View className="flex-row items-center">{renderStars()}</View>

      {showNumber && (
        <Text className={cn("font-medium ml-1", config.text)}>
          {rating.toFixed(1)}
        </Text>
      )}

      {showLabel && (
        <Text
          className={cn(
            "font-medium ml-1",
            config.text,
            getReliabilityColor(rating),
          )}
        >
          {getReliabilityLabel(rating)}
        </Text>
      )}
    </Component>
  );
}
