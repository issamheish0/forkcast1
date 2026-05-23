import React from "react";
import { View } from "react-native";
import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface UserRatingBadgeProps {
  rating: number;
  trend?: "improving" | "declining" | "stable" | "new";
  compact?: boolean;
  className?: string;
}

export function UserRatingBadge({
  rating,
  trend,
  compact = false,
  className,
}: UserRatingBadgeProps) {
  const getBadgeColor = (rating: number): string => {
    if (rating >= 4.5) return "bg-green-100 border-green-200";
    if (rating >= 4.0) return "bg-blue-100 border-blue-200";
    if (rating >= 3.5) return "bg-yellow-100 border-yellow-200";
    if (rating >= 3.0) return "bg-orange-100 border-orange-200";
    return "bg-red-100 border-red-200";
  };

  const getTextColor = (rating: number): string => {
    if (rating >= 4.5) return "text-green-700";
    if (rating >= 4.0) return "text-blue-700";
    if (rating >= 3.5) return "text-yellow-700";
    if (rating >= 3.0) return "text-orange-700";
    return "text-red-700";
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "improving":
        return <TrendingUp size={12} color="#10b981" />;
      case "declining":
        return <TrendingDown size={12} color="#ef4444" />;
      case "stable":
        return <Minus size={12} color="#6b7280" />;
      default:
        return null;
    }
  };

  return (
    <View
      className={cn(
        "flex-row items-center border rounded-full",
        compact ? "px-2 py-1" : "px-3 py-1.5",
        getBadgeColor(rating),
        className,
      )}
    >
      <Star size={compact ? 10 : 12} fill="#FFD700" color="#FFD700" />
      <Text
        className={cn(
          "font-semibold ml-1",
          compact ? "text-xs" : "text-sm",
          getTextColor(rating),
        )}
      >
        {rating.toFixed(1)}
      </Text>
      {trend && getTrendIcon()}
    </View>
  );
}
