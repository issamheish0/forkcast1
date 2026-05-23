import React from "react";
import { View, Pressable } from "react-native";
import { Image } from "../image";
import { Text } from "@/components/ui/text";
import { useHapticPress } from "@/hooks/useHapticPress";
import { useNavigationModal } from "@/context/modal-provider";

interface CuisineItem {
  id: string;
  label: string;
  image: any;
  popular?: boolean;
}

interface CuisineCategoryProps {
  cuisine: CuisineItem;
  onPress: (cuisineId: string) => void;
}

function CuisineCategoryComponent({ cuisine, onPress }: CuisineCategoryProps) {
  const { handlePress: handleHapticPress } = useHapticPress({
    debounceMs: 500, // Longer debounce for navigation
    enableHaptic: true,
    enableDebounce: true,
  });

  const { openNavigationModal, isAnyModalOpen } = useNavigationModal();

  const handlePress = () => {
    handleHapticPress(() => {
      // Check if any modal is already open
      if (isAnyModalOpen) {
        return;
      }

      // Use navigation modal to prevent multiple modals
      openNavigationModal(`cuisine-${cuisine.id}`, () => {
        onPress(cuisine.id);
      });
    });
  };

  return (
    <Pressable onPress={handlePress} className="items-center">
      <View className="w-20 h-20 bg-muted rounded-full items-center justify-center mb-2 overflow-hidden">
        <Image
          source={cuisine.image}
          className="w-16 h-16 rounded-full"
          contentFit="cover"
          optimizationPreset="thumbnail"
        />
      </View>
      <Text className="text-sm font-medium">{cuisine.label}</Text>
    </Pressable>
  );
}

// Memoize to prevent re-renders when scrolling
export const CuisineCategory = React.memo(CuisineCategoryComponent);
