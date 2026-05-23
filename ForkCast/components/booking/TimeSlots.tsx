// components/booking/TimeSlots.tsx (Optimized Components)
import React, { memo, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing as REasing,
  interpolateColor,
} from "react-native-reanimated";
import {
  Clock,
  Wifi,
  CheckCircle,
  Sparkles,
  Users,
  Crown,
  TreePine,
  Utensils,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AvailabilityService,
  TimeSlotBasic,
  SlotTableOptions,
  TableOption,
} from "@/lib/AvailabilityService";
import { formatTime } from "@/utils/timeFormat";

// Form data interface
export interface SpecialRequirementsFormData {
  specialRequests: string;
  occasion: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
}

// Constants for form options
const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut Allergies",
  "Halal",
];

const TABLE_PREFERENCES = [
  "Booth",
  "Window Seat",
  "Patio/Outdoor",
  "Bar Seating",
  "Quiet Area",
  "Near Kitchen",
];

const OCCASIONS = [
  { id: "date", label: "Date Night" },
  { id: "business", label: "Business Meal" },
  { id: "birthday", label: "Birthday" },
  { id: "anniversary", label: "Anniversary" },
  { id: "celebration", label: "Celebration" },
  { id: "casual", label: "Casual Dining" },
  { id: "other", label: "Other" },
];

