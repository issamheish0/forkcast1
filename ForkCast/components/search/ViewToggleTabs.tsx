// components/search/ViewToggleTabs.tsx
import React from "react";
import { View, Pressable, Keyboard } from "react-native";
import { Map, List, MapPin } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";

export type ViewMode = "list" | "map";

interface ViewToggleTabsProps {
  viewMode: ViewMode;
  colorScheme: "light" | "dark";
  onViewModeChange: (mode: ViewMode) => void;
  restaurantCount?: number;
  onMapViewSelected?: () => void; // New prop for map view selection
}

export const ViewToggleTabs = ({
  viewMode,
  colorScheme,
  onViewModeChange,
  restaurantCount,
  onMapViewSelected,
}: ViewToggleTabsProps) => {
  const handleViewModeChange = React.useCallback(
    (mode: ViewMode) => {
      // Prevent unnecessary calls if already in the same mode
      if (mode === viewMode) return;

      onViewModeChange(mode);
      if (mode === "map" && onMapViewSelected) {
        // Use requestAnimationFrame for smoother transition
        requestAnimationFrame(() => {
          onMapViewSelected();
        });
      }
    },
    [viewMode, onViewModeChange, onMapViewSelected],
  );

  const themedColors = getThemedColors(colorScheme);

  const handleTabPress = React.useCallback(
    (mode: ViewMode) => {
      // Dismiss keyboard when switching tabs
      Keyboard.dismiss();
      handleViewModeChange(mode);
    },
    [handleViewModeChange],
  );

  return (
    <View className="bg-background border-b border-border mb-1.5">
      <View className="flex-row">
        {/* List View Tab */}
        <Pressable
          onPress={() => handleTabPress("list")}
          className={`flex-1 flex-row items-center justify-center gap-2 py-3 border-b-2 ${
            viewMode === "list"
              ? "border-primary bg-primary/5"
              : "border-transparent"
          }`}
        >
          <List
            size={18}
            color={
              viewMode === "list"
                ? themedColors.primary
                : themedColors.mutedForeground
            }
          />
          <Text
            className={`font-medium ${
              viewMode === "list" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            List
          </Text>
        </Pressable>

        {/* Map View Tab */}
        <Pressable
          onPress={() => handleTabPress("map")}
          className={`flex-1 flex-row items-center justify-center gap-2 py-3 border-b-2 ${
            viewMode === "map"
              ? "border-primary bg-primary/5"
              : "border-transparent"
          }`}
        >
          <MapPin
            size={18}
            color={
              viewMode === "map"
                ? themedColors.primary
                : themedColors.mutedForeground
            }
          />
          <Text
            className={`font-medium ${
              viewMode === "map" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Map
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
