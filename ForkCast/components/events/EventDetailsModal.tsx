import React, { useState } from "react";
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  Share,
  Platform,
} from "react-native";
import {
  X,
  Calendar,
  Users,
  Info,
  Sparkles,
  DollarSign,
  ChevronRight,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  UtensilsCrossed,
  FileIcon,
  Share2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PDFViewer } from "@/components/pdf/PDFViewer";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { SafeAreaView } from "@/components/safe-area-view";
import { EventOccurrenceSelector } from "./EventOccurrenceSelector";
import { EventPaymentSheet } from "./EventPaymentSheet";
import { useEventEligibility } from "@/hooks/useEventEligibility";
import { useEventBooking } from "@/hooks/useEventBooking";
import { useEventPaymentCheckout } from "@/hooks/useEventPaymentCheckout";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import type {
  RestaurantEventWithOccurrences,
  EventOccurrence,
  EventPricing,
  EventMenuItem,
  EventTimelineItem,
} from "@/types/events";
import {
  EVENT_TYPE_LABELS,
  isEventPaid,
  calculateEventPricing,
  formatEventDateRange,
} from "@/types/events";
import { format } from "date-fns";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Reusable info row component for consistent styling
function InfoRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-3.5">
      <View className="flex-row items-center gap-3">
        <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
          {icon}
        </View>
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      <Text
        className={`text-sm font-semibold ${valueClassName || "text-foreground"}`}
      >
        {value}
      </Text>
    </View>
  );
}

interface EventDetailsModalProps {
  visible: boolean;
  event: RestaurantEventWithOccurrences;
  restaurantId: string;
  onClose: () => void;
  /** When "ramadan", image shows only close X (same overlay as cards), requirements in rows below */
  variant?: "default" | "ramadan";
}