// Special Requirements Form Component
const SpecialRequirementsForm = memo<{
  formData: SpecialRequirementsFormData;
  onFormDataChange: (data: SpecialRequirementsFormData) => void;
  onComplete: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isBasicTier?: boolean;
}>(
  ({
    formData,
    onFormDataChange,
    onComplete,
    isExpanded,
    onToggleExpanded,
    isBasicTier = false,
  }) => {
    const toggleDietaryRestriction = useCallback(
      (restriction: string) => {
        const updatedRestrictions = formData.dietaryRestrictions.includes(
          restriction,
        )
          ? formData.dietaryRestrictions.filter((r) => r !== restriction)
          : [...formData.dietaryRestrictions, restriction];
        onFormDataChange({
          ...formData,
          dietaryRestrictions: updatedRestrictions,
        });
      },
      [formData, onFormDataChange],
    );

    const toggleTablePreference = useCallback(
      (preference: string) => {
        const updatedPreferences = formData.tablePreferences.includes(
          preference,
        )
          ? formData.tablePreferences.filter((p) => p !== preference)
          : [...formData.tablePreferences, preference];
        onFormDataChange({
          ...formData,
          tablePreferences: updatedPreferences,
        });
      },
      [formData, onFormDataChange],
    );

    const setOccasion = useCallback(
      (occasionId: string) => {
        onFormDataChange({
          ...formData,
          occasion: occasionId,
        });
      },
      [formData, onFormDataChange],
    );

    const setSpecialRequests = useCallback(
      (requests: string) => {
        onFormDataChange({
          ...formData,
          specialRequests: requests,
        });
      },
      [formData, onFormDataChange],
    );

    return (
      <View className="mt-4 bg-card border border-border rounded-xl p-4">
        {/* Header */}
        <Pressable
          onPress={onToggleExpanded}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2">
            <User size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Special Requirements</Text>
            <Text className="text-sm text-muted-foreground">(Optional)</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color="#3b82f6" />
          ) : (
            <ChevronDown size={20} color="#3b82f6" />
          )}
        </Pressable>

        {isExpanded && (
          <View className="mt-4 space-y-6">
            {/* Occasion Selection */}
            <View>
              <Text className="font-medium text-foreground mb-3">Occasion</Text>
              <View className="flex-row flex-wrap gap-2">
                {OCCASIONS.map((occasion) => (
                  <Pressable
                    key={occasion.id}
                    onPress={() => setOccasion(occasion.id)}
                    className={`px-3 py-2 rounded-full border ${
                      formData.occasion === occasion.id
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        formData.occasion === occasion.id
                          ? "text-white font-medium"
                          : "text-foreground"
                      }`}
                    >
                      {occasion.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Dietary Restrictions */}
            <View>
              <Text className="font-medium text-foreground mb-3">
                Dietary Restrictions
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DIETARY_RESTRICTIONS.map((restriction) => (
                  <Pressable
                    key={restriction}
                    onPress={() => toggleDietaryRestriction(restriction)}
                    className={`px-3 py-2 rounded-full border ${
                      formData.dietaryRestrictions.includes(restriction)
                        ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        formData.dietaryRestrictions.includes(restriction)
                          ? "text-green-800 dark:text-green-300 font-medium"
                          : "text-foreground"
                      }`}
                    >
                      {restriction}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Table Preferences */}
            <View>
              <Text className="font-medium text-foreground mb-3">
                Table Preferences
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TABLE_PREFERENCES.map((preference) => (
                  <Pressable
                    key={preference}
                    onPress={() => toggleTablePreference(preference)}
                    className={`px-3 py-2 rounded-full border ${
                      formData.tablePreferences.includes(preference)
                        ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        formData.tablePreferences.includes(preference)
                          ? "text-blue-800 dark:text-blue-300 font-medium"
                          : "text-foreground"
                      }`}
                    >
                      {preference}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Special Requests */}
            <View>
              <Text className="font-medium text-foreground mb-3">
                Special Requests
              </Text>
              <Textarea
                placeholder="Any special requests or notes for the restaurant..."
                value={formData.specialRequests}
                onChangeText={setSpecialRequests}
                className="min-h-[80px]"
                maxLength={500}
                label=""
              />
              <Text className="text-xs text-muted-foreground mt-1">
                {formData.specialRequests.length}/500 characters
              </Text>
            </View>

            {/* Complete Button - Hidden for basic tier */}
            {!isBasicTier && (
              <Button onPress={onComplete} size="lg" className="w-full">
                <View className="flex-row items-center justify-center gap-2">
                  <CheckCircle size={20} color="white" />
                  <Text className="text-white font-bold">
                    Continue to Table Selection
                  </Text>
                </View>
              </Button>
            )}
          </View>
        )}
      </View>
    );
  },
);

// Optimized skeleton components
const TimeSlotSkeleton = memo(() => (
  <View className="px-4 py-3 rounded-lg bg-muted/50 min-w-[80px] items-center">
    <View className="w-12 h-4 bg-muted rounded mb-1" />
    <View className="w-8 h-3 bg-muted rounded" />
  </View>
));

const TimeSlotSkeletonGrid = memo(() => (
  <View className="flex-row flex-wrap gap-3">
    {Array.from({ length: 8 }, (_, i) => (
      <TimeSlotSkeleton key={i} />
    ))}
  </View>
));

// Optimized individual time slot
const TimeSlotItem = memo<{
  slot: TimeSlotBasic;
  isSelected: boolean;
  onPress: (time: string) => void;
}>(({ slot, isSelected, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(slot.time);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [slot.time, onPress]);

  const isWaitlist = slot.isWaitlistTime;

  // Format time according to device settings
  const displayTime = useMemo(() => formatTime(slot.time), [slot.time]);

  return (
    <Pressable
      onPress={handlePress}
      className={`py-3 rounded-lg items-center border-2 relative ${
        isSelected
          ? isWaitlist
            ? "bg-amber-500 border-amber-500"
            : "bg-primary border-primary"
          : isWaitlist
            ? "bg-amber-50 border-amber-200"
            : "bg-muted border-border"
      }`}
    >
      <Text
        className={`font-semibold text-xs ${
          isSelected
            ? isWaitlist
              ? "text-white"
              : "text-primary-foreground"
            : isWaitlist
              ? "text-amber-700"
              : "text-foreground"
        }`}
      >
        {displayTime}
      </Text>
      {isWaitlist && (
        <Text
          className={`text-xs mt-0.5 ${
            isSelected ? "text-white" : "text-amber-600"
          }`}
        >
          Waitlist
        </Text>
      )}
    </Pressable>
  );
});

// Main TimeSlots component with optimizations
export const TimeSlots = memo<{
  slots: TimeSlotBasic[];
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  loading: boolean;
  showLiveIndicator?: boolean;
  error?: string | null;
  onFormComplete?: (formData: SpecialRequirementsFormData) => void;
  showRequirementsForm?: boolean;
  isBasicTier?: boolean;
  isInvalid?: boolean;
}>(
  ({
    slots,
    selectedTime,
    onTimeSelect,
    loading,
    showLiveIndicator = false,
    error,
    onFormComplete,
    showRequirementsForm = true,
    isBasicTier = false,
    isInvalid = false,
  }) => {
    // Form state
    const [formData, setFormData] = useState<SpecialRequirementsFormData>({
      specialRequests: "",
      occasion: "",
      dietaryRestrictions: [],
      tablePreferences: [],
    });
    const [isFormExpanded, setIsFormExpanded] = useState(false);
    const [isFormCompleted, setIsFormCompleted] = useState(false);

    // Red glow animation
    const glowAnim = useSharedValue(0);

    React.useEffect(() => {
      if (isInvalid) {
        glowAnim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600, easing: REasing.inOut(REasing.ease) }),
            withTiming(0, { duration: 600, easing: REasing.inOut(REasing.ease) }),
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

    // Auto-expand form when time is selected
    React.useEffect(() => {
      if (selectedTime && showRequirementsForm && !isFormCompleted) {
        setIsFormExpanded(true);
      }
    }, [selectedTime, showRequirementsForm, isFormCompleted]);

    const handleFormComplete = useCallback(() => {
      setIsFormCompleted(true);
      setIsFormExpanded(false);
      onFormComplete?.(formData);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [formData, onFormComplete]);

    const handleFormDataChange = useCallback(
      (newFormData: SpecialRequirementsFormData) => {
        setFormData(newFormData);
        // Auto-save for basic tier (no button to click)
        if (isBasicTier && onFormComplete) {
          onFormComplete(newFormData);
        }
      },
      [isBasicTier, onFormComplete],
    );
    // Memoize slots processing
    const processedSlots = useMemo(() => {
      if (!slots || slots.length === 0) return [];

      // Sort slots by time for better UX
      return [...slots].sort((a, b) => a.time.localeCompare(b.time));
    }, [slots]);

    if (error) {
      // Detect closure errors - any error that's not a generic "Failed to load" message
      const isClosureError =
        error &&
        (!error.includes("Failed to load") ||
          error.includes("Sold Out") ||
          error.includes("Closed") ||
          error.includes("closed") ||
          error.toLowerCase().includes("renovation") ||
          error.toLowerCase().includes("holiday") ||
          !error.startsWith("Failed"));

      return (
        <View className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Available Times</Text>
          </View>
          <View className="items-center py-8">
            {isClosureError ? (
              // Show closure reason with orange styling
              <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800 w-full">
                <View className="flex-row items-start gap-3">
                  <Clock
                    size={20}
                    color="#f97316"
                    className="mt-0.5 flex-shrink-0"
                  />
                  <View className="flex-1">
                    <Text className="font-semibold text-orange-800 dark:text-orange-200 mb-2 text-center">
                      Restaurant Closed
                    </Text>
                    <Text className="text-orange-700 dark:text-orange-300 text-center font-medium">
                      {error}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              // Show generic error with red styling
              <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800 w-full">
                <Text className="text-red-600 dark:text-red-400 text-center font-medium">
                  {error}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    if (loading) {
      return (
        <View className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Available Times</Text>
            {showLiveIndicator && (
              <View className="bg-blue-100 dark:bg-blue-900/20 rounded-full px-2 py-1 ml-auto">
                <View className="flex-row items-center gap-1">
                  <Wifi size={12} color="#3b82f6" />
                  <Text className="text-xs text-blue-600 dark:text-blue-400">
                    Live
                  </Text>
                </View>
              </View>
            )}
          </View>
          <TimeSlotSkeletonGrid />
        </View>
      );
    }

    if (processedSlots.length === 0) {
      // If no slots and no error, but we're not loading, show enhanced message
      if (!loading && !error) {
        // Show a more helpful message that hints at closure
        return (
          <View className="bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-center gap-3 mb-3">
              <Clock size={20} color="#3b82f6" />
              <Text className="font-semibold text-lg">Available Times</Text>
            </View>
            <View className="items-center py-8">
              <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800 w-full">
                <Text className="text-yellow-800 dark:text-yellow-200 text-center font-medium">
                  No available times for this date and party size.
                </Text>
                <Text className="text-sm text-yellow-600 dark:text-yellow-400 text-center mt-2">
                  Restaurant may be closed or fully booked.
                </Text>
                <Text className="text-sm text-yellow-600 dark:text-yellow-400 text-center mt-1">
                  Try selecting a different date or smaller party size.
                </Text>
              </View>
            </View>
          </View>
        );
      }

      return (
        <View className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Available Times</Text>
          </View>
          <View className="items-center py-8">
            <Text className="text-muted-foreground text-center">
              No available times for this date and party size.
            </Text>
            <Text className="text-sm text-muted-foreground text-center mt-1">
              Try selecting a different date or smaller party size.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <ReanimatedAnimated.View
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
        className={`bg-card ${!isInvalid ? "border border-border" : ""} rounded-xl p-4`}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Clock size={20} color={isInvalid ? "#ef4444" : "#3b82f6"} />
            <Text className="font-semibold text-base">Available Times</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-4">
          {processedSlots.map((slot, index) => {
            const totalItems = processedSlots.length;
            const itemsInLastRow = totalItems % 3;
            const isLastRow = index >= totalItems - itemsInLastRow;
            const isLastRowWithOneItem = isLastRow && itemsInLastRow === 1;
            const isLastRowWithTwoItems = isLastRow && itemsInLastRow === 2;

            // Calculate width based on position - 3 slots per row
            let itemWidth = "30%"; // Default width for 3-column layout
            if (isLastRowWithOneItem) {
              itemWidth = "30%"; // One item in last row
            } else if (isLastRowWithTwoItems) {
              itemWidth = "30%"; // Two items in last row
            }

            return (
              <View
                key={slot.time}
                style={{
                  width: itemWidth as any,
                  marginBottom: 16,
                }}
              >
                <TimeSlotItem
                  slot={slot}
                  isSelected={selectedTime === slot.time}
                  onPress={onTimeSelect}
                />
              </View>
            );
          })}
        </View>

        {/* Special Requirements Form */}
        {selectedTime && showRequirementsForm && (
          <SpecialRequirementsForm
            formData={formData}
            onFormDataChange={handleFormDataChange}
            onComplete={handleFormComplete}
            isExpanded={isFormExpanded}
            onToggleExpanded={() => setIsFormExpanded(!isFormExpanded)}
            isBasicTier={isBasicTier}
          />
        )}

        {/* Form completion indicator */}
        {selectedTime && isFormCompleted && (
          <View className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={16} color="#3b82f6" />
              <Text className="text-sm text-blue-800 dark:text-blue-200">
                Requirements saved. Ready to select table experience.
              </Text>
            </View>
          </View>
        )}
      </ReanimatedAnimated.View>
    );
  },
);

// Skeleton for table options
const TableOptionSkeleton = memo(() => (
  <View className="p-4 rounded-xl border border-border bg-card">
    <View className="flex-row items-center gap-2 mb-3">
      <View className="w-8 h-8 bg-muted rounded-full" />
      <View className="w-32 h-5 bg-muted rounded" />
    </View>
    <View className="w-full h-4 bg-muted rounded mb-3" />
    <View className="w-3/4 h-4 bg-muted rounded mb-3" />
    <View className="flex-row justify-between">
      <View className="w-20 h-4 bg-muted rounded" />
      <View className="w-16 h-6 bg-muted rounded" />
    </View>
  </View>
));

// components/booking/TimeSlots.tsx (Updated TableOptions component section)
// This replaces the existing TableOptions component in your TimeSlots.tsx file

// Main TableOptions component with double-click prevention
export const TableOptions = memo<{
  slotOptions: SlotTableOptions | null;
  onConfirm: (tableIds: string[], selectedOption: TableOption) => void;
  onBack?: () => void;
  loading: boolean;
  isConfirming?: boolean;
}>(({ slotOptions, onConfirm, loading, isConfirming = false }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConfirmRef = useRef<number>(0);

  // Reset selection when options change
  React.useEffect(() => {
    setSelectedOptionIndex(0);
    setIsProcessing(false);
  }, [slotOptions?.time]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  const handleOptionSelect = useCallback(
    (index: number) => {
      if (isProcessing || isConfirming) {
        return;
      }
      setSelectedOptionIndex(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [isProcessing, isConfirming],
  );

  const handleConfirm = useCallback(() => {
    // Prevent double-clicks
    const now = Date.now();
    if (now - lastConfirmRef.current < 2000) {
      return;
    }
    lastConfirmRef.current = now;

    if (!slotOptions?.options?.[selectedOptionIndex]) {
      console.error("No option selected");
      return;
    }

    if (isProcessing || isConfirming) {
      return;
    }

    const selectedOption = slotOptions.options[selectedOptionIndex];
    const tableIds = selectedOption.tables.map((t) => t.id);

    // Set local processing state
    setIsProcessing(true);

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Call the confirm handler
    onConfirm(tableIds, selectedOption);

    // Reset processing state after a delay (in case the parent doesn't update isConfirming)
    confirmTimeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
    }, 5000);
  }, [slotOptions, selectedOptionIndex, onConfirm, isProcessing, isConfirming]);

  if (loading) {
    return (
      <View>
        <Text className="font-semibold text-sm mb-3">Select Section</Text>
        <View className="gap-3">
          <TableOptionSkeleton />
          <TableOptionSkeleton />
        </View>
      </View>
    );
  }

  if (!slotOptions) {
    return (
      <View className="items-center py-8">
        <Text className="text-muted-foreground text-center">
          No seating options available for this time slot.
        </Text>
      </View>
    );
  }

  const { options } = slotOptions;
  const selectedOption = options[selectedOptionIndex];
  const isButtonDisabled = isProcessing || isConfirming || loading;

  return (
    <View>
      {/* Header */}
      <Text className="font-semibold text-sm mb-3">Select Section</Text>

      {/* Options */}
      <View
        className="gap-3 mb-6"
        style={{ opacity: isButtonDisabled ? 0.6 : 1 }}
      >
        {options.map((option, index) => (
          <TableOptionCard
            key={`${option.tableTypes.join("-")}-${index}`}
            option={option}
            isRecommended={index === 0}
            isSelected={index === selectedOptionIndex}
            onSelect={() => handleOptionSelect(index)}
          />
        ))}
      </View>

      {/* Confirm Button with Loading State */}
      <Button
        onPress={handleConfirm}
        size="lg"
        className="w-full"
        disabled={isButtonDisabled}
        style={{ opacity: isButtonDisabled ? 0.7 : 1 }}
      >
        {isProcessing || isConfirming ? (
          <View className="flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" color="white" />
            <Text className="text-white font-bold">
              {isConfirming ? "Confirming Booking..." : "Processing..."}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-center gap-2">
            <CheckCircle size={20} color="white" />
            <Text className="text-white font-bold">
              Confirm Booking
            </Text>
          </View>
        )}
      </Button>

      {/* Prevention Notice */}
      {isButtonDisabled && (
        <View className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Text className="text-xs text-center text-blue-600 dark:text-blue-400">
            {isConfirming
              ? "Creating your booking... Please don't close the app."
              : "Processing your selection... Please wait."}
          </Text>
        </View>
      )}
    </View>
  );
});

// Update TableOptionCard to handle disabled state
const TableOptionCard = memo<{
  option: TableOption;
  isRecommended: boolean;
  isSelected: boolean;
  onSelect: () => void;
}>(({ option, isRecommended, isSelected, onSelect }) => {
  // Prevent selection changes with debouncing
  const lastClickRef = useRef<number>(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 500) {
      return;
    }
    lastClickRef.current = now;

    onSelect();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onSelect]);

  // Get table type icons
  const getTableTypeIcon = (tableType: string) => {
    const icons = {
      booth: Crown,
      window: Eye,
      patio: TreePine,
      bar: Utensils,
      private: Crown,
      standard: Utensils,
    };
    return icons[tableType as keyof typeof icons] || Utensils;
  };

  const primaryTableType = option.tableTypes[0];

  return (
    <Pressable
      onPress={handlePress}
      className={`p-4 rounded-xl border-2 flex-row items-center justify-between ${
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-card"
      }`}
    >
      <View className="flex-1 mr-3">
        <Text
          className={`font-semibold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}
        >
          {option.experienceTitle}
        </Text>
        {option.experienceDescription ? (
          <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
            {option.experienceDescription}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-1 mt-1">
          <Users size={12} color="#666" />
          <Text className="text-xs text-muted-foreground">
            {option.totalCapacity} seats
          </Text>
          {option.requiresCombination && (
            <Text className="text-xs text-muted-foreground"> · Combined tables</Text>
          )}
        </View>
      </View>

      <View
        className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
          isSelected ? "border-primary bg-primary" : "border-border"
        }`}
      >
        {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
      </View>
    </Pressable>
  );
});

// Combined component for seamless experience selection
export const ExperienceSelector = memo<{
  restaurantId: string;
  date: Date;
  time: string;
  partySize: number;
  onConfirm: (
    tableIds: string[],
    selectedTime: string,
    selectedDate: Date,
    partySize: number,
    selectedOption: any,
  ) => void;
  onBack: () => void;
}>(({ restaurantId, date, time, partySize, onConfirm, onBack }) => {
  const [slotOptions, setSlotOptions] = useState<SlotTableOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // Load table options for the selected time
  React.useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      try {
        const availabilityService = AvailabilityService.getInstance();
        const options = await availabilityService.getTableOptionsForSlot(
          restaurantId,
          date,
          time,
          partySize,
        );
        setSlotOptions(options);
      } catch (error) {
        console.error("Error loading slot options:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [restaurantId, date, time, partySize]);

  const handleConfirm = useCallback(
    (tableIds: string[], selectedOption: TableOption) => {
      onConfirm(tableIds, time, date, partySize, selectedOption);
    },
    [onConfirm, time, date, partySize],
  );

  return (
    <View>
      <TableOptions
        slotOptions={slotOptions}
        onConfirm={handleConfirm}
        onBack={onBack}
        loading={loading}
      />
    </View>
  );
});
