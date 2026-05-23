// components/restaurant/BookingWidget.tsx (Fully Optimized)
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { View, ScrollView, Pressable, Alert, Dimensions, ActivityIndicator } from "react-native";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Users as UsersIcon,
  Sparkles,
  CheckCircle,
  MapPin,
  Clock,
  Zap,
  Trophy,
  XCircle,
  AlertTriangle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format, addDays, isSameDay } from "date-fns";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import {
  useAvailability,
  useAvailabilityPreloader,
} from "@/hooks/useAvailability";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";
import { TimeSlots, TableOptions } from "@/components/booking/TimeSlots";
import { TableOption } from "@/lib/AvailabilityService";
import { useAuth } from "@/context/supabase-provider";
import { verifyAgeForBooking } from "@/utils/ageVerification";
import { AgeRestrictionBanner } from "./AgeRestrictionBanner";
import { useRouter } from "expo-router";
import { useBookingEligibility } from "@/hooks/useBookingEligibility";
import { formatDateShort, formatDateToDDMMYYYY } from "@/utils/birthday";
import { useBookingProfileCompletion } from "@/hooks/useProfileCompletion";
import { ProfileCompletionPrompt } from "../auth/ProfileCompletionPrompt";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface BookingWidgetProps {
  restaurant: Restaurant;
  onBookingSuccess: (
    tableIds: string[],
    selectedTime: string,
    selectedDate: Date,
    partySize: number,
    selectedOption: TableOption,
  ) => void;
  initialDate?: Date;
  initialPartySize?: number;
}

// Optimized date selector with memoization
const DateSelector = React.memo<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDays?: number;
  getDateStatus: (
    date: Date,
  ) => { type: "closed" | "special"; reason: string } | null;
}>(({ selectedDate, onDateChange, maxDays = 14, getDateStatus }) => {
  const dates = useMemo(() => {
    const today = new Date();
    const datesArray = [];

    for (let i = 0; i < maxDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }

    return datesArray;
  }, [maxDays]);

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return formatDateShort(date);
  }, []);

  return (
    <View className="mb-4">
      <Text className="font-medium mb-2">Select Date</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="gap-2"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {dates.map((date, i) => {
          const isSelected =
            date.toDateString() === selectedDate.toDateString();
          const isToday = date.toDateString() === new Date().toDateString();
          const dateStatus = getDateStatus(date);
          const isClosed = dateStatus?.type === "closed";
          const isSpecial = dateStatus?.type === "special";

          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => !isClosed && onDateChange(date)}
              disabled={isClosed}
              className={`px-4 py-3 rounded-lg mr-2 min-w-[70px] relative ${
                isSelected
                  ? "bg-primary"
                  : isClosed
                    ? "bg-muted/50 opacity-50"
                    : isSpecial
                      ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-500"
                      : "bg-muted"
              }`}
            >
              <Text
                className={`text-center font-medium text-xs ${
                  isSelected
                    ? "text-primary-foreground"
                    : isClosed
                      ? "text-muted-foreground"
                      : ""
                }`}
              >
                {date
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
              <Text
                className={`text-center text-lg font-bold ${
                  isSelected
                    ? "text-primary-foreground"
                    : isClosed
                      ? "text-muted-foreground"
                      : ""
                }`}
              >
                {date.getDate()}
              </Text>
              <Text
                className={`text-center text-xs ${
                  isSelected
                    ? "text-primary-foreground/80"
                    : isClosed
                      ? "text-muted-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {formatDate(date)}
              </Text>

              {/* Status indicators */}
              {isClosed && (
                <View className="absolute top-1 right-1">
                  <XCircle size={12} color="#ef4444" />
                </View>
              )}
              {isSpecial && !isClosed && (
                <View className="absolute top-1 right-1">
                  <Sparkles size={12} color="#f59e0b" />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

// Date status message component
const DateStatusMessage = React.memo<{
  dateStatus: { type: "closed" | "special"; reason: string } | null;
}>(({ dateStatus }) => {
  if (!dateStatus) return null;

  return (
    <View
      className={`p-3 rounded-lg mb-4 ${
        dateStatus.type === "closed"
          ? "bg-red-50 dark:bg-red-900/20"
          : "bg-amber-50 dark:bg-amber-900/20"
      }`}
    >
      <View className="flex-row items-center gap-2">
        {dateStatus.type === "closed" ? (
          <AlertTriangle size={16} color="#ef4444" />
        ) : (
          <Sparkles size={16} color="#f59e0b" />
        )}
        <Text
          className={`text-sm font-medium ${
            dateStatus.type === "closed"
              ? "text-red-800 dark:text-red-200"
              : "text-amber-800 dark:text-amber-200"
          }`}
        >
          {dateStatus.reason}
        </Text>
      </View>
    </View>
  );
});

// Optimized party size selector
const PartySizeSelector = React.memo<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  maxSize?: number;
}>(({ partySize, onPartySizeChange, maxSize = 8 }) => {
  const sizes = useMemo(
    () => Array.from({ length: maxSize }, (_, i) => i + 1),
    [maxSize],
  );

  return (
    <View className="mb-4">
      <Text className="font-medium mb-2">Party Size</Text>
      <View className="flex-row gap-2">
        {sizes.map((size) => (
          <Pressable
            key={size}
            onPress={() => onPartySizeChange(size)}
            className={`flex-1 py-2 rounded-lg ${
              partySize === size ? "bg-primary" : "bg-muted"
            }`}
          >
            <Text
              className={`text-center font-medium ${
                partySize === size ? "text-primary-foreground" : ""
              }`}
            >
              {size}
            </Text>
          </Pressable>
        ))}
      </View>
      {partySize > maxSize && (
        <Text className="text-sm text-muted-foreground mt-1">
          For larger parties, please call the restaurant
        </Text>
      )}
    </View>
  );
});

// Step indicator component
const StepIndicator = React.memo<{
  currentStep: "config" | "time" | "experience";
  hasTimeSlots: boolean;
  hasSelectedSlot: boolean;
}>(({ currentStep, hasTimeSlots, hasSelectedSlot }) => {
  const steps = [
    { id: "config", label: "Date & Size", completed: hasTimeSlots },
    { id: "time", label: "Time", completed: hasSelectedSlot },
  ];

  return (
    <View className="flex-row justify-center mb-4">
      {steps.map((step, index) => (
        <View key={step.id} className="flex-row items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${
              currentStep === step.id || currentStep === "experience"
                ? "bg-primary"
                : step.completed
                  ? "bg-green-500"
                  : "bg-muted"
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                currentStep === step.id || currentStep === "experience" || step.completed
                  ? "text-white"
                  : "text-muted-foreground"
              }`}
            >
              {index + 1}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View
              className={`w-8 h-0.5 mx-1 ${
                step.completed ? "bg-green-500" : "bg-muted"
              }`}
            />
          )}
        </View>
      ))}
    </View>
  );
});

