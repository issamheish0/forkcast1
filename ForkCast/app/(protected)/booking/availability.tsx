// app/(protected)/booking/availability.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  AppState,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
  MapPin,
  Sparkles,
  QrCode,
  ArrowLeft,
  Clock,
  Timer,
  X,
  UserPlus,
  User,
  FileText,
} from "lucide-react-native";
import { Calendar as RNCalendar } from "react-native-calendars";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/image";
import { getMaxBookingWindow } from "@/lib/tableManagementUtils";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { useRestaurant } from "@/hooks/useRestaurant";
import {
  useAvailability,
  useAvailabilityPreloader,
} from "@/hooks/useAvailability";
import { createLebanonDateTime } from "@/utils/lebanonTime";
import {
  TimeSlots,
  TableOptions,
  SpecialRequirementsFormData,
} from "@/components/booking/TimeSlots";
import { TableOption } from "@/lib/AvailabilityService";

import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";

// Friend invitation imports
import { InviteFriendsModal } from "@/components/booking/InviteFriendsModal";

// Section selector imports
import { SectionSelector } from "@/components/booking/SectionSelector";
import { useRestaurantSections } from "@/hooks/useRestaurantSections";
import { useSectionAvailability } from "@/hooks/useSectionAvailability";
import { getDefaultFormValues } from "@/lib/bookingFormHelpers";
import { formatDateShort } from "@/utils/birthday";
import { useRestaurantEvents } from "@/hooks/useRestaurantEvents";
import {
  formatEventTimeRange,
  EventOccurrenceWithDetails,
  RestaurantEventWithOccurrences,
} from "@/types/events";
import { useColorScheme } from "@/lib/useColorScheme";

// Event detail modal import - use existing fully-featured modal
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";

// Inline offer selector imports
import { InlineOfferSelector } from "@/components/booking/InlineOfferSelector";

// Promo code imports
import { PromoCodeInput } from "@/components/booking/PromoCodeInput";
import { usePromoCode } from "@/hooks/usePromoCode";

// Booking confirmation modal
import { BookingConfirmationModal } from "@/components/booking/BookingConfirmationModal";

// Credit card guarantee imports
import {
  useCardGuarantee,
  GuaranteeCheckResult,
} from "@/hooks/useCardGuarantee";
import { CardGuaranteeSheet } from "@/components/booking/CardGuaranteeSheet";

// Deposit imports
import {
  useDepositPayment,
  DepositCheckResult,
} from "@/hooks/useDepositPayment";
import {
  DepositPaymentSheet,
  DepositPaymentMethod,
} from "@/components/booking/DepositPaymentSheet";
import { useDepositCheckout } from "@/hooks/useDepositCheckout";

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
  "Smoking Area",
  "Wheelchair Accessible",
];

const OCCASIONS = [
  { id: "date", label: "Date Night" },
  { id: "business", label: "Business Meal" },
  { id: "birthday", label: "Birthday" },
  { id: "anniversary", label: "Anniversary" },
  { id: "celebration", label: "Celebration" },
  { id: "casual", label: "Casual Dining" },
];