export function EventDetailsModal({
  visible,
  event,
  restaurantId,
  onClose,
  variant = "default",
}: EventDetailsModalProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const overlayBg = isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)";
  const closeIconColor = isDark ? "#FFF" : primaryColor;

  const [selectedOccurrence, setSelectedOccurrence] =
    useState<EventOccurrence | null>(null);
  const [partySize, setPartySize] = useState<number>(
    event.minimum_party_size || 2,
  );
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showMenuPDF, setShowMenuPDF] = useState(false);

  const eligibility = useEventEligibility(event, selectedOccurrence, partySize);
  const {
    createEventBooking,
    createPaidEventBooking,
    loading: bookingLoading,
  } = useEventBooking();
  const { openPaymentCheckout, loading: paymentLoading } =
    useEventPaymentCheckout();

  // Check if this event requires payment
  const isPaidEvent = isEventPaid(event);
  const requiresInAppPayment = event.requires_in_app_payment !== false; // Default to true if undefined
  const currentPricing = isPaidEvent
    ? calculateEventPricing(event, partySize, "card")
    : null;

  const eventTypeLabel = event.event_type
    ? EVENT_TYPE_LABELS[event.event_type as keyof typeof EVENT_TYPE_LABELS] ||
      "Event"
    : "Event";

  const handleBookEvent = () => {
    if (!selectedOccurrence) {
      Alert.alert("Select Date", "Please select a date for this event");
      return;
    }

    // Check eligibility
    if (!eligibility.isEligible) {
      if (eligibility.actionRequired === "sign_up") {
        Alert.alert(
          "Sign Up Required",
          eligibility.reason || "Please sign up to book this event",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Up",
              onPress: () => {
                onClose();
                router.push("/sign-up");
              },
            },
          ],
        );
      } else if (eligibility.actionRequired === "add_date_of_birth") {
        Alert.alert(
          "Date of Birth Required",
          eligibility.reason || "Please add your date of birth to continue",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Update Profile",
              onPress: () => {
                onClose();
                router.push("/profile/edit");
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Cannot Book Event",
          eligibility.reason || "You cannot book this event at this time",
        );
      }
      return;
    }

    // For paid events, show payment sheet
    if (isPaidEvent) {
      // If requires in-app payment, show payment sheet
      if (requiresInAppPayment) {
        setShowPaymentSheet(true);
        return;
      }

      // Otherwise, show physical payment confirmation
      const pricing = calculateEventPricing(event, partySize, "card");
      if (!pricing) return;
      Alert.alert(
        "Confirm Physical Payment",
        `You will need to pay $${pricing.total.toFixed(2)} (${partySize} ${partySize === 1 ? "guest" : "guests"} × $${event.price_per_person?.toFixed(2)} + service fee) at the venue when you arrive.\n\nDo you want to confirm this booking?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm Booking",
            onPress: async () => {
              const success = await createEventBooking({
                eventId: event.id,
                occurrenceId: selectedOccurrence.id,
                restaurantId: restaurantId,
                partySize: partySize,
              });

              if (success) {
                onClose();
              }
            },
          },
        ],
      );
      return;
    }

    // For free events, show confirmation before booking
    Alert.alert(
      "Confirm Event Booking",
      `Book ${event.title} for ${partySize} ${partySize === 1 ? "guest" : "guests"} on ${formatEventDateRange(selectedOccurrence.occurrence_date, selectedOccurrence.end_date, format)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const success = await createEventBooking({
              eventId: event.id,
              occurrenceId: selectedOccurrence.id,
              restaurantId: restaurantId,
              partySize: partySize,
            });

            if (success) {
              onClose();
            }
          },
        },
      ],
    );
  };

  // Handle paid event payment confirmation
  const handlePaymentConfirm = async (pricing: EventPricing) => {
    if (!selectedOccurrence) return;

    // Create the pending payment booking first
    const result = await createPaidEventBooking({
      eventId: event.id,
      occurrenceId: selectedOccurrence.id,
      restaurantId: restaurantId,
      partySize: partySize,
      pricing: pricing,
    });

    if (!result.success || !result.booking) {
      Alert.alert(
        "Booking Error",
        result.error || "Failed to create booking. Please try again.",
      );
      return;
    }

    // Close payment sheet
    setShowPaymentSheet(false);

    // Open the payment checkout
    const paymentSuccess = await openPaymentCheckout({
      bookingId: result.booking.id,
      eventTitle: event.title,
      pricing: pricing,
    });

    if (paymentSuccess) {
      // Payment flow started - close the modal
      // The user will be redirected back after payment
      onClose();

      // Navigate to booking details after a short delay
      // (The callback will update the booking status)
      setTimeout(() => {
        router.push(`/booking/${result.booking!.id}`);
      }, 500);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          bounces
        >
          {/* Hero Image Section - Ramadan: image only + X; default: gradient + badges */}
          <View className="relative">
            {event.image_url ? (
              <View>
                <Image
                  source={{ uri: event.image_url }}
                  style={{ width: SCREEN_WIDTH, height: 280 }}
                  contentFit="cover"
                />
                {variant !== "ramadan" && (
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.7)"]}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 120,
                    }}
                  />
                )}
              </View>
            ) : (
              <View
                className="bg-muted items-center justify-center"
                style={{ width: SCREEN_WIDTH, height: 180 }}
              >
                <Calendar size={48} className="text-muted-foreground" />
              </View>
            )}

            {/* Close Button - same overlay as cards: white/primary light, black/white dark */}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="absolute top-4 right-4 w-10 h-10 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  variant === "ramadan" ? overlayBg : "rgba(0, 0, 0, 0.4)",
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X
                size={22}
                color={variant === "ramadan" ? closeIconColor : "#FFF"}
              />
            </Pressable>

            {/* Badges - only when not ramadan */}
            {variant !== "ramadan" && (
              <View className="absolute bottom-4 left-4 right-4 flex-row flex-wrap gap-2">
                <View className="bg-white/95 dark:bg-zinc-900/95 px-3 py-1.5 rounded-full shadow-sm">
                  <Text className="text-xs font-bold text-primary">
                    {eventTypeLabel}
                  </Text>
                </View>
                {event.minimum_age && (
                  <View className="bg-amber-500 px-3 py-1.5 rounded-full shadow-sm">
                    <Text className="text-xs font-bold text-white">
                      {event.minimum_age}+ Only
                    </Text>
                  </View>
                )}
                {isPaidEvent && currentPricing && (
                  <View className="bg-emerald-500 px-3 py-1.5 rounded-full shadow-sm flex-row items-center gap-1">
                    <DollarSign size={12} color="#FFF" />
                    <Text className="text-xs font-bold text-white">
                      ${event.price_per_person?.toFixed(2)}/person
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Ramadan: event name above details, then stacked requirement rows */}
          {variant === "ramadan" && (
            <>
              <View className="px-5 pt-4 pb-1">
                <Text className="text-2xl font-bold text-foreground">
                  {event.title}
                </Text>
              </View>
              <View className="px-5 pt-2 pb-2 border-b border-border">
                {isPaidEvent && event.price_per_person != null && (
                  <View className="flex-row items-center justify-between py-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                        <DollarSign size={18} className="text-primary" />
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        Price
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-foreground">
                      ${event.price_per_person.toFixed(2)}/person
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center justify-between py-3">
                  <View className="flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                      <Users size={18} className="text-primary" />
                    </View>
                    <Text className="text-sm text-muted-foreground">
                      Party size
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">
                    {event.minimum_party_size === event.maximum_party_size
                      ? `${event.minimum_party_size} guests`
                      : event.maximum_party_size
                        ? `${event.minimum_party_size}–${event.maximum_party_size} guests`
                        : `${event.minimum_party_size}+ guests`}
                  </Text>
                </View>
                {event.minimum_age != null && event.minimum_age > 0 && (
                  <View className="flex-row items-center justify-between py-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                        <Info size={18} className="text-primary" />
                      </View>
                      <Text className="text-sm text-muted-foreground">Age</Text>
                    </View>
                    <Text className="text-sm font-semibold text-foreground">
                      {event.minimum_age}+ only
                    </Text>
                  </View>
                )}
                {event.special_requirements && (
                  <View className="flex-row items-center justify-between py-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                        <FileText size={18} className="text-primary" />
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        Requirements
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-semibold text-foreground flex-1 text-right ml-2"
                      numberOfLines={2}
                    >
                      {event.special_requirements}
                    </Text>
                  </View>
                )}
                {(event.special_menu_url ||
                  (event.special_menu && event.special_menu.length > 0)) && (
                  <View className="flex-row items-center justify-between py-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                        <UtensilsCrossed size={18} className="text-primary" />
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        Special menu
                      </Text>
                    </View>
                    {event.special_menu_url ? (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setShowMenuPDF(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="View special menu"
                        className="flex-row items-center gap-1.5 active:opacity-70"
                      >
                        <Text className="text-sm font-semibold text-primary underline">
                          View menu
                        </Text>
                        <ArrowUpRight size={16} className="text-primary" />
                      </Pressable>
                    ) : (
                      <View className="rounded-full bg-muted px-4 py-2.5">
                        <Text className="text-sm font-semibold text-foreground">
                          Available
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

          {/* Content */}
          <View className="px-5 pt-5">
            {/* Title - only when not ramadan (ramadan shows it above details) */}
            {variant !== "ramadan" && (
              <Text className="text-2xl font-bold text-foreground mb-2">
                {event.title}
              </Text>
            )}

            {/* Description */}
            {event.description && (
              <Text className="text-base text-muted-foreground leading-6 mb-5">
                {event.description}
              </Text>
            )}

            {/* Event Info Card - skip when ramadan (already shown in stacked rows above) */}
            {variant !== "ramadan" && (
              <View className="bg-card border border-border rounded-2xl mb-4 overflow-hidden">
                <View className="px-4">
                  <InfoRow
                    icon={<Users size={18} className="text-primary" />}
                    label="Party Size"
                    value={
                      event.minimum_party_size === event.maximum_party_size
                        ? `${event.minimum_party_size} guests`
                        : event.maximum_party_size
                          ? `${event.minimum_party_size}-${event.maximum_party_size} guests`
                          : `${event.minimum_party_size}+ guests`
                    }
                  />
                  {event.special_requirements && (
                    <>
                      <View className="h-[1px] bg-border" />
                      <InfoRow
                        icon={<Info size={18} className="text-primary" />}
                        label="Requirements"
                        value={event.special_requirements}
                      />
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Terms and Conditions */}
            {event.terms_and_conditions &&
              event.terms_and_conditions.length > 0 && (
                <View className="bg-muted/40 border border-border rounded-2xl p-4 mb-5">
                  <View className="flex-row items-center gap-2 mb-3">
                    <FileText size={18} className="text-muted-foreground" />
                    <Text className="text-sm font-semibold text-foreground">
                      Terms & Conditions
                    </Text>
                  </View>
                  {event.terms_and_conditions.map((term, index) => (
                    <View
                      key={index}
                      className="flex-row items-start gap-2 mb-1.5"
                    >
                      <View className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
                      <Text className="flex-1 text-sm text-muted-foreground leading-5">
                        {term}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

            {/* Event Timeline */}
            {event.timeline && event.timeline.length > 0 && (
              <View className="bg-card border border-border rounded-2xl p-4 mb-5">
                <View className="flex-row items-center gap-2 mb-4">
                  <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center">
                    <Clock size={18} className="text-primary" />
                  </View>
                  <Text className="font-semibold text-base text-foreground">
                    Event Schedule
                  </Text>
                </View>
                <View className="relative pl-4">
                  {/* Timeline line */}
                  <View className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" />
                  {event.timeline.map(
                    (item: EventTimelineItem, index: number) => (
                      <View key={index} className="flex-row mb-4 last:mb-0">
                        {/* Timeline dot */}
                        <View className="absolute left-0 w-3 h-3 rounded-full bg-primary -ml-1 mt-1" />
                        <View className="ml-4 flex-1">
                          <Text className="text-xs font-semibold text-primary mb-0.5">
                            {item.time}
                          </Text>
                          <Text className="text-sm font-medium text-foreground">
                            {item.title}
                          </Text>
                          {item.description && (
                            <Text className="text-xs text-muted-foreground mt-0.5">
                              {item.description}
                            </Text>
                          )}
                        </View>
                      </View>
                    ),
                  )}
                </View>
              </View>
            )}

            {/* Special Menu */}
            {event.special_menu && event.special_menu.length > 0 && (
              <View className="bg-card border border-border rounded-2xl p-4 mb-5">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center">
                      <UtensilsCrossed size={18} className="text-primary" />
                    </View>
                    <Text className="font-semibold text-base text-foreground">
                      Special Menu
                    </Text>
                  </View>
                  {event.special_menu_url && variant !== "ramadan" && (
                    <Pressable
                      onPress={() => setShowMenuPDF(true)}
                      className="flex-row items-center gap-1 px-3 py-1.5 bg-primary/10 rounded-full"
                    >
                      <Text className="text-xs font-medium text-primary">
                        Full Menu
                      </Text>
                      <FileIcon size={12} className="text-primary" />
                    </Pressable>
                  )}
                </View>
                {/* Group menu items by category if available */}
                {event.special_menu.map(
                  (item: EventMenuItem, index: number) => (
                    <View
                      key={index}
                      className={`py-3 ${index !== event.special_menu!.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                          <Text className="text-sm font-medium text-foreground">
                            {item.name}
                          </Text>
                          {item.description && (
                            <Text className="text-xs text-muted-foreground mt-0.5">
                              {item.description}
                            </Text>
                          )}
                          {item.category && (
                            <View className="mt-1.5">
                              <Text className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold">
                                {item.category}
                              </Text>
                            </View>
                          )}
                        </View>
                        {item.price !== undefined && item.price > 0 && (
                          <Text className="text-sm font-semibold text-foreground">
                            ${item.price.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  ),
                )}
              </View>
            )}

            {/* Special Menu URL only (when no inline menu) - hidden for ramadan (already in requirements) */}
            {event.special_menu_url &&
              (!event.special_menu || event.special_menu.length === 0) &&
              variant !== "ramadan" && (
                <Pressable
                  onPress={() => setShowMenuPDF(true)}
                  className="bg-card border border-border rounded-2xl p-4 mb-5 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center">
                      <UtensilsCrossed size={18} className="text-primary" />
                    </View>
                    <Text className="font-semibold text-base text-foreground">
                      View Special Menu
                    </Text>
                  </View>
                  <FileIcon size={18} className="text-primary" />
                </Pressable>
              )}

            {/* Party Size Selector */}
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center">
                    <Users size={18} className="text-primary" />
                  </View>
                  <Text className="font-semibold text-base text-foreground">
                    Select Party Size
                  </Text>
                </View>
                <View className="bg-primary/10 rounded-full px-3 py-1.5">
                  <Text className="text-sm font-semibold text-primary">
                    {partySize} {partySize === 1 ? "guest" : "guests"}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                <View className="flex-row gap-2">
                  {Array.from(
                    {
                      length:
                        (event.maximum_party_size || 10) -
                        event.minimum_party_size +
                        1,
                    },
                    (_, i) => event.minimum_party_size + i,
                  ).map((size) => {
                    const isSelected = size === partySize;
                    return (
                      <Pressable
                        key={size}
                        onPress={() => setPartySize(size)}
                        className={`w-12 h-12 rounded-xl items-center justify-center border-2 ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "bg-card border-border"
                        }`}
                      >
                        <Text
                          className={`text-base font-bold ${
                            isSelected
                              ? "text-primary-foreground"
                              : "text-foreground"
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

            {/* Date & Time Selector */}
            <View className="mb-5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-8 h-8 rounded-xl bg-primary/10 items-center justify-center">
                  <Calendar size={18} className="text-primary" />
                </View>
                <Text className="font-semibold text-base text-foreground">
                  Select Date & Time
                </Text>
              </View>

              <View className="bg-card border border-border rounded-2xl p-4">
                <EventOccurrenceSelector
                  occurrences={event.occurrences}
                  selectedOccurrence={selectedOccurrence}
                  onSelectOccurrence={setSelectedOccurrence}
                  partySize={partySize}
                />
              </View>
            </View>

            {/* Eligibility Message */}
            {selectedOccurrence && !eligibility.isEligible && (
              <View className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 mb-4">
                <View className="flex-row items-start gap-3">
                  <AlertCircle
                    size={20}
                    className="text-amber-600 dark:text-amber-400 mt-0.5"
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                      Unable to Book
                    </Text>
                    <Text className="text-sm text-amber-700 dark:text-amber-300 leading-5">
                      {eligibility.reason}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Success state when eligible */}
            {selectedOccurrence && eligibility.isEligible && (
              <View className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center gap-3">
                  <CheckCircle2
                    size={20}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  <Text className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    Ready to book for{" "}
                    {formatEventDateRange(
                      selectedOccurrence.occurrence_date,
                      selectedOccurrence.end_date,
                      format,
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View className="absolute bottom-0 left-0 right-0 bg-card/95 border-t border-border shadow-lg">
          <SafeAreaView edges={["bottom"]}>
            <View className="px-5 py-4">
              {/* Price Preview for Paid Events */}
              {isPaidEvent && currentPricing && selectedOccurrence && (
                <View className="bg-muted/50 rounded-xl p-3 mb-4">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-xs text-muted-foreground mb-0.5">
                        {requiresInAppPayment
                          ? "Estimated Total"
                          : "Pay at Venue"}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {partySize} {partySize === 1 ? "guest" : "guests"} × $
                        {event.price_per_person?.toFixed(2)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-2xl font-bold text-foreground">
                        ${currentPricing.total.toFixed(2)}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {requiresInAppPayment
                          ? "incl. service fee"
                          : "at venue"}
                      </Text>
                    </View>
                  </View>
                  {!requiresInAppPayment && (
                    <View className="mt-3 pt-3 border-t border-border flex-row items-start gap-2">
                      <AlertCircle
                        size={14}
                        className="text-amber-600 dark:text-amber-500 mt-0.5"
                      />
                      <Text className="flex-1 text-xs text-muted-foreground">
                        Payment will be collected at the venue when you arrive
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Button
                onPress={handleBookEvent}
                size="lg"
                className="w-full h-14 rounded-2xl"
                disabled={
                  !selectedOccurrence ||
                  !eligibility.isEligible ||
                  bookingLoading ||
                  paymentLoading
                }
              >
                <View className="flex-row items-center justify-center gap-2">
                  {variant === "ramadan" ? (
                    <Sparkles size={22} color="white" />
                  ) : isPaidEvent ? (
                    <DollarSign size={22} color="white" />
                  ) : (
                    <Sparkles size={22} color="white" />
                  )}
                  <Text className="text-primary-foreground font-bold text-base">
                    {bookingLoading || paymentLoading
                      ? "Processing..."
                      : !selectedOccurrence
                        ? "Select a Date"
                        : !eligibility.isEligible
                          ? eligibility.actionText || "Cannot Book"
                          : isPaidEvent
                            ? requiresInAppPayment
                              ? "Continue to Payment"
                              : "Confirm Booking (Pay at Venue)"
                            : "Book This Event"}
                  </Text>
                  {selectedOccurrence && eligibility.isEligible && (
                    <ChevronRight size={20} color="white" />
                  )}
                </View>
              </Button>
            </View>
          </SafeAreaView>
        </View>

        {/* Payment Sheet for Paid Events - Only for in-app payment */}
        {isPaidEvent && requiresInAppPayment && selectedOccurrence && (
          <EventPaymentSheet
            visible={showPaymentSheet}
            onClose={() => setShowPaymentSheet(false)}
            onConfirm={handlePaymentConfirm}
            event={event}
            partySize={partySize}
            eventDate={formatEventDateRange(
              selectedOccurrence.occurrence_date,
              selectedOccurrence.end_date,
              format,
            )}
            loading={bookingLoading || paymentLoading}
          />
        )}

        {/* Special Menu PDF Viewer Modal */}
        {event.special_menu_url && (
          <Modal
            visible={showMenuPDF}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowMenuPDF(false)}
          >
            <SafeAreaView edges={["top"]} className="flex-1 bg-background">
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
                <Text className="text-lg font-semibold text-foreground">
                  Special Menu
                </Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={async () => {
                      try {
                        await Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        );
                        const shareContent: {
                          message: string;
                          url?: string;
                          title?: string;
                        } = {
                          message:
                            Platform.OS === "android"
                              ? `Special Menu - ${event.title}\n\nDownload: ${event.special_menu_url}`
                              : `Special Menu - ${event.title}`,
                          title: `${event.title} Special Menu`,
                        };
                        if (Platform.OS === "ios") {
                          shareContent.url = event.special_menu_url ?? undefined;
                        }
                        await Share.share(shareContent);
                      } catch {
                        // Ignore share errors
                      }
                    }}
                    className="w-10 h-10 items-center justify-center rounded-full bg-primary/10"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Share2 size={20} className="text-primary" />
                  </Pressable>
                  <Pressable
                    onPress={() => setShowMenuPDF(false)}
                    className="w-10 h-10 items-center justify-center rounded-full bg-muted"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={20} className="text-foreground" />
                  </Pressable>
                </View>
              </View>
              {/* PDF Viewer - hideShare since header has share button */}
              <PDFViewer
                url={event.special_menu_url}
                title="Special Menu"
                restaurantName={event.title}
                hideShare
              />
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}