// Quick stats component
const QuickStats = React.memo<{
  restaurant: Restaurant;
  timeSlots: any[];
  isLoading: boolean;
}>(({ restaurant, timeSlots, isLoading }) => {
  if (isLoading) {
    return (
      <View className="flex-row justify-around py-2 mb-4">
        <View className="items-center">
          <View className="w-8 h-4 bg-muted rounded mb-1" />
          <View className="w-12 h-3 bg-muted rounded" />
        </View>
        <View className="items-center">
          <View className="w-8 h-4 bg-muted rounded mb-1" />
          <View className="w-16 h-3 bg-muted rounded" />
        </View>
        <View className="items-center">
          <View className="w-8 h-4 bg-muted rounded mb-1" />
          <View className="w-14 h-3 bg-muted rounded" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row justify-around py-2 mb-4 border-b border-border/50">
      <View className="items-center">
        <Text className="text-lg font-bold text-primary">
          {timeSlots.length}
        </Text>
        <Text className="text-xs text-muted-foreground">Times</Text>
      </View>
      <View className="items-center">
        <View className="flex-row items-center gap-1">
          <Zap size={12} color="#f59e0b" />
          <Text className="text-lg font-bold text-amber-600">
            {restaurant.booking_policy === "instant" ? "Instant" : "2hr"}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">Booking</Text>
      </View>
      <View className="items-center">
        <View className="flex-row items-center gap-1">
          <Trophy size={12} color="#10b981" />
          <Text className="text-lg font-bold text-green-600">
            {restaurant.average_rating && restaurant.average_rating > 0
              ? restaurant.average_rating.toFixed(1)
              : "No rating"}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">Rating</Text>
      </View>
    </View>
  );
});

export const BookingWidget: React.FC<BookingWidgetProps> = ({
  restaurant,
  onBookingSuccess,
  initialDate,
  initialPartySize = 2,
}) => {
  // Auth context for age verification
  const { profile, isGuest } = useAuth();
  const router = useRouter();

  // State management with better defaults
  const [selectedDate, setSelectedDate] = useState(
    () => initialDate || new Date(),
  );
  const [partySize, setPartySize] = useState(initialPartySize);
  const [currentStep, setCurrentStep] = useState<
    "config" | "time" | "experience"
  >("config");

  // Refs for optimization
  const stepTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Booking eligibility (includes age verification and guest handling)
  const bookingEligibility = useBookingEligibility(restaurant);

  // Profile completion prompt for booking flow
  const profileCompletion = useBookingProfileCompletion();

  // Backward compatibility - keep ageVerification for existing AgeRestrictionBanner
  const ageVerification = useMemo(() => {
    return verifyAgeForBooking(restaurant, profile);
  }, [restaurant, profile]);

  // Preloader hook for better performance
  const { preloadRestaurant } = useAvailabilityPreloader();

  // Enhanced availability hook with optimizations
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
    isLoading,
  } = useAvailability({
    restaurantId: restaurant.id,
    date: selectedDate,
    partySize,
    enableRealtime: true,
    mode: "time-first",
    preloadNext: true,
  });

  // Restaurant hours availability hook
  const {
    loading: hoursLoading,
    checkAvailability,
    specialHours,
    closures,
  } = useRestaurantAvailability(restaurant.id);

  // Preload restaurant data when component mounts
  useEffect(() => {
    preloadRestaurant(restaurant.id, [2, 4, partySize]);
  }, [restaurant.id, preloadRestaurant, partySize]);

  // Helper function to check date status based on restaurant hours
  const getDateStatus = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      // Check if it's a closure
      const closure = closures.find(
        (c) => dateStr >= c.start_date && dateStr <= c.end_date,
      );
      if (closure) {
        return {
          type: "closed" as const,
          reason: closure.reason || "Temporarily closed",
        };
      }

      // Check for special hours
      const special = specialHours.find((s) => s.date === dateStr);
      if (special) {
        if (special.is_closed) {
          return {
            type: "closed" as const,
            reason: special.reason || "Closed for special occasion",
          };
        }
        return {
          type: "special" as const,
          reason: special.reason || "Special hours",
        };
      }

      // Check regular availability
      const availability = checkAvailability(date);
      if (!availability.isOpen) {
        return {
          type: "closed" as const,
          reason: availability.reason || "Closed today",
        };
      }

      return null;
    },
    [closures, specialHours, checkAvailability],
  );

  // Handle configuration changes with optimized state updates
  const handleDateChange = useCallback(
    (date: Date) => {
      if (date.toDateString() === selectedDate.toDateString()) return;

      setSelectedDate(date);
      setCurrentStep("config");
      clearSelectedSlot();

      // Clear any pending transitions
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [selectedDate, clearSelectedSlot],
  );

  const handlePartySizeChange = useCallback(
    (size: number) => {
      if (size === partySize) return;

      setPartySize(size);
      setCurrentStep("config");
      clearSelectedSlot();

      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [partySize, clearSelectedSlot],
  );

  // Step progression with optimized transitions
  const handleContinueToTimeSelection = useCallback(() => {
    // Check booking eligibility (includes age verification)
    if (!bookingEligibility.isEligible) {
      if (
        bookingEligibility.requiresDateOfBirth ||
        !profileCompletion.isProfileComplete
      ) {
        profileCompletion.showPrompt();
        return;
      }

      // Show appropriate alert for other restrictions
      Alert.alert(
        "Booking Not Available",
        bookingEligibility.blockedReason || "Unable to proceed with booking",
      );
      return;
    }

    // Check if the selected date is available according to restaurant hours
    const dateStatus = getDateStatus(selectedDate);
    if (dateStatus?.type === "closed") {
      Alert.alert(
        "Restaurant Closed",
        `${dateStatus.reason}. Please select a different date.`,
      );
      return;
    }

    if (!hasTimeSlots) return;

    setCurrentStep("time");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [
    hasTimeSlots,
    getDateStatus,
    selectedDate,
    bookingEligibility,
    profileCompletion,
  ]);

  const handleTimeSelect = useCallback(
    async (time: string) => {
      // Clear any existing timeout
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }

      // Fetch slot options and stay on time step (options render inline)
      await fetchSlotOptions(time);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [fetchSlotOptions],
  );

  const handleBackToConfig = useCallback(() => {
    setCurrentStep("config");
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handleBackToTime = useCallback(() => {
    setCurrentStep("time");
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handleExperienceConfirm = useCallback(
    (tableIds: string[], selectedOption: TableOption) => {
      if (!selectedSlotOptions) {
        Alert.alert("Error", "Missing seating information");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onBookingSuccess(
        tableIds,
        selectedSlotOptions.time,
        selectedDate,
        partySize,
        selectedOption,
      );
    },
    [selectedSlotOptions, selectedDate, partySize, onBookingSuccess],
  );

  // Format date for display
  const formatSelectedDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    };
  }, []);

  // Optimized render with better loading states
  return (
    <View className="mx-4 mb-6 p-4 bg-card rounded-xl shadow-sm border border-border">
      <H3 className="mb-4">Reserve Your Experience</H3>

      {/* Age Restriction Banner */}
      <AgeRestrictionBanner
        ageVerification={ageVerification}
        isGuest={isGuest}
        onSignUp={() => router.push("/sign-up")}
        onUpdateProfile={() => router.push("/profile/edit")}
      />

      {/* Step Indicator */}
      <StepIndicator
        currentStep={currentStep}
        hasTimeSlots={hasTimeSlots}
        hasSelectedSlot={hasSelectedSlot}
      />

      {/* Quick Stats */}
      {currentStep !== "config" && (
        <QuickStats
          restaurant={restaurant}
          timeSlots={timeSlots}
          isLoading={timeSlotsLoading}
        />
      )}

      {/* Step 1: Configuration */}
      {currentStep === "config" && (
        <>
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDays={14}
            getDateStatus={getDateStatus}
          />

          {/* Date Status Message */}
          <DateStatusMessage dateStatus={getDateStatus(selectedDate)} />

          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={handlePartySizeChange}
            maxSize={8}
          />

          <Button
            onPress={handleContinueToTimeSelection}
            className="w-full"
            disabled={
              timeSlotsLoading || hoursLoading || !bookingEligibility.isEligible
            }
          >
            <CalendarIcon size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              {!bookingEligibility.isEligible
                ? bookingEligibility.actionText || "Not Available"
                : timeSlotsLoading
                  ? "Finding Times..."
                  : "Find Available Times"}
            </Text>
            {timeSlotsLoading && (
              <ActivityIndicator size="small" color="white" style={{ marginLeft: 8 }} />
            )}
          </Button>
        </>
      )}

      {/* Step 2: Time Selection + Inline Section Choosing */}
      {(currentStep === "time" || currentStep === "experience") && (
        <>
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={handleBackToConfig}
              className="flex-row items-center gap-2"
            >
              <ArrowLeft size={16} color="#3b82f6" />
              <Text className="text-primary text-sm">Change Date/Size</Text>
            </Pressable>
            <View className="items-end">
              <View className="flex-row items-center gap-2">
                <MapPin size={12} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {formatSelectedDate(selectedDate)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <UsersIcon size={12} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {partySize} guest{partySize > 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>

          <TimeSlots
            slots={timeSlots}
            selectedTime={selectedTime}
            onTimeSelect={handleTimeSelect}
            loading={timeSlotsLoading}
            showLiveIndicator={true}
            error={error}
          />

          {/* Inline section/table selection after time is chosen */}
          {selectedTime && (
            <View className="mt-4 pt-4 border-t border-border">
              <TableOptions
                slotOptions={selectedSlotOptions}
                onConfirm={handleExperienceConfirm}
                onBack={handleBackToTime}
                loading={slotOptionsLoading}
              />
            </View>
          )}
        </>
      )}

      {/* Booking Policy Note */}
      <View className="mt-3 pt-3 border-t border-border">
        <View className="flex-row items-center justify-center gap-2">
          <CheckCircle size={12} color="#10b981" />
          <Text className="text-xs text-muted-foreground text-center">
            {restaurant.booking_policy === "instant"
              ? "Instant confirmation • Real-time availability"
              : "Restaurant will confirm within 2 hours"}
          </Text>
        </View>
      </View>

      {/* Profile Completion Prompt */}
      <ProfileCompletionPrompt
        visible={profileCompletion.isVisible}
        currentField={profileCompletion.currentField}
        missingFields={profileCompletion.missingFields}
        onComplete={() => {
          profileCompletion.hidePrompt();
          // Continue with booking flow after profile is complete
          setTimeout(() => {
            if (!hasTimeSlots) return;
            setCurrentStep("time");
          }, 500);
        }}
        onNext={() => {
          profileCompletion.moveToNextField();
        }}
        mandatory={true}
        getBestAvailableName={profileCompletion.getBestAvailableName}
        splitName={profileCompletion.splitName}
      />
    </View>
  );
};
