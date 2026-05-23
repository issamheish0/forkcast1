import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useRestaurantVisitCount } from "@/hooks/useRestaurantVisitCount";

interface VisitCountBadgeProps {
  restaurantId: string | null | undefined;
  variant?: "default" | "compact" | "featured" | "minimal";
  className?: string;
}

/**
 * Badge component that displays how many times a user has visited a restaurant
 * Only shows when the user has at least one completed booking
 */
export const VisitCountBadge = React.memo(
  ({ restaurantId, variant = "default", className }: VisitCountBadgeProps) => {
    const { visitCount, loading } = useRestaurantVisitCount(restaurantId);

    // Don't render if loading or no visits
    if (loading || visitCount === 0) {
      return null;
    }

    // Determine size based on variant
    const isCompact = variant === "compact";
    const isFeatured = variant === "featured";
    const isMinimal = variant === "minimal";

    return (
      <View
        className={cn(
          "flex-row items-center rounded-full",
          isMinimal
            ? "bg-primary/5 px-1.5 py-0.5"
            : isCompact
              ? "bg-primary/10 px-1.5 py-0.5"
              : isFeatured
                ? "bg-primary/15 px-2.5 py-1"
                : "bg-primary/10 px-2 py-0.5",
          className,
        )}
      >
        <Text
          className={cn(
            "font-semibold text-primary",
            isMinimal
              ? "text-[8px]"
              : isCompact
                ? "text-[9px]"
                : isFeatured
                  ? "text-[11px]"
                  : "text-[10px]",
          )}
        >
          {isMinimal ? `${visitCount}x` : `🎉 Visited ${visitCount}x`}
        </Text>
      </View>
    );
  },
);

VisitCountBadge.displayName = "VisitCountBadge";
