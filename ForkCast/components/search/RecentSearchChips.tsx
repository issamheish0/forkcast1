// components/search/RecentSearchChips.tsx
import React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Clock, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import type { SearchHistoryItem } from "@/lib/searchHistory";

interface RecentSearchChipsProps {
  searchHistory: SearchHistoryItem[];
  onSelectSearch: (item: SearchHistoryItem) => void;
  onRemoveSearch: (id: string) => void;
  onClearAll?: () => void;
}

export const RecentSearchChips = ({
  searchHistory,
  onSelectSearch,
  onRemoveSearch,
  onClearAll,
}: RecentSearchChipsProps) => {
  if (searchHistory.length === 0) {
    return null;
  }

  const formatSearchDisplay = (item: SearchHistoryItem): string => {
    const parts: string[] = [];

    // Add query if it exists and is not empty
    if (item.query && item.query.trim()) {
      parts.push(item.query.trim());
    }

    // Add cuisine if it exists and is not empty
    if (item.filters?.cuisine && item.filters.cuisine.trim()) {
      parts.push(item.filters.cuisine.trim());
    }

    // Add price range if it exists and is valid
    if (item.filters?.priceRange) {
      const priceLevel = parseInt(item.filters.priceRange, 10);
      if (!isNaN(priceLevel) && priceLevel > 0) {
        const priceSymbols = "€".repeat(priceLevel);
        parts.push(priceSymbols);
      }
    }

    // Add rating if it exists and is valid
    if (item.filters?.rating) {
      const rating = parseFloat(item.filters.rating);
      if (!isNaN(rating) && rating > 0) {
        parts.push(`${item.filters.rating}★+`);
      }
    }

    // If no parts, just return the query or a placeholder
    return parts.length > 0 ? parts.join(" • ") : item.query || "Recent search";
  };

  return (
    <View className="px-4 py-3 bg-background border-b border-border">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Clock size={16} color="#666" />
          <Text className="text-sm font-medium text-muted-foreground">
            Recent Searches
          </Text>
        </View>
        {onClearAll && searchHistory.length > 0 && (
          <Pressable onPress={onClearAll} className="px-2 py-1">
            <Text className="text-xs text-primary font-medium">Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Search History Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerClassName="gap-2"
      >
        {searchHistory.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onSelectSearch(item)}
            className="flex-row items-center gap-2 bg-muted rounded-full px-3 py-2 border border-border active:bg-muted/80"
          >
            <Text
              className="text-sm text-foreground max-w-[200px]"
              numberOfLines={1}
            >
              {formatSearchDisplay(item)}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onRemoveSearch(item.id);
              }}
              className="ml-1 active:opacity-50"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color="#666" />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};
