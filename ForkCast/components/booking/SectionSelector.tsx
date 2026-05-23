// components/booking/SectionSelector.tsx
import React, { memo, useState, useEffect } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
  interpolateColor,
} from "react-native-reanimated";
import { MapPin, ChevronDown, Check, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Database } from "@/types/supabase";
import type { SectionAvailabilityInfo } from "@/hooks/useSectionAvailability";

// Types
type RestaurantSection =
  Database["public"]["Tables"]["restaurant_sections"]["Row"];

interface SectionSelectorProps {
  sections: RestaurantSection[];
  selectedSectionId: string | null;
  onSectionSelect: (sectionId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  isInvalid?: boolean;
  sectionAvailability?: Map<string, SectionAvailabilityInfo>;
  availabilityLoading?: boolean;
  allSectionsFull?: boolean;
}

export const SectionSelector = memo<SectionSelectorProps>(
  ({
    sections,
    selectedSectionId,
    onSectionSelect,
    loading = false,
    disabled = false,
    isInvalid = false,
    sectionAvailability,
    availabilityLoading = false,
    allSectionsFull = false,
  }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Red glow animation
    const glowAnim = useSharedValue(0);

    useEffect(() => {
      if (isInvalid) {
        glowAnim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
        );
      } else {
        cancelAnimation(glowAnim);
        glowAnim.value = withTiming(0, { duration: 200 });
      }
    }, [isInvalid]);

    const glowStyle = useAnimatedStyle(() => {
      const borderColor = interpolateColor(
        glowAnim.value,
        [0, 1],
        ["rgba(220, 38, 38, 1)", "rgba(239, 68, 68, 1)"],
      );
      const shadowColor = interpolateColor(
        glowAnim.value,
        [0, 1],
        ["rgba(239, 68, 68, 0.2)", "rgba(239, 68, 68, 0.6)"],
      );
      return {
        borderColor,
        shadowColor,
      };
    });

    if (loading) {
      return (
        <View className="bg-card border border-border rounded-xl p-4 mb-4">
          <View className="flex-row items-center gap-3 mb-2">
            <MapPin size={20} color="#3b82f6" />
            <Text className="font-semibold text-base">Select Section</Text>
          </View>

          <View className="items-center justify-center py-4">
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="mt-2 text-muted-foreground text-sm">
              Loading sections...
            </Text>
          </View>
        </View>
      );
    }

    if (!sections || sections.length === 0) {
      return null; // Don't show anything if no sections available
    }

    const selectedSection = sections.find(
      (section) => section.id === selectedSectionId,
    );

    // Get availability info for the selected section
    const selectedSectionAvail = selectedSectionId
      ? sectionAvailability?.get(selectedSectionId)
      : undefined;

    const handleDropdownPress = () => {
      if (disabled) return;
      setIsDropdownOpen(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleSectionSelect = (sectionId: string) => {
      // Check if section is available before allowing selection
      if (sectionAvailability) {
        const avail = sectionAvailability.get(sectionId);
        if (avail && (!avail.has_matching_tables || avail.available_tables === 0)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return; // Don't allow selecting a full section
        }
      }
      onSectionSelect(sectionId);
      setIsDropdownOpen(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Helper to get availability label for a section
    const getAvailabilityLabel = (
      sectionId: string,
    ): { text: string; color: string } | null => {
      if (!sectionAvailability || availabilityLoading) return null;
      const avail = sectionAvailability.get(sectionId);
      if (!avail) return null;

      if (avail.total_tables === 0) {
        return {
          text: "No tables for this group size",
          color: "text-amber-600 dark:text-amber-400",
        };
      }
      if (avail.available_tables === 0) {
        return {
          text: "Full",
          color: "text-red-600 dark:text-red-400",
        };
      }
      return {
        text: "Available",
        color: "text-green-600 dark:text-green-400",
      };
    };

    // Check if a section is disabled (full or no matching tables)
    const isSectionDisabled = (sectionId: string): boolean => {
      if (!sectionAvailability) return false;
      const avail = sectionAvailability.get(sectionId);
      if (!avail) return false;
      return !avail.has_matching_tables || avail.available_tables === 0;
    };

    return (
      <>
        <Animated.View
          style={[
            {
              borderWidth: isInvalid ? 2 : 1,
              shadowOffset: isInvalid ? { width: 0, height: 0 } : undefined,
              shadowOpacity: isInvalid ? 1 : undefined,
              shadowRadius: isInvalid ? 8 : undefined,
              elevation: isInvalid ? 4 : undefined,
            },
            isInvalid ? glowStyle : {},
          ]}
          className={`bg-card ${!isInvalid ? "border border-border" : ""} rounded-xl p-4 mb-4 ${disabled ? "opacity-60" : ""}`}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <MapPin size={20} color={isInvalid ? "#ef4444" : "#3b82f6"} />
              <Text className="font-semibold text-base">Select Section</Text>
            </View>
            {availabilityLoading && (
              <ActivityIndicator size="small" color="#3b82f6" />
            )}
          </View>

          {/* All sections full warning */}
          {allSectionsFull && !availabilityLoading && (
            <View className="flex-row items-center gap-2 p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle size={16} color="#ef4444" />
              <Text className="text-sm text-red-700 dark:text-red-300 flex-1">
                All sections are full for this time and party size
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleDropdownPress}
            disabled={disabled}
            className={`border rounded-lg p-3 flex-row items-center justify-between ${
              !selectedSectionId
                ? "border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10"
                : "border-border"
            } ${disabled ? "opacity-50" : "active:bg-muted"}`}
          >
            <View className="flex-row items-center gap-3 flex-1">
              {selectedSection ? (
                <>
                  <View
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: selectedSection.color || "#3b82f6",
                    }}
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-base">
                      {selectedSection.name}
                    </Text>
                    {selectedSectionAvail && (
                      <Text
                        className={`text-xs ${getAvailabilityLabel(selectedSectionId!)?.color || "text-muted-foreground"}`}
                      >
                        {getAvailabilityLabel(selectedSectionId!)?.text}
                      </Text>
                    )}
                    {!selectedSectionAvail && selectedSection.description && (
                      <Text
                        className="text-sm text-muted-foreground"
                        numberOfLines={1}
                      >
                        {selectedSection.description}
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View className="w-4 h-4 rounded-full bg-amber-400 dark:bg-amber-500" />
                  <View className="flex-1">
                    <Text className="font-medium text-base text-amber-700 dark:text-amber-300">
                      Choose a section
                    </Text>
                    <Text className="text-sm text-amber-600/80 dark:text-amber-400/80">
                      Tap to select your preferred seating area
                    </Text>
                  </View>
                </>
              )}
            </View>
            <ChevronDown size={20} color="#6b7280" />
          </Pressable>
        </Animated.View>

        {/* Dropdown Modal */}
        <Modal
          visible={isDropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsDropdownOpen(false)}
        >
          <Pressable
            className="flex-1 bg-black/50 justify-center px-4"
            onPress={() => setIsDropdownOpen(false)}
          >
            <View className="bg-card border border-border rounded-xl p-4 max-h-96">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-semibold text-lg">Choose Section</Text>
                <Pressable
                  onPress={() => setIsDropdownOpen(false)}
                  className="p-1"
                >
                  <Text className="text-muted-foreground text-xl">×</Text>
                </Pressable>
              </View>

              <ScrollView
                className="max-h-80"
                showsVerticalScrollIndicator={false}
              >
                <View className="gap-2">
                  {sections.map((section) => {
                    const sectionDisabled = isSectionDisabled(section.id);
                    const availLabel = getAvailabilityLabel(section.id);
                    const isSelected = selectedSectionId === section.id;

                    return (
                      <Pressable
                        key={section.id}
                        onPress={() => handleSectionSelect(section.id)}
                        disabled={sectionDisabled}
                        className={`p-3 rounded-lg border ${
                          sectionDisabled
                            ? "border-border opacity-50 bg-muted/30"
                            : isSelected
                              ? "border-primary bg-primary/10"
                              : "border-border active:bg-muted"
                        }`}
                      >
                        <View className="flex-row items-center gap-3">
                          <View
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: sectionDisabled
                                ? "#9ca3af"
                                : section.color || "#3b82f6",
                            }}
                          />
                          <View className="flex-1">
                            <Text
                              className={`font-medium text-base ${sectionDisabled ? "text-muted-foreground" : ""}`}
                            >
                              {section.name}
                            </Text>
                            {availLabel && (
                              <Text
                                className={`text-xs mt-0.5 ${availLabel.color}`}
                              >
                                {availLabel.text}
                              </Text>
                            )}
                            {!availLabel && section.description && (
                              <Text
                                className="text-sm text-muted-foreground"
                                numberOfLines={2}
                              >
                                {section.description}
                              </Text>
                            )}
                          </View>
                          {isSelected && !sectionDisabled && (
                            <Check size={20} color="#3b82f6" />
                          )}
                          {sectionDisabled && (
                            <View className="bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5">
                              <Text className="text-xs font-medium text-red-600 dark:text-red-400">
                                {availLabel?.text === "Full"
                                  ? "Full"
                                  : "Unavailable"}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </>
    );
  },
);

SectionSelector.displayName = "SectionSelector";
