import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

interface ReviewsActiveFiltersProps {
  selectedSort: string;
  selectedRating: string;
  filterOptions: { id: string; label: string }[];
  ratingFilterOptions: { id: string; label: string }[];
}

export const ReviewsActiveFilters: React.FC<ReviewsActiveFiltersProps> = ({
  selectedSort,
  selectedRating,
  filterOptions,
  ratingFilterOptions,
}) => {
  if (selectedSort === "recent" && selectedRating === "all") {
    return null;
  }

  return (
    <View className="flex-row items-center gap-2 mb-4">
      <Text className="text-sm text-muted-foreground">Filters:</Text>
      {selectedSort !== "recent" && (
        <View className="bg-primary/10 px-2 py-1 rounded-full">
          <Text className="text-primary text-xs font-medium">
            {filterOptions.find((o) => o.id === selectedSort)?.label}
          </Text>
        </View>
      )}
      {selectedRating !== "all" && (
        <View className="bg-primary/10 px-2 py-1 rounded-full">
          <Text className="text-primary text-xs font-medium">
            {ratingFilterOptions.find((o) => o.id === selectedRating)?.label}
          </Text>
        </View>
      )}
    </View>
  );
};
