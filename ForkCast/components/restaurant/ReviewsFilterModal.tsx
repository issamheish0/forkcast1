import React from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { X, Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";

interface ReviewsFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSort: string;
  onSortChange: (sort: string) => void;
  selectedRating: string;
  onRatingChange: (rating: string) => void;
  filterOptions: { id: string; label: string }[];
  ratingFilterOptions: { id: string; label: string }[];
}

export const ReviewsFilterModal: React.FC<ReviewsFilterModalProps> = ({
  visible,
  onClose,
  selectedSort,
  onSortChange,
  selectedRating,
  onRatingChange,
  filterOptions,
  ratingFilterOptions,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <H3>Filter Reviews</H3>
          <Pressable onPress={onClose} className="p-2">
            <X size={24} />
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Sort Options */}
          <View className="mb-6">
            <Text className="font-semibold mb-3">Sort by</Text>
            {filterOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onSortChange(option.id)}
                className="flex-row items-center justify-between py-3 px-4 border border-border rounded-lg mb-2"
              >
                <Text
                  className={
                    selectedSort === option.id
                      ? "font-medium text-primary"
                      : "text-foreground"
                  }
                >
                  {option.label}
                </Text>
                {selectedSort === option.id && (
                  <Check size={20} color="#3b82f6" />
                )}
              </Pressable>
            ))}
          </View>

          {/* Rating Filter */}
          <View className="mb-6">
            <Text className="font-semibold mb-3">Filter by rating</Text>
            {ratingFilterOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onRatingChange(option.id)}
                className="flex-row items-center justify-between py-3 px-4 border border-border rounded-lg mb-2"
              >
                <Text
                  className={
                    selectedRating === option.id
                      ? "font-medium text-primary"
                      : "text-foreground"
                  }
                >
                  {option.label}
                </Text>
                {selectedRating === option.id && (
                  <Check size={20} color="#3b82f6" />
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
