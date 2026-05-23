// components/search/SearchHeader.tsx
import React, { useRef, useCallback } from "react";
import { View, Pressable, TextInput, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Search as SearchIcon, Filter, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { LocationDisplay } from "./LocationDisplay";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

interface SearchHeaderProps {
  searchQuery: string;
  bookingFilters: BookingFilters;
  activeFilterCount: number;
  colorScheme: "light" | "dark";
  isCollapsed?: boolean;
  isSearching?: boolean;
  focusSignal?: string | null;
  onSearchChange: (query: string) => void;
  onShowDatePicker: () => void;
  onShowTimePicker: () => void;
  onShowPartySizePicker: () => void;
  onShowGeneralFilters: () => void;
}

export const SearchHeader = ({
  searchQuery,
  bookingFilters,
  activeFilterCount,
  colorScheme,
  isCollapsed = false,
  isSearching = false,
  focusSignal = null,
  onSearchChange,
  onShowDatePicker,
  onShowTimePicker,
  onShowPartySizePicker,
  onShowGeneralFilters,
}: SearchHeaderProps) => {
  // Separate animations for better performance
  const animatedHeight = useSharedValue(1);
  const animatedTransform = useSharedValue(1);

  const searchInputRef = useRef<TextInput>(null);
  const placeholderColor = colorScheme === "dark" ? "#aaaaaa" : "#666666";
  const inputTextColor = colorScheme === "dark" ? "#f4f4f5" : "#1f1f1f";
  const searchIconColor = colorScheme === "dark" ? "#f4f4f5" : "#000000";
  const filterButtonBackground =
    colorScheme === "dark"
      ? "bg-white/10 border border-white/30"
      : "bg-primary";
  const filterIconColor = "#ffffff";
  const filterBadgeBackground =
    colorScheme === "dark" ? "bg-primary" : "bg-white";
  const filterBadgeTextColor =
    colorScheme === "dark" ? "text-white" : "text-primary";

  React.useEffect(() => {
    if (focusSignal) {
      // Use InteractionManager to wait for navigation transition to complete,
      // then retry focusing with increasing delays
      const tryFocus = (attempt: number) => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        } else if (attempt < 20) {
          setTimeout(() => tryFocus(attempt + 1), 150);
        }
      };

      // Wait longer initially to let native tab transition fully complete
      const focusTimeout = setTimeout(() => tryFocus(0), 300);

      return () => {
        clearTimeout(focusTimeout);
      };
    }
  }, [focusSignal]);

  React.useEffect(() => {
    animatedHeight.value = withTiming(isCollapsed ? 0 : 1, { duration: 200 });
    animatedTransform.value = withTiming(isCollapsed ? 0 : 1, {
      duration: 200,
    });
  }, [isCollapsed]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    onSearchChange("");
    searchInputRef.current?.blur();
  }, [onSearchChange]);

  return (
    <View
      className="bg-background border-b border-border"
      style={{ zIndex: 50, elevation: 50 }}
    >
      {/* Always visible: Location + Filter */}
      <View className="p-4">
        {/* Location Header */}
        <View className="flex-row items-center justify-between mb-3">
          <LocationDisplay />
        </View>

        {/* Search Input - Full Width */}
        <View className="flex-row items-center  rounded-full border border-border py-2 active:opacity-75">
          <View className="ml-4 w-9 h-9 rounded-full items-center justify-center">
            {isSearching ? (
              <ActivityIndicator size="small" color={searchIconColor} />
            ) : (
              <SearchIcon size={18} color={searchIconColor} />
            )}
          </View>
          <TextInput
            ref={searchInputRef}
            key={focusSignal || 'search-input'}
            autoFocus={!!focusSignal}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search restaurants, cuisines..."
            placeholderTextColor={placeholderColor}
            style={{
              flex: 1,
              marginLeft: 12,
              fontSize: 15,
              fontWeight: "500",
              color: inputTextColor,
            }}
            returnKeyType="search"
            autoCorrect={false}
            autoComplete="off"
          />
          <Pressable
            onPress={onShowGeneralFilters}
            className={`ml-2 mr-2 px-3 py-2 rounded-full flex-row items-center gap-2 active:opacity-80 ${filterButtonBackground}`}
          >
            <Filter size={18} color={filterIconColor} />
            {activeFilterCount > 0 && (
              <View
                className={`${filterBadgeBackground} rounded-full px-2 py-0.5`}
              >
                <Text className={`text-xs font-medium ${filterBadgeTextColor}`}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch} className="ml-2 mr-3">
              <X size={18} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Collapsible Content: Booking Filters */}
    </View>
  );
};
