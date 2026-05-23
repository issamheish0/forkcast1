import React from "react";
import { Modal, View, Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  SORT_OPTIONS,
  GROUP_OPTIONS,
  type SortBy,
  type GroupBy,
} from "@/hooks/useFavoritesFilters";

interface FavoritesFilterModalProps {
  visible: boolean;
  sortBy: SortBy;
  groupBy: GroupBy;
  onClose: () => void;
  onSortChange: (sortBy: SortBy) => void;
  onGroupChange: (groupBy: GroupBy) => void;
  onReset: () => void;
}

export const FavoritesFilterModal: React.FC<FavoritesFilterModalProps> = ({
  visible,
  sortBy,
  groupBy,
  onClose,
  onSortChange,
  onGroupChange,
  onReset,
}) => {
  const { colorScheme } = useColorScheme();

  const handleApply = async () => {
    onClose();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Pressable onPress={onClose} className="flex-row items-center gap-2">
            <X size={24} />
            <Text className="text-lg font-medium">Filters</Text>
          </Pressable>

          <Pressable onPress={onReset} className="px-3 py-1">
            <Text className="text-primary font-medium">Reset</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Sort Options Section */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold text-lg mb-4">Sort By</Text>
            <View className="gap-3">
              {SORT_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                const isSelected = sortBy === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => onSortChange(option.value)}
                    className={`flex-row items-center justify-between p-4 rounded-xl border ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <IconComponent
                        size={20}
                        color={
                          isSelected
                            ? colorScheme === "dark"
                              ? "#3b82f6"
                              : "#2563eb"
                            : "#666"
                        }
                      />
                      <Text
                        className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                        <Text className="text-primary-foreground text-xs">
                          ✓
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Group Options Section */}
          <View className="p-4">
            <Text className="font-semibold text-lg mb-4">Group By</Text>
            <View className="gap-3">
              {GROUP_OPTIONS.map((option) => {
                const isSelected = groupBy === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => onGroupChange(option.value)}
                    className={`flex-row items-center justify-between p-4 rounded-xl border ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                        <Text className="text-primary-foreground text-xs">
                          ✓
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View className="p-6 border-t border-border">
          <Button onPress={handleApply} className="w-full">
            <Text className="text-primary-foreground font-semibold">
              Apply Filters
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
