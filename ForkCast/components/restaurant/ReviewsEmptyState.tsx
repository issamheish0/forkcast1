import React from "react";
import { View } from "react-native";
import { MessageSquare } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface ReviewsEmptyStateProps {
  hasFilters: boolean;
}

export const ReviewsEmptyState: React.FC<ReviewsEmptyStateProps> = ({
  hasFilters,
}) => {
  return (
    <View className="py-12 items-center">
      <MessageSquare size={48} color="#666" />
      <H3 className="mt-4 text-center">No Reviews Found</H3>
      <Text className="text-center text-muted-foreground mt-2 px-8">
        {hasFilters
          ? "Try adjusting your filters to see more reviews."
          : "Be the first to review this restaurant!"}
      </Text>
    </View>
  );
};