// Special Requirements Section Component
const SpecialRequirementsSection = React.memo<{
  formData: BookingFormData;
  onFormDataChange: (formData: BookingFormData) => void;
  showFormByDefault?: boolean;
}>(({ formData, onFormDataChange, showFormByDefault = false }) => {
  const [isExpanded, setIsExpanded] = useState(showFormByDefault);

  const toggleDietaryRestriction = useCallback(
    (restriction: string) => {
      const current = formData.dietaryRestrictions;
      const updated = current.includes(restriction)
        ? current.filter((r) => r !== restriction)
        : [...current, restriction];
      onFormDataChange({ ...formData, dietaryRestrictions: updated });
    },
    [formData, onFormDataChange],
  );

  const toggleTablePreference = useCallback(
    (preference: string) => {
      const current = formData.tablePreferences;
      const updated = current.includes(preference)
        ? current.filter((p) => p !== preference)
        : [...current, preference];
      onFormDataChange({ ...formData, tablePreferences: updated });
    },
    [formData, onFormDataChange],
  );

  const setOccasion = useCallback(
    (occasionId: string) => {
      onFormDataChange({ ...formData, occasion: occasionId });
    },
    [formData, onFormDataChange],
  );

  const setSpecialRequests = useCallback(
    (requests: string) => {
      onFormDataChange({ ...formData, specialRequests: requests });
    },
    [formData, onFormDataChange],
  );

  // Check if any requirements are selected
  const hasRequirements =
    (formData.occasion && formData.occasion !== "none") ||
    formData.dietaryRestrictions.length > 0 ||
    formData.tablePreferences.length > 0 ||
    formData.specialRequests;

  return (
    <View className="bg-card border border-border rounded-xl mb-4 p-4">
      {/* Header */}
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        className="flex-row items-center justify-between mb-3"
      >
        <View className="flex-row items-center gap-2 flex-1">
          <FileText size={20} color="#3b82f6" />
          <Text className="font-semibold text-base">Special Requirements</Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#3b82f6" />
        ) : (
          <ChevronDown size={20} color="#3b82f6" />
        )}
      </Pressable>

      {/* Summary when collapsed and has data */}
      {!isExpanded && hasRequirements && (
        <View className="p-3 bg-muted/50 rounded-lg">
          <Text className="text-sm text-muted-foreground">
            {[
              formData.occasion && formData.occasion !== "none"
                ? OCCASIONS.find((o) => o.id === formData.occasion)?.label
                : null,
              formData.dietaryRestrictions.length > 0
                ? `${formData.dietaryRestrictions.length} dietary restrictions`
                : null,
              formData.tablePreferences.length > 0
                ? `${formData.tablePreferences.length} table preferences`
                : null,
              formData.specialRequests ? "Special requests added" : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </Text>
        </View>
      )}

      {isExpanded && (
        <View className="space-y-5 mt-3">
          {/* Occasion Selection */}
          <View className="mt-3">
            <Text className="font-medium text-foreground mb-3">Occasion</Text>
            <View className="flex-row flex-wrap gap-2">
              {OCCASIONS.map((occasion) => (
                <Pressable
                  key={occasion.id}
                  onPress={() => setOccasion(occasion.id)}
                  className={`px-3 py-2 rounded-lg border ${
                    formData.occasion === occasion.id
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      formData.occasion === occasion.id
                        ? "text-white"
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
          <View className="mt-3">
            <Text className="font-medium text-foreground mb-3">
              Dietary Restrictions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DIETARY_RESTRICTIONS.map((restriction) => (
                <Pressable
                  key={restriction}
                  onPress={() => toggleDietaryRestriction(restriction)}
                  className={`px-3 py-2 rounded-lg border ${
                    formData.dietaryRestrictions.includes(restriction)
                      ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      formData.dietaryRestrictions.includes(restriction)
                        ? "text-green-800 dark:text-green-300"
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
          <View className="mt-3">
            <Text className="font-medium text-foreground mb-3">
              Table Preferences
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TABLE_PREFERENCES.map((preference) => (
                <Pressable
                  key={preference}
                  onPress={() => toggleTablePreference(preference)}
                  className={`px-3 py-2 rounded-lg border ${
                    formData.tablePreferences.includes(preference)
                      ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      formData.tablePreferences.includes(preference)
                        ? "text-blue-800 dark:text-blue-300"
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
          <View className="mt-3">
            <Text className="font-medium text-foreground">
              Special Requests
            </Text>
            <Textarea
              placeholder="Any special requests or notes for the restaurant..."
              value={formData.specialRequests || ""}
              onChangeText={setSpecialRequests}
              maxLength={500}
              label=""
            />
          </View>
        </View>
      )}
    </View>
  );
});

SpecialRequirementsSection.displayName = "SpecialRequirementsSection";

// Invite Friends Section Component
const InviteFriendsSection = React.memo<{
  invitedFriends: string[];
  invitedFriendsDetails: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  }[];
  totalPartySize: number;
  onShowModal: () => void;
  onRemoveFriend: (friendId: string) => void;
  onClearAll: () => void;
}>(
  ({
    invitedFriends,
    invitedFriendsDetails,
    totalPartySize,
    onShowModal,
    onRemoveFriend,
    onClearAll,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Check if any friends are invited
    const hasInvitedFriends = invitedFriends.length > 0;

    return (
      <View className="bg-card border border-border rounded-xl mb-4 p-4">
        {/* Header */}
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          className="flex-row items-center justify-between mb-3"
        >
          <View className="flex-row items-center gap-2 flex-1">
            <Users size={20} color="#3b82f6" />
            <Text className="font-semibold text-base">Invite Friends</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color="#3b82f6" />
          ) : (
            <ChevronDown size={20} color="#3b82f6" />
          )}
        </Pressable>

        {/* Summary when collapsed and has friends */}
        {!isExpanded && hasInvitedFriends && (
          <View className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Text className="text-sm text-green-800 dark:text-green-200">
              {invitedFriendsDetails.length} friend
              {invitedFriendsDetails.length > 1 ? "s" : ""} invited • Party of{" "}
              {totalPartySize}
            </Text>
          </View>
        )}

        {isExpanded && (
          <View className="space-y-4 mt-3">
            <Pressable
              onPress={onShowModal}
              className="p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex-row items-center justify-center"
            >
              <UserPlus size={24} color="#6b7280" />
              <Text className="ml-2 font-medium text-muted-foreground">
                {invitedFriends.length > 0
                  ? "Manage Invitations"
                  : "Invite Friends"}
              </Text>
            </Pressable>

            {/* Invited Friends Showcase */}
            {invitedFriendsDetails.length > 0 && (
              <View className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-semibold text-green-800 dark:text-green-200">
                    {invitedFriendsDetails.length} Friend
                    {invitedFriendsDetails.length > 1 ? "s" : ""} Invited
                  </Text>
                  <View className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
                    <Text className="text-green-800 dark:text-green-200 text-xs font-bold">
                      Party of {totalPartySize}
                    </Text>
                  </View>
                </View>

                {/* Friends List */}
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {invitedFriendsDetails.map((friend) => (
                    <Pressable
                      key={friend.id}
                      onPress={() => onRemoveFriend(friend.id)}
                      className="flex-row items-center bg-green-100 dark:bg-green-800/50 rounded-full pl-1 pr-2 py-1 border border-green-200 dark:border-green-700"
                    >
                      <Image
                        source={{
                          uri:
                            friend.avatar_url ||
                            `https://ui-avatars.com/api/?name=${friend.full_name}`,
                        }}
                        className="w-6 h-6 rounded-full bg-gray-100 mr-2"
                      />
                      <Text className="text-green-800 dark:text-green-200 text-sm font-medium mr-1">
                        {friend.full_name.split(" ")[0]}
                      </Text>
                      <View className="w-4 h-4 bg-green-200 dark:bg-green-700 rounded-full items-center justify-center">
                        <X size={10} color="#059669" />
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* Action Buttons */}
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-green-700 dark:text-green-300 flex-1">
                    Your friends will receive booking invitations once confirmed
                  </Text>
                  <Pressable
                    onPress={onClearAll}
                    className="ml-3 px-3 py-1 bg-green-200 dark:bg-green-800 rounded-full"
                  >
                    <Text className="text-green-800 dark:text-green-200 text-xs font-medium">
                      Clear All
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  },
);

InviteFriendsSection.displayName = "InviteFriendsSection";

// Form Data Interface
interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

// Enhanced Progress Indicator

// Optimized Party Size Selector (always expanded, non-collapsible, horizontal chips)
const PartySizeSelector = React.memo<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  minPartySize?: number;
  maxPartySize?: number;
  disabled?: boolean;
  isInvalid?: boolean;
}>(
  ({
    partySize,
    onPartySizeChange,
    minPartySize = 1,
    maxPartySize = 12,
    disabled = false,
    isInvalid = false,
  }) => {
    const sizes = useMemo(() => {
      const min = Math.max(1, minPartySize);
      const max = Math.max(min, maxPartySize);
      return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    }, [minPartySize, maxPartySize]);

    // Red glow animation
    const glowAnim = useSharedValue(0);

  useEffect(() => {
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
      ['rgba(220, 38, 38, 1)', 'rgba(239, 68, 68, 1)'],
    );
    const shadowColor = interpolateColor(
      glowAnim.value,
      [0, 1],
      ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.6)'],
    );
    return {
      borderColor,
      shadowColor,
    };
  });

  return (
    <ReanimatedAnimated.View
      style={[
        {
          borderWidth: 1,
          shadowOffset: isInvalid ? { width: 0, height: 0 } : undefined,
          shadowOpacity: isInvalid ? 1 : undefined,
          shadowRadius: isInvalid ? 8 : undefined,
          elevation: isInvalid ? 4 : undefined,
        },
        isInvalid ? glowStyle : {},
      ]}
      className={`bg-card border border-border rounded-xl p-4 ${disabled ? "opacity-60" : ""}`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Users size={20} color={isInvalid ? "#ef4444" : "#3b82f6"} />
          <Text className="font-semibold text-base">Party Size</Text>
        </View>
        <View className={`rounded-full px-3 py-1.5 ${partySize === 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
          <Text className={`text-sm font-medium ${partySize === 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
            {partySize === 0 ? "Select guests" : `${partySize} ${partySize === 1 ? "guest" : "guests"}`}
          </Text>
        </View>
      </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {sizes.map((size) => {
              const isSelected = size === partySize;
              return (
                <Pressable
                  key={size}
                  onPress={() => {
                    if (disabled) return;
                    if (size !== partySize) {
                      onPartySizeChange(size);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  disabled={disabled}
                  className={`px-4 py-2.5 rounded-full border ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-card border-border"
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      isSelected ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {size}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ReanimatedAnimated.View>
    );
  },
);

PartySizeSelector.displayName = "PartySizeSelector";

// Unavailable date info interface
interface UnavailableDateInfo {
  date: string; // YYYY-MM-DD format
  reason: string;
}

// Enhanced Date Selector with calendar picker
const DateSelector = React.memo<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDaysAhead?: number;
  disabled?: boolean;
  unavailableDates?: UnavailableDateInfo[];
  onUnavailableDatePress?: (date: Date, reason: string) => void;
}>(
  ({
    selectedDate,
    onDateChange,
    maxDaysAhead = 30,
    disabled = false,
    unavailableDates = [],
    onUnavailableDatePress,
  }) => {
    const [showCalendar, setShowCalendar] = useState(false);

    // Helper to check if a date is unavailablew
    const isDateUnavailable = useCallback(
      (date: Date): UnavailableDateInfo | null => {
        // Use format() instead of toISOString() to avoid UTC timezone shift
        const dateStr = format(date, "yyyy-MM-dd");
        return unavailableDates.find((d) => d.date === dateStr) || null;
      },
      [unavailableDates],
    );

    const dates = useMemo(() => {
      const today = new Date();
      const datesArray = [];

      for (let i = 0; i < maxDaysAhead; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        datesArray.push(date);
      }

      return datesArray;
    }, [maxDaysAhead]);

    const calendarDates = useMemo(() => {
      const today = new Date();
      // Use format() instead of toISOString() to avoid UTC timezone shift
      const minDate = format(today, "yyyy-MM-dd");

      const maxDateObj = new Date(today);
      maxDateObj.setDate(today.getDate() + maxDaysAhead - 1);
      const maxDate = format(maxDateObj, "yyyy-MM-dd");

      return { minDate, maxDate };
    }, [maxDaysAhead]);

    const handleDateChange = useCallback(
      (date: Date) => {
        if (disabled) return;

        // Check if date is unavailable
        const unavailableInfo = isDateUnavailable(date);
        if (unavailableInfo) {
          // Provide feedback for unavailable date
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (onUnavailableDatePress) {
            onUnavailableDatePress(date, unavailableInfo.reason);
          }
          return;
        }

        onDateChange(date);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      [onDateChange, disabled, isDateUnavailable, onUnavailableDatePress],
    );

    const handleCalendarDateSelect = useCallback(
      (day: any) => {
        const dateToSelect = new Date(day.dateString + "T00:00:00");

        // Check if date is unavailable
        const unavailableInfo = isDateUnavailable(dateToSelect);
        if (unavailableInfo) {
          // Provide feedback for unavailable date
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (onUnavailableDatePress) {
            onUnavailableDatePress(dateToSelect, unavailableInfo.reason);
          }
          // Don't close the calendar - let user see the feedback
          return;
        }

        handleDateChange(dateToSelect);
        setShowCalendar(false);
      },
      [handleDateChange, isDateUnavailable, onUnavailableDatePress],
    );

    const openCalendar = useCallback(() => {
      if (!disabled) {
        setShowCalendar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, [disabled]);

    // Memoized marked dates for calendar including unavailable dates
    const calendarMarkedDates = useMemo(() => {
      const marked: {
        [key: string]: {
          selected?: boolean;
          selectedColor?: string;
          disabled?: boolean;
          disableTouchEvent?: boolean;
          inactive?: boolean;
          dotColor?: string;
          marked?: boolean;
        };
      } = {};

      // Add unavailable dates as disabled with visual marker
      unavailableDates.forEach((unavailable) => {
        marked[unavailable.date] = {
          disabled: true,
          disableTouchEvent: false, // Allow touch to show reason
          inactive: true,
          marked: true,
          dotColor: "#ef4444", // Red dot to indicate closure
        };
      });

      // Add selected date (don't select if unavailable)
      // Use format() instead of toISOString() to avoid UTC timezone shift
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      const isSelectedUnavailable = unavailableDates.find(
        (d) => d.date === selectedDateStr,
      );
      if (!isSelectedUnavailable) {
        marked[selectedDateStr] = {
          ...marked[selectedDateStr],
          selected: true,
          selectedColor: "#3b82f6",
        };
      }

      return marked;
    }, [unavailableDates, selectedDate]);

    return (
      <>
        <View
          className={`bg-card border border-border rounded-xl p-4 ${disabled ? "opacity-60" : ""}`}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Calendar size={20} color="#3b82f6" />
              <Text className="font-semibold text-base">Select Date</Text>
            </View>
            <Pressable
              onPress={openCalendar}
              disabled={disabled}
              className={`flex-row items-center gap-2 rounded-full px-3 py-1.5 ml-auto border ${
                disabled
                  ? "opacity-60 bg-muted border-border"
                  : "bg-primary border-primary"
              }`}
            >
              <Calendar size={14} color={disabled ? "#666" : "white"} />
              <Text
                className={`text-xs font-medium ${disabled ? "text-muted-foreground" : "text-white"}`}
              >
                <ChevronDown size={12} color={disabled ? "#666" : "white"} />
              </Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              {dates.map((date) => {
                const isSelected =
                  date.toDateString() === selectedDate.toDateString();
                const isToday =
                  date.toDateString() === new Date().toDateString();
                const isTomorrow =
                  date.toDateString() ===
                  new Date(Date.now() + 86400000).toDateString();
                const unavailableInfo = isDateUnavailable(date);
                const isUnavailable = unavailableInfo !== null;

                return (
                  <Pressable
                    key={date.toISOString()}
                    onPress={() => handleDateChange(date)}
                    disabled={disabled}
                    className={`min-w-[80px] p-3 rounded-lg border-2 items-center ${
                      isUnavailable
                        ? "bg-muted/50 border-muted opacity-60"
                        : isSelected
                          ? "bg-primary border-primary"
                          : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium mb-1 ${
                        isUnavailable
                          ? "text-muted-foreground/60"
                          : isSelected
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {date
                        .toLocaleDateString("en-US", { weekday: "short" })
                        .toUpperCase()}
                    </Text>
                    <Text
                      className={`text-lg font-bold mb-1 ${
                        isUnavailable
                          ? "text-muted-foreground/60 line-through"
                          : isSelected
                            ? "text-primary-foreground"
                            : "text-foreground"
                      }`}
                    >
                      {date.getDate()}
                    </Text>
                    <Text
                      className={`text-xs ${
                        isUnavailable
                          ? "text-red-500 dark:text-red-400 font-medium"
                          : isSelected
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {isUnavailable
                        ? "Closed"
                        : isToday
                          ? "Today"
                          : isTomorrow
                            ? "Tomorrow"
                            : date.toLocaleDateString("en-US", {
                                month: "short",
                              })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Calendar Modal */}
        <Modal
          visible={showCalendar}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCalendar(false)}
        >
          <Pressable
            className="flex-1 bg-black/50 justify-center items-center"
            onPress={() => setShowCalendar(false)}
          >
            <Pressable
              className="bg-background rounded-2xl w-80 shadow-xl"
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-row items-center gap-2">
                  <Calendar size={20} color="#666" />
                  <Text className="font-semibold text-lg">Select Date</Text>
                </View>
                <Pressable
                  onPress={() => setShowCalendar(false)}
                  className="p-1"
                >
                  <X size={20} color="#666" />
                </Pressable>
              </View>

              {/* Calendar */}
              <View className="p-4">
                <RNCalendar
                  onDayPress={handleCalendarDateSelect}
                  markedDates={calendarMarkedDates}
                  minDate={calendarDates.minDate}
                  maxDate={calendarDates.maxDate}
                  enableSwipeMonths={true}
                  disableAllTouchEventsForInactiveDays={false}
                  theme={{
                    backgroundColor: "transparent",
                    calendarBackground: "transparent",
                    textSectionTitleColor: "#666",
                    selectedDayBackgroundColor: "#3b82f6",
                    selectedDayTextColor: "#ffffff",
                    todayTextColor: "#3b82f6",
                    dayTextColor: "#333",
                    textDisabledColor: "#bbb",
                    arrowColor: "#3b82f6",
                    monthTextColor: "#333",
                    indicatorColor: "#3b82f6",
                    textDayFontWeight: "500",
                    textMonthFontWeight: "600",
                    textDayHeaderFontWeight: "500",
                  }}
                />
              </View>
              {/* Legend for unavailable dates */}
              {unavailableDates.length > 0 && (
                <View className="px-4 pb-4">
                  <View className="flex-row items-center gap-2">
                    <View className="w-3 h-3 bg-gray-200 rounded-full" />
                    <Text className="text-xs text-muted-foreground">
                      Grayed out dates are unavailable
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  },
);

DateSelector.displayName = "DateSelector";

// Enhanced Offer Preview Components
const PreselectedOfferPreview = React.memo<{
  offerTitle: string;
  offerDiscount: number;
  redemptionCode: string;
  onRemove: () => void;
}>(({ offerTitle, offerDiscount, redemptionCode, onRemove }) => (
  <View className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-4">
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2">
        <Sparkles size={20} color="#10b981" />
        <Text className="font-bold text-lg text-green-800 dark:text-green-200">
          Special Offer Applied!
        </Text>
      </View>
      <View className="bg-green-600 rounded-full px-3 py-1">
        <Text className="text-white font-bold text-sm">
          {offerDiscount}% OFF
        </Text>
      </View>
    </View>

    <View className="mb-3">
      <Text
        className="font-bold text-green-800 dark:text-green-200 mb-1"
        numberOfLines={2}
      >
        {offerTitle}
      </Text>
      <Text className="text-sm text-green-700 dark:text-green-300">
        This offer will be automatically applied to your booking
      </Text>
    </View>

    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
        <QrCode size={14} color="#10b981" />
        <Text className="text-green-800 dark:text-green-200 text-xs font-bold ml-1">
          Code: {redemptionCode.slice(-6).toUpperCase()}
        </Text>
      </View>

      <Pressable
        onPress={onRemove}
        className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1"
      >
        <Text className="text-green-800 dark:text-green-200 text-xs font-medium">
          Remove
        </Text>
      </Pressable>
    </View>
  </View>
));

PreselectedOfferPreview.displayName = "PreselectedOfferPreview";

// Main Component
export default function AvailabilitySelectionScreen() {
  const { colorScheme } = useColorScheme();
  const backIconColor = colorScheme === "dark" ? "#ffffff" : "#7b2439";
  // Add state to track if confirmation is in progress
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  // Validation states for form inputs
  const [invalidFields, setInvalidFields] = useState<{
    partySize: boolean;
    time: boolean;
    section: boolean;
  }>({ partySize: false, time: false, section: false });
  const { profile } = useAuth();
  const router = useRouter();

  // Get parameters with validation
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    preselectedOfferId?: string;
    offerTitle?: string;
    offerDiscount?: string;
    redemptionCode?: string;
    partySize?: string;
    suggestedDate?: string;
    smartSuggestion?: string;
  }>();

  // Validate required params
  useEffect(() => {
    if (!params.restaurantId) {
      Alert.alert("Error", "Restaurant information is missing");
      router.back();
    }
  }, [params.restaurantId, router]);

  // State management with optimized defaults
  const [selectedDate, setSelectedDate] = useState(() => {
    if (params.suggestedDate) {
      try {
        return new Date(params.suggestedDate);
      } catch {
        return new Date();
      }
    }
    return new Date();
  });
  const [partySize, setPartySize] = useState(() => {
    if (params.partySize) {
      const size = parseInt(params.partySize, 10);
      if (!isNaN(size) && size > 0) return size;
    }
    return 0; // Default to 0 (unselected) - force user to explicitly choose
  });
  const [maxBookingDays, setMaxBookingDays] = useState(30);
  const [currentStep, setCurrentStep] = useState<"time" | "experience">("time");
  const [showSmartSuggestion, setShowSmartSuggestion] = useState(
    Boolean(params.smartSuggestion),
  );

  // Preselected offer state with memoization
  const [preselectedOffer, setPreselectedOffer] = useState<{
    id: string;
    title: string;
    discount: number;
    redemptionCode: string;
    discount_percentage?: number;
    valid_until?: string;
    restaurant_id?: string;
  } | null>(null);

  // Friend invitation state
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [invitedFriendsDetails, setInvitedFriendsDetails] = useState<
    { id: string; full_name: string; avatar_url: string | null }[]
  >([]);
  const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false);

  // Event detail modal state
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<RestaurantEventWithOccurrences | null>(null);

  // Section selection state (only for basic tier restaurants)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );

  // Card guarantee state
  const [showGuaranteeSheet, setShowGuaranteeSheet] = useState(false);
  const [guaranteeInfo, setGuaranteeInfo] =
    useState<GuaranteeCheckResult | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [pendingBookingAction, setPendingBookingAction] = useState<
    "basic" | "experience" | null
  >(null);
  const [pendingTableIds, setPendingTableIds] = useState<string[] | null>(null);
  const [pendingTableOption, setPendingTableOption] =
    useState<TableOption | null>(null);

  // Card guarantee hook
  const { checkGuaranteeRequired, loading: guaranteeLoading } =
    useCardGuarantee();

  // Special requirements form state - removing unused state
  const [formData, setFormData] = useState<BookingFormData>(() => ({
    specialRequests: "",
    occasion: "none",
    dietaryRestrictions: [],
    tablePreferences: [],
    acceptTerms: false,
    ...getDefaultFormValues(profile),
  }));

  // Calculate total party size including invited friends
  const totalPartySize = useMemo(
    () => partySize, // Party size is the total desired size, invited friends are within it
    [partySize],
  );

  // Promo code hook
  const {
    validateCode: validatePromoCode,
    clearPromoCode,
    loading: promoLoading,
    error: promoError,
    appliedPromo,
  } = usePromoCode({
    restaurantId: params.restaurantId || "",
    userId: profile?.id || "",
    partySize: totalPartySize,
  });

  // Time Range Search state
  const stepTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionSelectorRef = useRef<View>(null);
  const [missingFieldAlert, setMissingFieldAlert] = useState<string | null>(null);

  // Enhanced hooks with optimizations
  const { restaurant, loading: restaurantLoading } = useRestaurant(
    params.restaurantId || "",
  );
  const { preloadRestaurant } = useAvailabilityPreloader();
  const { confirmBooking, loading: confirmingBooking } =
    useBookingConfirmation();

  // Deposit Payment Hooks
  const { checkDepositRequired } = useDepositPayment();
  const {
    initiatePayment,
    loading: depositPaymentLoading,
    error: depositError,
  } = useDepositCheckout();
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [depositInfo, setDepositInfo] = useState<DepositCheckResult | null>(
    null,
  );
  // Pending booking data for deposit flow (booking created AFTER payment)
  const [pendingDepositBooking, setPendingDepositBooking] = useState<{
    bookingTime: Date;
    preferredSection: string | null;
  } | null>(null);
  const [waitingForDepositPayment, setWaitingForDepositPayment] =
    useState(false);

  // Real-time listener for deposit payment confirmation
  useEffect(() => {
    if (!currentBookingId || !waitingForDepositPayment) return;

    const isRequestBooking = (restaurant as any)?.booking_policy === "request";

    // Helper to navigate on success
    const navigateToSuccess = (confirmationCode?: string) => {
      setWaitingForDepositPayment(false);
      setCurrentBookingId(null);
      setPendingDepositBooking(null);
      setDepositInfo(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (isRequestBooking) {
        router.replace({
          pathname: "/booking/request-sent",
          params: {
            bookingId: currentBookingId,
            restaurantName: restaurant?.name || "Restaurant",
            bookingTime:
              pendingDepositBooking?.bookingTime?.toISOString() || "",
            partySize: partySize.toString(),
            confirmationCode: confirmationCode || "",
            depositPaid: "true",
          },
        });
      } else {
        router.replace({
          pathname: "/booking/success",
          params: {
            bookingId: currentBookingId,
            restaurantName: restaurant?.name || "Restaurant",
            bookingTime:
              pendingDepositBooking?.bookingTime?.toISOString() || "",
            partySize: partySize.toString(),
            confirmationCode: confirmationCode || "",
            depositPaid: "true",
          },
        });
      }
    };

    // Helper to handle payment failure
    const handlePaymentFailure = async () => {
      setWaitingForDepositPayment(false);
      setCurrentBookingId(null);
      setPendingDepositBooking(null);
      setDepositInfo(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Cancel the orphaned booking
      await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancellation_reason: "deposit_payment_failed",
        })
        .eq("id", currentBookingId);

      Alert.alert(
        "Payment Failed",
        "Your deposit payment was not successful. Please try booking again.",
        [{ text: "OK" }],
      );
    };

    // First, check if payment was already processed (callback fired during browser session)
    const checkExistingStatus = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("deposit_status, confirmation_code")
        .eq("id", currentBookingId)
        .single();

      if (data?.deposit_status === "paid") {
        navigateToSuccess(data.confirmation_code);
        return "paid";
      }
      if (data?.deposit_status === "failed") {
        handlePaymentFailure();
        return "failed";
      }
      return null;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    checkExistingStatus().then((result) => {
      if (result) return; // Already handled (paid or failed)

      // Set up realtime listener for future updates
      channel = supabase
        .channel(`deposit-${currentBookingId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `id=eq.${currentBookingId}`,
          },
          (payload: any) => {
            if (payload.new?.deposit_status === "paid") {
              navigateToSuccess(payload.new?.confirmation_code);
            } else if (payload.new?.deposit_status === "failed") {
              handlePaymentFailure();
            }
          },
        )
        .subscribe();
    });

    // Timeout: stop listening after 10 minutes
    const timeout = setTimeout(
      () => {
        setWaitingForDepositPayment(false);
        setCurrentBookingId(null);
        channel?.unsubscribe();
      },
      10 * 60 * 1000,
    );

    // AppState listener to detect when user returns to app without completing payment
    let hasShownPendingAlert = false;
    const appStateSubscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "active" && !hasShownPendingAlert) {
          // User returned to the app - check if payment is still pending
          const { data: bookingData } = await supabase
            .from("bookings")
            .select("deposit_status, status")
            .eq("id", currentBookingId)
            .single();

          // If deposit is still pending and booking is still pending_payment
          if (
            bookingData?.deposit_status === "pending" &&
            bookingData?.status === "pending_payment"
          ) {
            hasShownPendingAlert = true;
            // Wait a moment for any callback to process
            setTimeout(() => {
              // Re-check status after delay (callback might have processed)
              supabase
                .from("bookings")
                .select("deposit_status, status")
                .eq("id", currentBookingId)
                .single()
                .then(({ data: latestData }) => {
                  if (
                    latestData?.deposit_status === "pending" &&
                    latestData?.status === "pending_payment"
                  ) {
                    Alert.alert(
                      "Payment Pending",
                      "Your booking requires a deposit payment to be confirmed. You have 10 minutes to complete payment.",
                      [
                        {
                          text: "Pay Now",
                          onPress: () => {
                            const bookingId = currentBookingId;
                            setWaitingForDepositPayment(false);
                            setCurrentBookingId(null);
                            channel?.unsubscribe();
                            // Navigate directly to booking details page
                            router.push(`/booking/${bookingId}`);
                          },
                        },
                        {
                          text: "Later",
                          style: "cancel",
                          onPress: () => {
                            setWaitingForDepositPayment(false);
                            setCurrentBookingId(null);
                            channel?.unsubscribe();
                          },
                        },
                      ],
                    );
                  }
                });
            }, 2000);
          }
        }
      },
    );

    return () => {
      clearTimeout(timeout);
      channel?.unsubscribe();
      appStateSubscription.remove();
    };
  }, [
    currentBookingId,
    waitingForDepositPayment,
    router,
    restaurant,
    partySize,
    pendingDepositBooking,
  ]);

  // Enhanced availability hook with proper configuration
  const {
    timeSlots,
    timeSlotsLoading,
    selectedSlotOptions,
    selectedTime,
    slotOptionsLoading,
    error,
    fetchSlotOptions,
    clearSelectedSlot,
    hasTimeSlots,
    hasSelectedSlot,
    experienceCount,
    isLoading,
    refresh,
    // Restaurant tier information
    isBasicTier,
  } = useAvailability({
    restaurantId: params.restaurantId || "",
    date: selectedDate,
    partySize: totalPartySize || 1, // Use totalPartySize, fallback to 1 to keep hook valid when unselected
    enableRealtime: true,
    mode: "time-first",
    preloadNext: true,
  });

  // Restaurant sections hook (only used for basic tier restaurants)
  const { sections: restaurantSections, loading: sectionsLoading } =
    useRestaurantSections(
      params.restaurantId,
      selectedDate,
      selectedTime || undefined,
    );

  // Section availability hook — checks which sections have tables for current time/party
  const {
    sectionAvailability,
    loading: sectionAvailabilityLoading,
    allSectionsFull,
  } = useSectionAvailability(
    params.restaurantId, // fetch for all tiers
    selectedDate,
    selectedTime || undefined,
    totalPartySize,
  );

  const { events: restaurantEvents, upcomingOccurrences } = useRestaurantEvents(
    params.restaurantId,
    maxBookingDays,
  );

  // Restaurant availability hook for closures and special hours
  const {
    checkAvailability,
    loading: availabilityLoading,
    regularHours,
    closures,
    specialHours,
  } = useRestaurantAvailability(params.restaurantId || "");

  // Compute unavailable dates within the booking window
  // Dependencies include raw data arrays to ensure re-computation when data loads
  const unavailableDates = useMemo((): UnavailableDateInfo[] => {
    // Don't compute until data is loaded
    if (availabilityLoading) {
      return [];
    }

    const dates: UnavailableDateInfo[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < maxBookingDays; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);

      const availability = checkAvailability(checkDate);

      if (!availability.isOpen) {
        dates.push({
          // Use format() instead of toISOString() to avoid UTC timezone shift
          date: format(checkDate, "yyyy-MM-dd"),
          reason: availability.reason || "Unavailable",
        });
      }
    }

    return dates;
  }, [
    checkAvailability,
    maxBookingDays,
    availabilityLoading,
    // Include raw data arrays to ensure reactivity when data loads
    regularHours,
    closures,
    specialHours,
  ]);

  // Handler for when user taps on an unavailable date
  const handleUnavailableDatePress = useCallback(
    (date: Date, reason: string) => {
      const dateStr = format(date, "EEEE, MMMM d");
      Alert.alert(
        "Date Unavailable",
        `${restaurant?.name || "The restaurant"} is unavailable on ${dateStr}.\n\nReason: ${reason}`,
        [{ text: "OK", style: "default" }],
      );
    },
    [restaurant?.name],
  );

  const selectedSectionLabel = useMemo(() => {
    if (!restaurantSections || restaurantSections.length === 0) {
      return undefined;
    }
    if (!selectedSectionId) {
      return undefined;
    }
    const matchedSection = restaurantSections.find(
      (section) => section.id === selectedSectionId,
    );
    return matchedSection?.name || undefined;
  }, [restaurantSections, selectedSectionId]);

  // Check if restaurant has sections that require selection
  const hasSections = useMemo(
    () => !sectionsLoading && restaurantSections.length > 0,
    [sectionsLoading, restaurantSections.length],
  );

  // Section selection is required when sections exist but user hasn't explicitly chosen
  // Also required if selected section became full (no available tables)
  const isSelectedSectionFull = useMemo(() => {
    if (!selectedSectionId || !sectionAvailability || sectionAvailability.size === 0) return false;
    const avail = sectionAvailability.get(selectedSectionId);
    return avail ? (!avail.has_matching_tables || avail.available_tables === 0) : false;
  }, [selectedSectionId, sectionAvailability]);

  const needsSectionSelection = hasSections && (!selectedSectionId || isSelectedSectionFull);

  // Clear selected section if it becomes unavailable after availability data loads
  useEffect(() => {
    if (selectedSectionId && sectionAvailability.size > 0 && !sectionAvailabilityLoading) {
      const avail = sectionAvailability.get(selectedSectionId);
      if (avail && (!avail.has_matching_tables || avail.available_tables === 0)) {
        setSelectedSectionId(null);
      }
    }
  }, [sectionAvailability, sectionAvailabilityLoading, selectedSectionId]);

  // Memoize booking date time to prevent infinite re-renders
  const bookingDateTime = useMemo(() => {
    if (!selectedTime) return null;
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      return createLebanonDateTime(dateStr, selectedTime);
    } catch (error) {
      console.error("Error constructing booking date time:", error);
      return null;
    }
  }, [selectedDate, selectedTime]);

  const eventsOnSelectedDate = useMemo(() => {
    if (!selectedDate || !upcomingOccurrences?.length) {
      return [];
    }

    // Use format() instead of toISOString() to avoid UTC timezone shift
    const selectedDateKey = format(selectedDate, "yyyy-MM-dd");

    return upcomingOccurrences.filter((occurrence) => {
      const occurrenceDateKey =
        occurrence.occurrence_date?.split("T")[0] ?? undefined;
      // For multi-day events, check if selectedDate falls within the range
      const endDateKey =
        (occurrence as any).end_date?.split("T")[0] ?? occurrenceDateKey;
      if (!occurrenceDateKey) return false;
      return selectedDateKey >= occurrenceDateKey && selectedDateKey <= endDateKey;
    });
  }, [selectedDate, upcomingOccurrences]);

  // Preload restaurant data
  useEffect(() => {
    if (params.restaurantId) {
      preloadRestaurant(params.restaurantId, [2, 4, totalPartySize]);
    }
  }, [params.restaurantId, preloadRestaurant, totalPartySize]);

  // Initialize preselected offer with validation
  useEffect(() => {
    if (
      params.preselectedOfferId &&
      params.offerTitle &&
      params.offerDiscount
    ) {
      const discount = parseInt(params.offerDiscount, 10);
      if (!isNaN(discount) && discount > 0) {
        setPreselectedOffer({
          id: params.preselectedOfferId,
          title: params.offerTitle,
          discount,
          redemptionCode:
            params.redemptionCode ||
            "OFFER_" + params.preselectedOfferId.slice(0, 6).toUpperCase(),
        });
      }
    }
  }, [
    params.preselectedOfferId,
    params.offerTitle,
    params.offerDiscount,
    params.redemptionCode,
  ]);

  // Fetch max booking days with error handling
  useEffect(() => {
    async function fetchMaxDays() {
      if (profile?.id && restaurant?.id) {
        try {
          const days = await getMaxBookingWindow(
            profile.id,
            restaurant.id,
            (restaurant as any).booking_window_days || 30,
          );

          setMaxBookingDays(days);
        } catch (error) {
          console.error("Error fetching max booking days:", error);
          setMaxBookingDays(30); // fallback
        }
      }
    }
    fetchMaxDays();
  }, [profile?.id, restaurant?.id, restaurant]);

  const formatSelectedDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return formatDateShort(date);
  }, []);

  // Optimized event handlers
  const handleDateChange = useCallback(
    (date: Date) => {
      if (date.toDateString() === selectedDate.toDateString()) return;

      setSelectedDate(date);
      setCurrentStep("time");
      clearSelectedSlot();
      setInvitedFriends([]); // Reset invited friends when date changes
      setInvitedFriendsDetails([]); // Reset invited friends details
      setSelectedSectionId(null); // Reset section selection
      // Clear invalid state for time when date changes
      setInvalidFields((prev) => ({ ...prev, time: false }));

      // Clear any pending transitions
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    },
    [selectedDate, clearSelectedSlot, setInvitedFriends],
  );

  const handlePartySizeChange = useCallback(
    (size: number) => {
      if (size === partySize) return;

      setPartySize(size);
      setCurrentStep("time");
      clearSelectedSlot();
      // Don't reset invited friends - they are within the party size
      setSelectedSectionId(null); // Reset section selection
      // Clear invalid state for party size
      setInvalidFields((prev) => ({ ...prev, partySize: false }));

      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    },
    [partySize, clearSelectedSlot],
  );

  // Handle section selection
  const handleSectionSelect = useCallback((sectionId: string) => {
    setSelectedSectionId(sectionId);
    // Clear invalid state for section
    setInvalidFields((prev) => ({ ...prev, section: false }));
    // Clear any missing field alert when section is selected
    setMissingFieldAlert(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Check card guarantee requirement before booking
  const checkAndHandleGuarantee = useCallback(
    async (
      action: "basic" | "experience",
      tableIds?: string[],
      tableOption?: TableOption,
    ) => {
      if (!restaurant || !selectedTime) {
        Alert.alert("Error", "Restaurant information or time missing");
        return false;
      }

      // Construct booking date time
      let bookingTime: Date;
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        bookingTime = createLebanonDateTime(dateStr, selectedTime);
      } catch (error) {
        console.error("Error constructing booking time:", error);
        Alert.alert("Error", "Invalid time selected");
        return false;
      }

      // Check if restaurant requires card guarantee
      try {
        const guaranteeResult = await checkGuaranteeRequired(
          params.restaurantId,
          bookingTime,
          totalPartySize,
        );

        if (guaranteeResult.required) {
          // Store the guarantee info and pending action
          setGuaranteeInfo(guaranteeResult);
          setPendingBookingAction(action);
          if (tableIds) setPendingTableIds(tableIds);
          if (tableOption) setPendingTableOption(tableOption);

          // Show the guarantee sheet
          setShowGuaranteeSheet(true);
          return false; // Don't proceed with booking yet
        }

        return true; // No guarantee required, proceed with booking
      } catch (error) {
        console.error("Error checking card guarantee:", error);
        // If guarantee check fails, allow booking to proceed
        // (restaurant may not have guarantee settings configured)
        return true;
      }
    },
    [
      restaurant,
      selectedTime,
      selectedDate,
      params.restaurantId,
      totalPartySize,
      checkGuaranteeRequired,
    ],
  );

  // Handle showing confirmation modal or proceeding to experience step
  const handleShowBookingConfirmation = useCallback(async () => {
    // Validate all required fields
    const newInvalidFields = {
      partySize: partySize < 1,
      time: !selectedTime,
      section: needsSectionSelection,
    };

    setInvalidFields(newInvalidFields);

    // If any field is invalid, trigger haptic feedback and scroll to field
    if (newInvalidFields.partySize || newInvalidFields.time || newInvalidFields.section) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Check fields in order they appear on form (party size → time → section)
      if (newInvalidFields.partySize) {
        setMissingFieldAlert("Please select the number of guests");
      } else if (newInvalidFields.time) {
        setMissingFieldAlert("Please select a time to continue");
      } else if (newInvalidFields.section) {
        // Scroll to section selector
        setMissingFieldAlert("Please select a seating section to continue");
        setTimeout(() => {
          sectionSelectorRef.current?.measure((fx, fy, width, height, px, py) => {
            scrollViewRef.current?.scrollTo({
              y: py - 100,
              animated: true,
            });
          });
        }, 100);
      }
      
      return;
    }
    
    // Clear any missing field alerts on successful validation
    setMissingFieldAlert(null);

    if (!restaurant) {
      Alert.alert("Error", "Restaurant information is missing");
      return;
    }

    // For basic tier restaurants
    if (isBasicTier) {
      // Construct booking time for deposit check
      let bookingTime: Date;
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        bookingTime = createLebanonDateTime(dateStr, selectedTime ?? "");
      } catch (error) {
        console.error("Error constructing booking time:", error);
        Alert.alert("Error", "Invalid time selected");
        return;
      }

      // Check deposit requirement FIRST (before any modal)
      const depositCheck = await checkDepositRequired(
        params.restaurantId as string,
        bookingTime,
        partySize,
      );

      if (depositCheck?.required) {
        // Prepare section preference
        let preferredSection = null;
        if (selectedSectionId) {
          const selectedSection = restaurantSections.find(
            (section) => section.id === selectedSectionId,
          );
          if (selectedSection) {
            preferredSection = selectedSection.name;
          }
        }

        // Store pending booking info and show deposit sheet DIRECTLY
        setDepositInfo(depositCheck);
        setPendingDepositBooking({
          bookingTime,
          preferredSection,
        });
        setShowDepositSheet(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return; // Skip confirmation modal - deposit sheet handles everything
      }

      // No deposit required - proceed with normal flow
      // If we already have a selected payment method (from guarantee sheet), show modal
      if (selectedPaymentMethodId) {
        setShowConfirmationModal(true);
        return;
      }

      // Check if guarantee is required
      const canProceed = await checkAndHandleGuarantee("basic");
      if (canProceed) {
        setShowConfirmationModal(true);
      }
    } else {
      // For pro tier restaurants: auto-confirm using the best available option
      if (!selectedSlotOptions?.options?.length) {
        Alert.alert("Error", "No seating options available for this time. Please select a different time.");
        return;
      }
      const firstOption = selectedSlotOptions.options[0];
      const tableIds = firstOption.tables.map((t) => t.id);
      await handleExperienceConfirm(tableIds, firstOption);
    }
  }, [
    restaurant,
    selectedTime,
    partySize,
    isBasicTier,
    selectedSlotOptions,
    selectedPaymentMethodId,
    checkAndHandleGuarantee,
    needsSectionSelection,
    handleExperienceConfirm,
  ]);

  // Handle basic tier booking confirmation
  const handleBasicTierBooking = useCallback(async () => {
    if (!restaurant || !selectedTime) {
      Alert.alert("Error", "Restaurant information or time missing");
      return;
    }

    // Construct booking date time from selected time
    let bookingTime: Date;
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      bookingTime = createLebanonDateTime(dateStr, selectedTime);
    } catch (error) {
      console.error("Error constructing booking time:", error);
      Alert.alert("Error", "Invalid time selected");
      return;
    }

    setShowConfirmationModal(false); // Close modal
    setIsConfirmingBooking(true);
    try {
      // Prepare section preference for basic tier restaurants
      let preferredSection = null;

      if (selectedSectionId) {
        const selectedSection = restaurantSections.find(
          (section) => section.id === selectedSectionId,
        );

        if (selectedSection) {
          preferredSection = selectedSection.name;
        }
      }

      const depositCheck = await checkDepositRequired(
        params.restaurantId as string,
        bookingTime,
        partySize,
      );

      const isDepositRequired = depositCheck?.required || false;

      // If deposit is required, show deposit sheet FIRST without creating booking
      if (isDepositRequired) {
        setDepositInfo(depositCheck);
        setPendingDepositBooking({
          bookingTime,
          preferredSection,
        });
        setShowDepositSheet(true);
        setIsConfirmingBooking(false);
        return; // Don't create booking yet - will be created after deposit payment
      }

      // No deposit required - create booking normally
      const result = await confirmBooking({
        restaurantId: params.restaurantId,
        bookingTime: bookingTime,
        partySize: partySize,
        specialRequests: formData.specialRequests,
        occasion: formData.occasion !== "none" ? formData.occasion : undefined,
        dietaryNotes:
          formData.dietaryRestrictions.length > 0
            ? formData.dietaryRestrictions
            : undefined,
        tablePreferences:
          formData.tablePreferences.length > 0
            ? formData.tablePreferences
            : undefined,
        bookingPolicy: (restaurant as any).booking_policy as
          | "instant"
          | "request",
        appliedOfferId: preselectedOffer?.id,
        offerData: preselectedOffer
          ? {
              id: preselectedOffer.id,
              title: preselectedOffer.title,
              discount_percentage:
                preselectedOffer.discount_percentage ||
                preselectedOffer.discount,
              valid_until:
                preselectedOffer.valid_until ||
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              restaurant_id:
                preselectedOffer.restaurant_id || params.restaurantId,
            }
          : undefined,
        appliedPromoCodeId: appliedPromo?.id,
        appliedPromoData: appliedPromo
          ? {
              discount_type: appliedPromo.discount_type,
              discount_value: appliedPromo.discount_value,
              max_discount_amount: appliedPromo.max_discount_amount,
            }
          : undefined,
        tableIds: JSON.stringify([]),
        requiresCombination: false,
        invitedFriends: invitedFriends,
        preferredSection: preferredSection || undefined,
        sectionId: selectedSectionId || undefined,
        paymentMethodId: selectedPaymentMethodId || undefined,
        guaranteeSettingId: guaranteeInfo?.settingId || undefined,
        guaranteeNoShowFee: guaranteeInfo?.noShowFee,
        guaranteeCancellationFee: guaranteeInfo?.lateCancelFee,
        guaranteeFeeType: guaranteeInfo?.feeType as "fixed" | "per_cover" | undefined,
        restaurantName: (restaurant as any)?.name,
        skipNavigation: false, // Always navigate for non-deposit bookings
      });

      if (result) {
        // Normal success flow - confirmBooking handles navigation
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh(true);
        clearSelectedSlot();
        setCurrentStep("time");
        setSelectedPaymentMethodId(null);
        setGuaranteeInfo(null);
        setPendingBookingAction(null);
      }
    } catch (error) {
      console.error("Error confirming basic tier booking:", error);
      Alert.alert("Error", "Failed to confirm booking. Please try again.");
    } finally {
      setTimeout(() => {
        setIsConfirmingBooking(false);
      }, 2000);
    }
  }, [
    restaurant,
    selectedTime,
    selectedDate,
    params.restaurantId,
    partySize,
    preselectedOffer,
    appliedPromo,
    confirmBooking,
    refresh,
    clearSelectedSlot,
    invitedFriends,
    selectedSectionId,
    restaurantSections,
    formData,
    isBasicTier,
    selectedPaymentMethodId,
    guaranteeInfo,
  ]);

  const handleTimeSelect = useCallback(
    async (time: string) => {
      // Clear any existing timeout
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }

      // Clear invalid state for time
      setInvalidFields((prev) => ({ ...prev, time: false }));

      try {
        // Fetch options for all tiers (needed for booking logic)
        await fetchSlotOptions(time);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error("Error fetching slot options:", error);
        Alert.alert(
          "Error",
          "Failed to load seating options. Please try again.",
        );
      }
    },
    [fetchSlotOptions],
  );

  const handleBackToTimeSelection = useCallback(() => {
    setCurrentStep("time");
    clearSelectedSlot();
    setIsConfirmingBooking(false); // Reset confirming state
    // Reset guarantee state when going back
    setSelectedPaymentMethodId(null);
    setGuaranteeInfo(null);
    setPendingBookingAction(null);
    setPendingTableIds(null);
    setPendingTableOption(null);
    // Don't reset invited friends when going back to time selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  // Execute experience booking (used after guarantee card selection)
  const executeExperienceBooking = useCallback(
    async (
      tableIds: string[],
      selectedOption: TableOption,
      paymentMethodIdOverride?: string,
    ) => {
      if (!selectedSlotOptions || !restaurant || !bookingDateTime) {
        Alert.alert("Error", "Missing booking information");
        return;
      }

      setIsConfirmingBooking(true);

      try {
        const success = await confirmBooking({
          restaurantId: params.restaurantId,
          bookingTime: bookingDateTime,
          partySize: totalPartySize,
          specialRequests: formData.specialRequests,
          occasion:
            formData.occasion !== "none" ? formData.occasion : undefined,
          dietaryNotes:
            formData.dietaryRestrictions.length > 0
              ? formData.dietaryRestrictions
              : undefined,
          tablePreferences:
            formData.tablePreferences.length > 0
              ? formData.tablePreferences
              : undefined,
          bookingPolicy: (restaurant as any).booking_policy as
            | "instant"
            | "request",
          appliedOfferId: preselectedOffer?.id,
          offerData: preselectedOffer
            ? {
                id: preselectedOffer.id,
                title: preselectedOffer.title,
                discount_percentage:
                  preselectedOffer.discount_percentage ||
                  preselectedOffer.discount,
                valid_until:
                  preselectedOffer.valid_until ||
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                restaurant_id:
                  preselectedOffer.restaurant_id || params.restaurantId,
              }
            : undefined,
          appliedPromoCodeId: appliedPromo?.id,
          appliedPromoData: appliedPromo
            ? {
                discount_type: appliedPromo.discount_type,
                discount_value: appliedPromo.discount_value,
                max_discount_amount: appliedPromo.max_discount_amount,
              }
            : undefined,
          tableIds: JSON.stringify(tableIds),
          requiresCombination: selectedOption.requiresCombination,
          invitedFriends: invitedFriends,
          preferredSection: selectedSectionId
            ? restaurantSections.find((s) => s.id === selectedSectionId)?.name
            : undefined,
          sectionId: selectedSectionId || undefined,
          // Card guarantee fields
          paymentMethodId:
            paymentMethodIdOverride || selectedPaymentMethodId || undefined,
          guaranteeSettingId: guaranteeInfo?.settingId || undefined,
          guaranteeNoShowFee: guaranteeInfo?.noShowFee,
          guaranteeCancellationFee: guaranteeInfo?.lateCancelFee,
          guaranteeFeeType: guaranteeInfo?.feeType as "fixed" | "per_cover" | undefined,
          restaurantName: (restaurant as any)?.name,
        });

        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await refresh(true);
          clearSelectedSlot();
          setCurrentStep("time");
          // Reset guarantee state
          setSelectedPaymentMethodId(null);
          setGuaranteeInfo(null);
          setPendingBookingAction(null);
          setPendingTableIds(null);
          setPendingTableOption(null);
        }
      } catch (error) {
        console.error("Error confirming booking:", error);
        Alert.alert("Error", "Failed to confirm booking. Please try again.");
      } finally {
        setTimeout(() => {
          setIsConfirmingBooking(false);
        }, 2000);
      }
    },
    [
      selectedSlotOptions,
      restaurant,
      bookingDateTime,
      params.restaurantId,
      totalPartySize,
      preselectedOffer,
      appliedPromo,
      confirmBooking,
      refresh,
      clearSelectedSlot,
      invitedFriends,
      formData,
      selectedPaymentMethodId,
      guaranteeInfo,
    ],
  );

  // Handle card selection from guarantee sheet (must be after executeExperienceBooking)
  const handleGuaranteeCardSelected = useCallback(
    async (paymentMethodId: string) => {
      setSelectedPaymentMethodId(paymentMethodId);
      setShowGuaranteeSheet(false);

      // Proceed with the pending booking action
      if (pendingBookingAction === "basic") {
        // For basic tier, show confirmation modal then proceed
        setShowConfirmationModal(true);
      } else if (
        pendingBookingAction === "experience" &&
        pendingTableIds &&
        pendingTableOption
      ) {
        // For pro tier, directly confirm the booking
        await executeExperienceBooking(
          pendingTableIds,
          pendingTableOption,
          paymentMethodId,
        );
      }
    },
    [
      pendingBookingAction,
      pendingTableIds,
      pendingTableOption,
      executeExperienceBooking,
    ],
  );

  const handleExperienceConfirm = useCallback(
    async (tableIds: string[], selectedOption: TableOption) => {
      // Prevent double submissions
      if (isConfirmingBooking) {
        return;
      }

      if (!selectedSlotOptions || !restaurant || !bookingDateTime) {
        Alert.alert("Error", "Missing booking information");
        return;
      }

      // If we already have a payment method selected (from previous guarantee check), proceed
      if (selectedPaymentMethodId) {
        await executeExperienceBooking(tableIds, selectedOption);
        return;
      }

      // Check if guarantee is required
      const canProceed = await checkAndHandleGuarantee(
        "experience",
        tableIds,
        selectedOption,
      );
      if (canProceed) {
        // No guarantee required, proceed with booking
        await executeExperienceBooking(tableIds, selectedOption);
      }
      // If guarantee is required, the sheet will be shown and booking will proceed after card selection
    },
    [
      isConfirmingBooking,
      selectedSlotOptions,
      restaurant,
      bookingDateTime,
      selectedPaymentMethodId,
      checkAndHandleGuarantee,
      executeExperienceBooking,
    ],
  );

  // Handle inline offer selection
  const handleOfferSelect = useCallback(
    (
      offer: {
        id: string;
        title: string;
        discount: number;
        redemptionCode: string;
      } | null,
    ) => {
      if (offer) {
        // Clear promo code when offer is selected (mutually exclusive)
        clearPromoCode();
        setPreselectedOffer(offer);
      } else {
        setPreselectedOffer(null);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [clearPromoCode],
  );

  // Handle promo code applied — clear any selected offer (mutual exclusivity)
  const handlePromoApplied = useCallback(() => {
    setPreselectedOffer(null);
  }, []);

  const handleRemovePreselectedOffer = useCallback(() => {
    Alert.alert(
      "Remove Offer",
      "Are you sure you want to remove this offer from your booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setPreselectedOffer(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ],
    );
  }, []);

  // Handle friend invitations
  const handleInvitesSent = useCallback(
    (
      friendIds: string[],
      friendDetails: {
        id: string;
        full_name: string;
        avatar_url: string | null;
      }[],
    ) => {
      // Validate that invited friends don't exceed party size
      if (friendIds.length > partySize) {
        Alert.alert(
          "Too Many Friends",
          `You can only invite up to ${partySize} friends for a party of ${partySize}. Please reduce the number of friends or increase the party size.`,
        );
        return;
      }

      setInvitedFriends(friendIds);
      setInvitedFriendsDetails(friendDetails);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [partySize],
  );

  // Handle removing a specific friend
  const handleRemoveFriend = useCallback((friendId: string) => {
    setInvitedFriends((prev) => prev.filter((id) => id !== friendId));
    setInvitedFriendsDetails((prev) =>
      prev.filter((friend) => friend.id !== friendId),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle clearing all invitations
  const handleClearAllInvitations = useCallback(() => {
    Alert.alert(
      "Clear All Invitations",
      "Are you sure you want to remove all invited friends?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            setInvitedFriends([]);
            setInvitedFriendsDetails([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
    );
  }, []);

  // Event detail modal handlers
  const handleEventPress = useCallback(
    (occurrence: EventOccurrenceWithDetails) => {
      // Find the full event data from restaurantEvents using the event_id
      const fullEvent = restaurantEvents.find(
        (event) => event.id === occurrence.event_id,
      );

      if (fullEvent) {
        setSelectedEvent(fullEvent);
        setShowEventDetailModal(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [restaurantEvents],
  );

  const handleCloseEventModal = useCallback(() => {
    setShowEventDetailModal(false);
    setSelectedEvent(null);
  }, []);

  // Special requirements form helpers
  const handleFormDataChange = useCallback(
    (field: keyof BookingFormData, value: any) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const toggleDietaryRestriction = useCallback(
    (restriction: string) => {
      const current = formData.dietaryRestrictions;
      if (current.includes(restriction)) {
        handleFormDataChange(
          "dietaryRestrictions",
          current.filter((r) => r !== restriction),
        );
      } else {
        handleFormDataChange("dietaryRestrictions", [...current, restriction]);
      }
    },
    [formData.dietaryRestrictions, handleFormDataChange],
  );

  const toggleTablePreference = useCallback(
    (preference: string) => {
      const current = formData.tablePreferences;
      if (current.includes(preference)) {
        handleFormDataChange(
          "tablePreferences",
          current.filter((p) => p !== preference),
        );
      } else {
        handleFormDataChange("tablePreferences", [...current, preference]);
      }
    },
    [formData.tablePreferences, handleFormDataChange],
  );

  const handleSetOccasion = useCallback(
    (occasionId: string) => {
      handleFormDataChange("occasion", occasionId);
    },
    [handleFormDataChange],
  );

  const handleToggleSpecialRequirements = useCallback(() => {
    // This function is defined but unused - kept for future use
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle form completion from TimeSlots component
  const handleSpecialRequirementsComplete = useCallback(
    (newFormData: SpecialRequirementsFormData) => {
      setFormData((prev) => ({
        ...prev,
        specialRequests: newFormData.specialRequests,
        occasion: newFormData.occasion || "none",
        dietaryRestrictions: newFormData.dietaryRestrictions,
        tablePreferences: newFormData.tablePreferences,
      }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    };
  }, []);

  // Loading state with better UX
  if (!restaurant || restaurantLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-muted-foreground text-center">
            Loading restaurant information...
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            Preparing your dining experience
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRequestBooking = (restaurant as any)?.booking_policy === "request";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Clean Header - Fixed Height */}
      <View
        className="px-4 py-3 border-b border-border bg-background"
        style={{ height: 80 }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="p-2 -ml-2 rounded-full"
            hitSlop={8}
          >
            <ChevronLeft color={backIconColor} size={24} />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text
              className="text-center font-semibold text-lg"
              numberOfLines={1}
            >
              {restaurant.name}
            </Text>
            {selectedTime && (
              <View className="flex-row items-center justify-center gap-1 flex-wrap mt-1">
                <Text className="text-xs text-muted-foreground">
                  {formatSelectedDate(selectedDate)} at {selectedTime}
                </Text>
                <Text className="text-xs text-muted-foreground">•</Text>
                <Text className="text-xs text-muted-foreground">
                  Party of {totalPartySize}
                  {invitedFriends.length > 0 &&
                    ` (${totalPartySize - invitedFriends.length} + ${invitedFriends.length} invited)`}
                </Text>
                {preselectedOffer && (
                  <>
                    <Text className="text-xs text-muted-foreground">•</Text>
                    <Text className="text-xs font-medium text-green-600 dark:text-green-400">
                      {preselectedOffer.discount}% OFF
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
          <View className="w-10" />
        </View>
      </View>

      {/* Missing Field Alert Banner */}
      {missingFieldAlert && (
        <View className="bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 p-3 flex-row items-center gap-3">
          <View className="w-8 h-8 bg-red-200 dark:bg-red-500/30 rounded-full items-center justify-center flex-shrink-0">
            <Info size={16} color="#dc2626" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-red-800 dark:text-red-200">
              {missingFieldAlert}
            </Text>
          </View>
          <Pressable onPress={() => setMissingFieldAlert(null)} hitSlop={8}>
            <X size={18} color="#dc2626" />
          </Pressable>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="p-4 gap-5">
          {/* Smart Suggestion Banner */}
          {showSmartSuggestion && params.smartSuggestion && (
            <View className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <View className="flex-row items-start gap-3">
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center">
                  <Sparkles size={20} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-primary mb-1">
                    Smart Suggestion
                  </Text>
                  <Text className="text-sm text-foreground">
                    {params.smartSuggestion}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowSmartSuggestion(false)}
                  hitSlop={8}
                >
                  <X size={20} color="#666" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Preselected Offer Preview */}
          {preselectedOffer && (
            <PreselectedOfferPreview
              offerTitle={preselectedOffer.title}
              offerDiscount={preselectedOffer.discount}
              redemptionCode={preselectedOffer.redemptionCode}
              onRemove={handleRemovePreselectedOffer}
            />
          )}

          {/* Configuration Selectors - Disabled in experience step */}
          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={handlePartySizeChange}
            minPartySize={restaurant?.min_party_size ?? 1}
            maxPartySize={restaurant?.max_party_size ?? 10}
            disabled={currentStep === "experience" || isConfirmingBooking}
            isInvalid={invalidFields.partySize}
          />

          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDaysAhead={maxBookingDays}
            disabled={isConfirmingBooking}
            unavailableDates={unavailableDates}
            onUnavailableDatePress={handleUnavailableDatePress}
          />

          {eventsOnSelectedDate.length > 0 && (
            <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
              <View className="flex-row gap-3 mb-3">
                <View className="mt-0.5">
                  <Sparkles size={20} color="#b45309" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-amber-900 dark:text-amber-100">
                    {eventsOnSelectedDate.length > 1
                      ? "Events on this date"
                      : "Event on this date"}
                  </Text>
                  <Text className="text-sm text-amber-800 dark:text-amber-100 mt-1">
                    {restaurant?.name || "This restaurant"} has special{" "}
                    {eventsOnSelectedDate.length > 1 ? "events" : "an event"}{" "}
                    for {formatSelectedDate(selectedDate)}. Tap to learn more.
                  </Text>
                </View>
              </View>
              <View className="gap-2">
                {eventsOnSelectedDate.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => handleEventPress(event)}
                    className="flex-row items-center justify-between bg-amber-100/50 dark:bg-amber-800/30 rounded-lg p-3 active:bg-amber-200/70 dark:active:bg-amber-700/40"
                  >
                    <View className="flex-1 pr-3">
                      <Text
                        className="text-sm font-semibold text-amber-900 dark:text-amber-50"
                        numberOfLines={1}
                      >
                        {event.event_title}
                      </Text>
                      <Text className="text-xs text-amber-700 dark:text-amber-200 mt-0.5">
                        {formatEventTimeRange(event.start_time, event.end_time)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-xs font-medium text-amber-600 dark:text-amber-300">
                        Details
                      </Text>
                      <ChevronRight size={16} color="#b45309" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {partySize > 0 ? (
            <TimeSlots
              slots={timeSlots}
              selectedTime={selectedTime}
              onTimeSelect={handleTimeSelect}
              loading={timeSlotsLoading}
              showLiveIndicator={true}
              error={error}
              onFormComplete={handleSpecialRequirementsComplete}
              showRequirementsForm={false}
              isBasicTier={isBasicTier}
              isInvalid={invalidFields.time}
            />
          ) : (
            <View className="bg-card border border-border rounded-xl p-6 items-center">
              <Users size={32} color="#ef4444" />
              <Text className="text-red-600 dark:text-red-400 mt-3 text-center font-semibold text-base">
                Please select a party size
              </Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">
                Choose the number of guests to view available times
              </Text>
            </View>
          )}

          {/* Section Selector - show for all restaurants that have sections configured */}
          {(sectionsLoading || restaurantSections.length > 0) && (
            <View ref={sectionSelectorRef}>
              <SectionSelector
                sections={restaurantSections}
                selectedSectionId={selectedSectionId}
                onSectionSelect={handleSectionSelect}
                loading={sectionsLoading}
                disabled={isConfirmingBooking}
                isInvalid={invalidFields.section}
                sectionAvailability={sectionAvailability}
                availabilityLoading={sectionAvailabilityLoading}
                allSectionsFull={allSectionsFull}
              />
            </View>
          )}

          {/* Step 1: Time Selection */}
          {(
            <>
              {/* Friends Invitation Section - Collapsible */}
              <InviteFriendsSection
                invitedFriends={invitedFriends}
                invitedFriendsDetails={invitedFriendsDetails}
                totalPartySize={totalPartySize}
                onShowModal={() => setShowInviteFriendsModal(true)}
                onRemoveFriend={handleRemoveFriend}
                onClearAll={handleClearAllInvitations}
              />

              {/* Special Requirements - Below Friends Invitation */}
              <SpecialRequirementsSection
                formData={formData}
                onFormDataChange={setFormData}
                showFormByDefault={false}
              />

              {/* Inline Offer Selector */}
              <InlineOfferSelector
                restaurantId={params.restaurantId || ""}
                onOfferSelect={handleOfferSelect}
                selectedOfferId={preselectedOffer?.id || null}
                disabled={isConfirmingBooking}
              />

              {/* Promo Code Input */}
              <PromoCodeInput
                appliedPromo={appliedPromo}
                loading={promoLoading}
                error={promoError}
                onValidate={validatePromoCode}
                onPromoApplied={handlePromoApplied}
                onPromoRemoved={clearPromoCode}
                disabled={isConfirmingBooking}
                scrollViewRef={scrollViewRef}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* Enhanced Bottom CTA */}
      <View className="p-4 border-t border-border bg-background">
        {/* Full width Book Now button - always enabled unless loading */}
        <Button
          onPress={handleShowBookingConfirmation}
          disabled={isConfirmingBooking || confirmingBooking}
          className="w-full h-14 rounded-2xl bg-primary"
        >
          {isConfirmingBooking || confirmingBooking ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-primary-foreground font-medium">
                {isConfirmingBooking ? "Booking..." : "Processing..."}
              </Text>
            </View>
          ) : (
            <Text className="font-medium text-lg text-primary-foreground">
              Book Now
            </Text>
          )}
        </Button>

        {/* Status message below button */}
        <View className="mt-2">
          {partySize < 1 ? (
            <Text className="text-xs text-muted-foreground text-center">
              Select the number of guests to continue
            </Text>
          ) : !selectedTime ? (
            <Text className="text-xs text-muted-foreground text-center">
              Select a time to continue
            </Text>
          ) : needsSectionSelection ? (
            <Text className="text-xs text-muted-foreground text-center">
              Select a seating section to continue
            </Text>
          ) : null}
        </View>
      </View>
      {/* Invite Friends Modal */}
      <InviteFriendsModal
        visible={showInviteFriendsModal}
        onClose={() => setShowInviteFriendsModal(false)}
        onInvite={handleInvitesSent}
        restaurantName={restaurant?.name}
        bookingTime={
          selectedTime
            ? `${formatSelectedDate(selectedDate)} at ${selectedTime}`
            : `${formatSelectedDate(selectedDate)}`
        }
        currentlyInvited={invitedFriends}
        partySize={partySize}
      />

      {/* Event Detail Modal - Uses existing fully-featured modal with payment/booking logic */}
      {selectedEvent && (
        <EventDetailsModal
          visible={showEventDetailModal}
          event={selectedEvent}
          restaurantId={params.restaurantId || ""}
          onClose={handleCloseEventModal}
          variant="ramadan"
        />
      )}

      {/* Booking Confirmation Modal */}
      <BookingConfirmationModal
        visible={showConfirmationModal}
        isRequestBooking={isRequestBooking}
        restaurantName={restaurant?.name || ""}
        restaurantAddress={restaurant?.address}
        restaurantImageUrl={restaurant?.main_image_url || undefined}
        bookingDate={selectedDate}
        bookingTime={selectedTime || ""}
        partySize={totalPartySize}
        selectedOffer={
          preselectedOffer
            ? {
                special_offer: {
                  title: preselectedOffer.title,
                  discount_percentage: preselectedOffer.discount,
                },
              }
            : undefined
        }
        appliedPromo={
          appliedPromo
            ? {
                code: appliedPromo.code,
                discount_type: appliedPromo.discount_type,
                discount_value: appliedPromo.discount_value,
              }
            : null
        }
        sectionLabel={selectedSectionLabel}
        diningDurationMinutes={restaurant?.table_turnover_minutes || undefined}
        showDiningDuration={restaurant?.show_dining_duration}
        onConfirm={handleBasicTierBooking}
        onCancel={() => setShowConfirmationModal(false)}
        isSubmitting={isConfirmingBooking || confirmingBooking}
        useSlideToConfirm={true}
      />

      {/* Deposit Payment Sheet */}
      {depositInfo && pendingDepositBooking && (
        <DepositPaymentSheet
          visible={showDepositSheet}
          onClose={() => {
            setShowDepositSheet(false);
            setPendingDepositBooking(null);
            setDepositInfo(null);
          }}
          onConfirm={async (method, pricing) => {
            try {
              let bookingId: string | null = null;

              // First, check if user already has a pending-deposit booking for this restaurant/time
              // This prevents "Booking Too Close" errors when retrying payment
              if (
                profile?.id &&
                params.restaurantId &&
                pendingDepositBooking?.bookingTime
              ) {
                const bookingTimeStart = new Date(
                  pendingDepositBooking.bookingTime,
                );
                const bookingTimeEnd = new Date(
                  bookingTimeStart.getTime() + 5 * 60 * 1000,
                ); // 5 min window
                bookingTimeStart.setMinutes(bookingTimeStart.getMinutes() - 5);

                const { data: existingBooking } = await supabase
                  .from("bookings")
                  .select("id, deposit_status")
                  .eq("user_id", profile.id)
                  .eq("restaurant_id", params.restaurantId)
                  .eq("party_size", partySize)
                  .in("status", ["pending", "pending_payment", "confirmed"])
                  .eq("deposit_status", "pending")
                  .gte("booking_time", bookingTimeStart.toISOString())
                  .lte("booking_time", bookingTimeEnd.toISOString())
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();

                if (existingBooking?.id) {
                  bookingId = existingBooking.id;
                }
              }

              // If no existing booking found, create a new one with pending_payment status
              // This status hides the booking from the restaurant until payment is complete
              if (!bookingId) {
                // Generate a confirmation code
                const confirmationCode = `BK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

                // Set payment expiration (10 minutes from now)
                const paymentExpiresAt = new Date(
                  Date.now() + 10 * 60 * 1000,
                ).toISOString();

                // Create booking directly with pending_payment status
                // This bypasses the RPC conflict check since pending_payment bookings
                // should not conflict with other bookings until payment is confirmed
                const { data: newBooking, error: bookingError } = await supabase
                  .from("bookings")
                  .insert({
                    user_id: profile?.id,
                    restaurant_id: params.restaurantId,
                    booking_time:
                      pendingDepositBooking.bookingTime.toISOString(),
                    party_size: partySize,
                    status: "pending_payment", // Hidden from restaurant until deposit paid
                    deposit_status: "pending",
                    special_requests: formData.specialRequests || null,
                    occasion:
                      formData.occasion !== "none" ? formData.occasion : null,
                    dietary_notes:
                      formData.dietaryRestrictions.length > 0
                        ? formData.dietaryRestrictions
                        : null,
                    table_preferences:
                      formData.tablePreferences.length > 0
                        ? formData.tablePreferences
                        : null,
                    confirmation_code: confirmationCode,
                    is_group_booking: invitedFriends.length > 0,
                    turn_time_minutes: 120, // Default turn time
                    applied_offer_id: appliedPromo?.id ? null : (preselectedOffer?.id || null),
                    applied_promo_code_id: preselectedOffer?.id ? null : (appliedPromo?.id || null),
                    preferred_section:
                      pendingDepositBooking.preferredSection || null,
                    payment_expires_at: paymentExpiresAt,
                  })
                  .select("id, confirmation_code")
                  .single();

                if (bookingError) {
                  console.error(
                    "[Deposit] Failed to create booking:",
                    bookingError,
                  );
                  throw new Error("Failed to create booking");
                }

                if (newBooking?.id) {
                  bookingId = newBooking.id;
                }
              }

              if (bookingId) {
                // Set up the booking ID for the realtime listener
                setCurrentBookingId(bookingId);

                // Initiate payment (edge function sets deposit_status to 'pending')
                const paymentSuccess = await initiatePayment({
                  bookingId: bookingId,
                  provider: method,
                  pricing: pricing,
                  depositSettingId: depositInfo.settingId || undefined,
                  partySize: partySize,
                  source: "app",
                });

                if (paymentSuccess) {
                  // Close sheet — realtime listener will handle navigation on payment success
                  setShowDepositSheet(false);
                  setWaitingForDepositPayment(true);
                  // Don't clear pendingDepositBooking yet — needed by realtime listener
                } else {
                  // Payment initiation failed — cancel the orphaned pending booking
                  try {
                    await supabase
                      .from("bookings")
                      .update({ status: "cancelled_by_user" })
                      .eq("id", bookingId);
                  } catch (cleanupErr) {
                    console.error("Failed to clean up booking:", cleanupErr);
                  }
                  setCurrentBookingId(null);
                  Alert.alert(
                    "Payment Failed",
                    depositError ||
                      "Could not initiate payment. Please try again.",
                  );
                }
              } else {
                Alert.alert(
                  "Error",
                  "Failed to create booking. Please try again.",
                );
              }
            } catch (error) {
              console.error("Error in deposit payment flow:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            }
          }}
          depositInfo={depositInfo}
          restaurantName={restaurant?.name || ""}
          partySize={partySize}
          bookingDate={selectedDate.toDateString()}
          bookingTime={selectedTime || ""}
          cardServiceFeePercentage={
            parseFloat((restaurant as any)?.service_fee_percentage) || 0
          }
          whishServiceFeePercentage={
            parseFloat((restaurant as any)?.whish_service_fee_percentage) || 0
          }
          loading={depositPaymentLoading}
          isNewBooking={true}
        />
      )}

      {/* Card Guarantee Sheet */}
      {guaranteeInfo && (
        <Modal
          visible={showGuaranteeSheet}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowGuaranteeSheet(false);
            setPendingBookingAction(null);
            setPendingTableIds(null);
            setPendingTableOption(null);
          }}
        >
          <CardGuaranteeSheet
            isVisible={true}
            onClose={() => {
              setShowGuaranteeSheet(false);
              setPendingBookingAction(null);
              setPendingTableIds(null);
              setPendingTableOption(null);
            }}
            onCardSelected={handleGuaranteeCardSelected}
            guaranteeInfo={guaranteeInfo}
            partySize={totalPartySize}
            restaurantName={restaurant?.name || "Restaurant"}
            cancellationWindowHours={
              (restaurant as any)?.cancellation_window_hours || 24
            }
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}
