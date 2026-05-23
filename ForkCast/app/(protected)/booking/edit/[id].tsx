// app/(protected)/booking/edit/[id].tsx
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Info, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { useBookingModification } from "@/hooks/useBookingModification";
import { useAvailability } from "@/hooks/useAvailability";
import { useRestaurantSections } from "@/hooks/useRestaurantSections";
import { createLebanonDateTime, parseFromLebanonTZ } from "@/utils/lebanonTime";
import { ModificationSummary } from "@/components/booking/ModificationSummary";
import { ModificationCTA } from "@/components/booking/ModificationCTA";
import { useColorScheme } from "@/lib/useColorScheme";
import { formatDateShort } from "@/utils/birthday";

// Import existing reusable components from availability screen
import { TimeSlots } from "@/components/booking/TimeSlots";
import { SectionSelector } from "@/components/booking/SectionSelector";
import { InlineOfferSelector } from "@/components/booking/InlineOfferSelector";

// Card Guarantee and Deposit Payment components
import { CardGuaranteeInline } from "@/components/booking/CardGuaranteeSheet";
import {
  DepositPaymentSheet,
  DepositPaymentMethod,
} from "@/components/booking/DepositPaymentSheet";

interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

// Constants
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

// Party Size Selector Component (copied from availability.tsx)
const PartySizeSelector = React.memo<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  maxPartySize?: number;
  disabled?: boolean;
}>(({ partySize, onPartySizeChange, maxPartySize = 12, disabled = false }) => {
  const sizes = useMemo(
    () => Array.from({ length: maxPartySize }, (_, i) => i + 1),
    [maxPartySize],
  );

  return (
    <View
      className={`bg-card border border-border rounded-xl p-4 mb-4 ${disabled ? "opacity-60" : ""}`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="font-semibold text-base">Party Size</Text>
        </View>
        <View className="bg-muted rounded-full px-3 py-1.5">
          <Text className="text-sm font-medium text-muted-foreground">
            {partySize} {partySize === 1 ? "guest" : "guests"}
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
    </View>
  );
});

PartySizeSelector.displayName = "PartySizeSelector";

// Date Selector Component (simplified from availability.tsx)
const DateSelector = React.memo<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDaysAhead?: number;
  disabled?: boolean;
}>(({ selectedDate, onDateChange, maxDaysAhead = 30, disabled = false }) => {
  const dates = useMemo(() => {
    const today = new Date();
    const datesArray = [];

    for (let i = 0; i < Math.min(14, maxDaysAhead); i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }

    return datesArray;
  }, [maxDaysAhead]);

  const handleDateChange = useCallback(
    (date: Date) => {
      if (disabled) return;
      onDateChange(date);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onDateChange, disabled],
  );

  return (
    <View
      className={`bg-card border border-border rounded-xl p-4 mb-4 ${disabled ? "opacity-60" : ""}`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-semibold text-base">Select Date</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {dates.map((date) => {
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const isTomorrow =
              date.toDateString() ===
              new Date(Date.now() + 86400000).toDateString();

            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => handleDateChange(date)}
                disabled={disabled}
                className={`min-w-[80px] p-3 rounded-lg border-2 items-center ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium mb-1 ${
                    isSelected
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
                    isSelected ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {date.getDate()}
                </Text>
                <Text
                  className={`text-xs ${
                    isSelected
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {isToday
                    ? "Today"
                    : isTomorrow
                      ? "Tomorrow"
                      : date.toLocaleDateString("en-US", { month: "short" })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
});

DateSelector.displayName = "DateSelector";

// Special Requirements Section (simplified from availability.tsx)
const SpecialRequirementsSection = React.memo<{
  formData: BookingFormData;
  onFormDataChange: (formData: BookingFormData) => void;
}>(({ formData, onFormDataChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const hasRequirements =
    (formData.occasion && formData.occasion !== "none") ||
    formData.dietaryRestrictions.length > 0 ||
    formData.tablePreferences.length > 0 ||
    formData.specialRequests;

  return (
    <View className="bg-card border border-border rounded-xl mb-4 p-4">
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        className="flex-row items-center justify-between mb-3"
      >
        <Text className="font-semibold text-base">Special Requirements</Text>
        {isExpanded ? <X size={20} color="#6b7280" /> : <Info size={20} color="#6b7280" />}
      </Pressable>

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
          {/* Occasion */}
          <View>
            <Text className="font-medium text-foreground mb-3">Occasion</Text>
            <View className="flex-row flex-wrap gap-2">
              {OCCASIONS.map((occasion) => (
                <Pressable
                  key={occasion.id}
                  onPress={() =>
                    onFormDataChange({ ...formData, occasion: occasion.id })
                  }
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
          <View>
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
          <View>
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
        </View>
      )}
    </View>
  );
});

SpecialRequirementsSection.displayName = "SpecialRequirementsSection";

// Main Edit Screen
export default function BookingEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const backIconColor = colorScheme === "dark" ? "#ffffff" : "#7b2439";

  // Local state for UI - must be declared before hooks that depend on them
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [formData, setFormData] = useState<BookingFormData>({
    specialRequests: "",
    occasion: "none",
    dietaryRestrictions: [],
    tablePreferences: [],
    acceptTerms: true,
  });
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  // Use modification hook
  const {
    originalBooking,
    loading,
    modifiedFields,
    changes,
    hasChanges,
    validationErrors,
    canSave,
    canModify,
    updateField,
    resetChanges,
    saveModification,
    saveModificationForDeposit,
    willReleaseOffer,
    needsTableReassignment,
    newExpiryDate,
    submitting,
    // Card Guarantee
    guaranteeInfo,
    requiresNewGuarantee,
    paymentMethods,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    openCheckout,
    guaranteeLoading,
    // Deposit Payment
    depositInfo,
    requiresNewDeposit,
    showDepositPaymentSheet,
    setShowDepositPaymentSheet,
    initiateDepositPayment,
    depositPaymentLoading,
    // Payment checking state
    checkingPaymentRequirements,
  } = useBookingModification(id);

  // Handler for when user clicks "Pay Deposit" - just show the payment sheet
  // Modifications will only be saved when user confirms payment in the sheet
  const handlePayDeposit = useCallback(() => {
    setShowDepositPaymentSheet(true);
  }, [setShowDepositPaymentSheet]);

  // Availability hook - must be called unconditionally (before any early returns)
  const {
    timeSlots,
    timeSlotsLoading,
    selectedTime: _selectedTime,
    error,
    isBasicTier,
  } = useAvailability({
    restaurantId: originalBooking?.restaurant_id || "",
    date: selectedDate,
    partySize: partySize,
    enableRealtime: true,
    mode: "time-first",
    preloadNext: false,
  });

  // Restaurant sections (for basic tier) - must be called unconditionally
  const { sections: restaurantSections, loading: sectionsLoading } =
    useRestaurantSections(
      originalBooking?.restaurant_id,
      selectedDate,
      selectedTime || undefined,
    );

  // Initialize from original booking
  useEffect(() => {
    if (originalBooking) {
      const bookingTime = parseFromLebanonTZ(originalBooking.booking_time);
      setSelectedDate(bookingTime);
      setSelectedTime(format(bookingTime, "HH:mm"));
      setPartySize(originalBooking.party_size);
      setFormData({
        specialRequests: originalBooking.special_requests || "",
        occasion: originalBooking.occasion || "none",
        dietaryRestrictions: originalBooking.dietary_notes || [],
        tablePreferences: originalBooking.table_preferences || [],
        acceptTerms: true,
      });
      setSelectedSectionId(originalBooking.preferred_section);
      setSelectedOfferId(originalBooking.applied_offer_id);
    }
  }, [originalBooking]);

  // Handle date change - preserve time if available on new date
  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    // Don't clear selectedTime - let availability hook check if it's still valid for the new date
    // If old time is available, it will stay selected
    // If old time is NOT available, user will need to select a new time
  }, []);

  // Handle party size change - preserve time if available for new party size
  const handlePartySizeChange = useCallback(
    (size: number) => {
      setPartySize(size);
      // Sync with modification state explicitly here (instead of in a useEffect)
      // to avoid a race on initial load where the local default (2) gets pushed
      // into modifiedFields before originalBooking has been hydrated.
      if (originalBooking) {
        if (size !== originalBooking.party_size) {
          updateField("party_size", size);
        } else {
          updateField("party_size", undefined);
        }
      }
      // Don't clear selectedTime - let availability hook check if it's still valid for new party size
      // If old time is available, it will stay selected
      // If old time is NOT available, user will need to select a new time
    },
    [originalBooking, updateField],
  );

  // Handle time selection
  const handleTimeSelect = useCallback(
    (time: string) => {
      setSelectedTime(time);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Update modified booking time
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const bookingDateTime = createLebanonDateTime(dateStr, time);
        updateField("booking_time", bookingDateTime.toISOString());
      } catch (error) {
        console.error("Error setting booking time:", error);
      }
    },
    [selectedDate, updateField],
  );

  // Sync selected time with available times and handle booking_time updates
  // When party size or date changes, check if selected time is still available
  // If the selected time becomes unavailable, clear it and let user select a new one
  // If it's still available, keep it selected and update booking_time with new date if needed
  useEffect(() => {
    if (selectedTime && timeSlots.length > 0) {
      // Check if currently selected time is still available
      const isTimeStillAvailable = timeSlots.some(
        (slot) => slot.time === selectedTime,
      );

      if (!isTimeStillAvailable) {
        // Selected time is no longer available - clear it so user must select a new one
        setSelectedTime(null);
        // Clear the booking_time from modified fields since the old time is no longer valid
        updateField("booking_time", undefined);
      } else {
        // Selected time is still available - ensure booking_time is updated with new date
        try {
          const dateStr = format(selectedDate, "yyyy-MM-dd");
          const bookingDateTime = createLebanonDateTime(dateStr, selectedTime);
          updateField("booking_time", bookingDateTime.toISOString());
        } catch (error) {
          console.error(
            "Error updating booking time after date/party change:",
            error,
          );
        }
      }
    }
  }, [selectedDate, partySize, timeSlots, selectedTime, updateField]);

  // NOTE: Party size is intentionally NOT auto-synced via useEffect.
  // Doing so caused a race on first render: the local `partySize` state defaults
  // to 2, so before `originalBooking` finished hydrating into `partySize`, the
  // effect would push `party_size: 2` into `modifiedFields`. After re-render the
  // values matched again so the effect would not re-run, leaving the stale
  // `party_size: 2` permanently in `modifiedFields` and silently overwriting
  // any booking with a different party size on save.
  // Party size changes are now applied explicitly in `handlePartySizeChange`.

  // Handle section change
  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      setSelectedSectionId(sectionId);
      updateField("preferred_section", sectionId === "any" ? null : sectionId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [updateField],
  );

  // Handle offer selection
  const handleOfferSelect = useCallback(
    (offer: { id: string } | null) => {
      setSelectedOfferId(offer?.id || null);
      updateField("applied_offer_id", offer?.id || null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [updateField],
  );

  // Handle form data changes
  const handleFormDataChange = useCallback(
    (newFormData: BookingFormData) => {
      setFormData(newFormData);

      // Update modified fields
      updateField("special_requests", newFormData.specialRequests);
      updateField(
        "occasion",
        newFormData.occasion !== "none" ? newFormData.occasion : undefined,
      );
      updateField(
        "dietary_notes",
        newFormData.dietaryRestrictions.length > 0
          ? newFormData.dietaryRestrictions
          : undefined,
      );
      updateField(
        "table_preferences",
        newFormData.tablePreferences.length > 0
          ? newFormData.tablePreferences
          : undefined,
      );
    },
    [updateField],
  );

  // Show error if booking cannot be modified
  if (!loading && !canModify) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 py-3 border-b border-border">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center"
          >
            <ChevronLeft color={backIconColor} size={24} />
            <Text className="ml-2 font-semibold text-lg">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">
            Cannot Modify Booking
          </Text>
          <Text className="text-center text-muted-foreground mb-4">
            Only pending bookings can be modified. This booking has already been{" "}
            {originalBooking?.status}.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-primary rounded-lg px-6 py-3"
          >
            <Text className="text-primary-foreground font-medium">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading || !originalBooking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-muted-foreground">
            Loading booking details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border bg-background">
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
              Modify Booking
            </Text>
            <Text
              className="text-center text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {originalBooking.restaurant.name}
            </Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 gap-4">
          {/* Party Size */}
          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={handlePartySizeChange}
            maxPartySize={20}
          />

          {/* Date Selector */}
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDaysAhead={30}
          />

          {/* Time Slots */}
          <TimeSlots
            slots={timeSlots}
            selectedTime={selectedTime}
            onTimeSelect={handleTimeSelect}
            loading={timeSlotsLoading}
            showLiveIndicator={false}
            error={error}
            onFormComplete={() => {}}
            showRequirementsForm={false}
            isBasicTier={isBasicTier}
          />

          {/* Section Selector (Basic Tier Only) */}
          {isBasicTier && (
            <SectionSelector
              sections={restaurantSections}
              selectedSectionId={selectedSectionId}
              onSectionSelect={handleSectionSelect}
              loading={sectionsLoading}
              disabled={false}
            />
          )}

          {/* Special Requirements */}
          <SpecialRequirementsSection
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />

          {/* Offer Selector */}
          <InlineOfferSelector
            restaurantId={originalBooking.restaurant_id}
            onOfferSelect={handleOfferSelect}
            selectedOfferId={selectedOfferId}
            disabled={false}
          />

          {/* Card Guarantee Section - Show when modification triggers new guarantee requirement */}
          {requiresNewGuarantee && guaranteeInfo && (
            <CardGuaranteeInline
              guaranteeInfo={guaranteeInfo}
              paymentMethods={paymentMethods}
              selectedPaymentMethodId={selectedPaymentMethodId}
              onSelectPaymentMethod={setSelectedPaymentMethodId}
              onAddNewCard={() => {
                openCheckout({ returnPath: `booking/edit/${id}` });
              }}
              partySize={partySize}
            />
          )}

          {/* Modification Summary */}
          <ModificationSummary
            originalBooking={originalBooking}
            modifiedFields={modifiedFields}
            changes={changes}
            willReleaseOffer={willReleaseOffer}
            needsTableReassignment={needsTableReassignment}
            sections={restaurantSections}
          />
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <ModificationCTA
        hasChanges={hasChanges}
        canSave={canSave}
        submitting={submitting}
        validationErrors={validationErrors}
        onSave={saveModification}
        onCancel={() => router.back()}
        requiresDeposit={requiresNewDeposit}
        onPayDeposit={handlePayDeposit}
        checkingPayment={checkingPaymentRequirements}
      />

      {/* Deposit Payment Sheet */}
      {depositInfo && requiresNewDeposit && (
        <DepositPaymentSheet
          visible={showDepositPaymentSheet}
          onClose={() => setShowDepositPaymentSheet(false)}
          onConfirm={async (method, pricing) => {
            // First save the booking modifications with deposit pending status
            const saved = await saveModificationForDeposit();
            if (!saved) {
              // If save failed, don't proceed with payment
              return;
            }

            // Now initiate the payment
            const success = await initiateDepositPayment({
              bookingId: id,
              provider: method,
              pricing: pricing,
              depositSettingId: depositInfo.settingId || undefined,
              partySize: partySize,
              source: "app",
            });

            // Close the sheet
            setShowDepositPaymentSheet(false);

            if (success) {
              // Payment initiated - navigate to booking details
              // The user shouldn't continue editing after payment is initiated
              router.replace(`/booking/${id}`);
            } else {
              // Payment initiation failed, but booking was already saved with deposit pending
              // Navigate to booking details so they can retry payment there
              Alert.alert(
                "Payment Not Started",
                "Your booking was saved but we couldn't open the payment page. You can complete payment from the booking details.",
                [
                  {
                    text: "OK",
                    onPress: () => router.replace(`/booking/${id}`),
                  },
                ],
              );
            }
          }}
          depositInfo={depositInfo}
          restaurantName={originalBooking.restaurant.name}
          partySize={partySize}
          bookingDate={format(selectedDate, "MMM d, yyyy")}
          bookingTime={selectedTime || ""}
          loading={depositPaymentLoading || submitting}
          isNewBooking={false}
        />
      )}
    </SafeAreaView>
  );
}
