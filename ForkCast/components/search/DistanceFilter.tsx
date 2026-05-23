// components/search/DistanceFilter.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { DISTANCE_FILTERS } from "@/constants/searchConstants";

interface DistanceFilterProps {
  selectedDistance: number | null;
  onDistanceChange: (distance: number | null) => void;
}

export const DistanceFilter: React.FC<DistanceFilterProps> = ({
  selectedDistance,
  onDistanceChange,
}) => {
  return (
    <View className="p-4 border-b border-border">
      <Text className="font-semibold mb-3">Distance</Text>
      <View className="gap-3">
        {DISTANCE_FILTERS.map((option) => (
          <Pressable
            key={option.label}
            onPress={() => onDistanceChange(option.value)}
            className="flex-row items-center gap-3"
          >
            <View
              className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selectedDistance === option.value
                  ? "border-primary bg-primary"
                  : "border-border"
              }`}
            >
              {selectedDistance === option.value && (
                <View className="w-2 h-2 rounded-full bg-white" />
              )}
            </View>
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};
