import React from "react";
import { View, Pressable } from "react-native";
import { Calendar, Users, ChevronRight } from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import type {
  RestaurantEventWithOccurrences,
  EventOccurrence,
} from "@/types/events";
import {
  formatOccurrenceRange,
  getRemainingCapacity,
  EVENT_TYPE_LABELS,
} from "@/types/events";
import { format } from "date-fns";

interface RestaurantEventCardProps {
  event: RestaurantEventWithOccurrences;
  onPress: () => void;
  /** When "ramadan", uses layout: Iftar/Suhoor tag, spots top-left, restaurant name (if shown), event name, date·time·price, chevron */
  variant?: "default" | "ramadan";
  /** When true (default), show restaurant name on ramadan variant. Set false when already on a restaurant page (events tab, ramadan restaurant details). */
  showRestaurantName?: boolean;
}

export function RestaurantEventCard({
  event,
  onPress,
  variant = "default",
  showRestaurantName = true,
}: RestaurantEventCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Get the next occurrence (first one in the sorted list)
  const nextOccurrence: EventOccurrence | null =
    event.occurrences && event.occurrences.length > 0
      ? event.occurrences[0]
      : null;

  if (!nextOccurrence) {
    return null; // Don't render if there are no occurrences
  }

  const remainingCapacity = getRemainingCapacity(nextOccurrence);
  const occurrenceRange = formatOccurrenceRange(nextOccurrence, format);
  const eventTypeLabel = event.event_type
    ? EVENT_TYPE_LABELS[event.event_type as keyof typeof EVENT_TYPE_LABELS] ||
      "Event"
    : "Event";

  // Ramadan variant: Iftar/Suhoor tag with emoji
  const isRamadan = variant === "ramadan";
  const ramadanTag =
    event.event_type === "ramadan_iftar"
      ? { emoji: "🌅", label: "Iftar" }
      : event.event_type === "ramadan_suhoor"
        ? { emoji: "🌙", label: "Suhoor" }
        : null;

  const restaurantName =
    event.restaurant &&
    typeof event.restaurant === "object" &&
    "name" in event.restaurant
      ? (event.restaurant as { name?: string }).name
      : null;

  // Price: occurrence override or event price_per_person
  const priceAmount =
    nextOccurrence.override_price != null
      ? nextOccurrence.override_price
      : event.price_per_person;
  const priceFormatted =
    priceAmount != null && priceAmount > 0
      ? `$${Math.round(priceAmount)}`
      : null;

  // Spots badge: top-right for default, top-left for ramadan
  const statusBadge =
    nextOccurrence.status === "full" ? (
      <View
        className={`absolute top-3 bg-red-500 px-2 py-1 rounded-full ${isRamadan ? "left-3" : "right-3"}`}
      >
        <Text className="text-white text-xs font-semibold">Fully Booked</Text>
      </View>
    ) : remainingCapacity !== null && remainingCapacity < 5 ? (
      <View
        className={`absolute top-3 bg-amber-500 px-2 py-1 rounded-full ${isRamadan ? "left-3" : "right-3"}`}
      >
        <Text className="text-white text-xs font-semibold">
          {remainingCapacity} spots left
        </Text>
      </View>
    ) : null;

  const chevronColor = isDark ? "white" : "#800020";

  if (isRamadan) {
    // Ramadan Special layout: image with spots left + Iftar/Suhoor tags top-left; below: restaurant, event name, date · time · price
    return (
      <Pressable
        onPress={onPress}
        className="bg-card rounded-xl border border-border overflow-hidden mb-3 active:opacity-80 relative"
      >
        {/* Event Image */}
        {event.image_url && (
          <View className="relative">
            <Image
              source={{ uri: event.image_url }}
              style={{ width: "100%", aspectRatio: 16 / 9 }}
              contentFit="cover"
            />
            {/* Top-left: Iftar/Suhoor tag first, then spots left */}
            <View className="absolute top-3 left-3 flex-row items-center gap-2 flex-wrap">
              {ramadanTag && (
                <View className="flex-row items-center bg-black/60 px-2 py-1 rounded-full">
                  <Text className="text-white text-xs font-semibold">
                    {ramadanTag.emoji} {ramadanTag.label}
                  </Text>
                </View>
              )}
              {nextOccurrence.status === "full" ? (
                <View className="bg-red-500 px-2 py-1 rounded-full">
                  <Text className="text-white text-xs font-semibold">
                    Fully Booked
                  </Text>
                </View>
              ) : remainingCapacity !== null && remainingCapacity < 5 ? (
                <View className="bg-amber-500 px-2 py-1 rounded-full">
                  <Text className="text-white text-xs font-semibold">
                    {remainingCapacity} spots left
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Content below image: restaurant (primary), event name (normal), date · time · price with icons; right = chevron centered */}
        <View className="flex-row items-center p-3">
          <View className="flex-1 pr-3 min-w-0">
            {/* Restaurant name first - primary color, bold (hidden when showRestaurantName is false, e.g. on restaurant page) */}
            {showRestaurantName && restaurantName && (
              <Text
                className="text-base font-bold mb-1"
                style={{
                  color: colors[isDark ? "dark" : "light"].primary,
                }}
                numberOfLines={1}
              >
                {restaurantName}
              </Text>
            )}
            {/* Event name (normal weight) */}
            <Text
              className="text-base font-normal text-foreground mb-1.5"
              numberOfLines={1}
            >
              {event.title}
            </Text>
            {/* Date/time range · price */}
            <View className="flex-row items-center flex-wrap gap-x-0 gap-y-0">
              <View className="flex-row items-center gap-1">
                <Calendar size={12} color={isDark ? "#9CA3AF" : "#6B7280"} />
                <Text className="text-xs text-muted-foreground">
                  {occurrenceRange}
                </Text>
              </View>
              {priceFormatted && (
                <>
                  <Text className="text-xs text-muted-foreground px-1.5">
                    ·
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {priceFormatted}
                  </Text>
                </>
              )}
            </View>
          </View>
          {/* Chevron centered in section */}
          <View className="items-center justify-center flex-shrink-0">
            <ChevronRight size={20} color={chevronColor} />
          </View>
        </View>
      </Pressable>
    );
  }

  // Default layout
  return (
    <Pressable
      onPress={onPress}
      className="bg-card rounded-xl border border-border overflow-hidden mb-3 active:opacity-80 relative"
    >
      {/* Chevron in top right - always visible */}
      <View className="absolute top-3 right-3 z-10">
        <ChevronRight size={16} color={chevronColor} />
      </View>

      {/* Event Image */}
      {event.image_url && (
        <View className="relative">
          <Image
            source={{ uri: event.image_url }}
            style={{ width: "100%", aspectRatio: 16 / 9 }}
            contentFit="cover"
          />
          {statusBadge}
          {/* Event Type Badge */}
          <View className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">
              {eventTypeLabel}
            </Text>
          </View>
        </View>
      )}

      {/* Event Info */}
      <View className="p-3">
        {/* Title and Description */}
        <View className="mb-2">
          <Text className="text-base font-bold text-foreground mb-1">
            {event.title}
          </Text>
          {event.description && (
            <Text
              className="text-sm text-muted-foreground"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {event.description}
            </Text>
          )}
        </View>

        {/* Next Occurrence Details */}
        <View className="flex-row items-center gap-3 mb-2">
          {/* Date & Time */}
          <View className="flex-row items-center gap-1.5">
            <Calendar size={12} color={isDark ? "#9CA3AF" : "#6B7280"} />
            <Text className="text-xs text-muted-foreground">
              {occurrenceRange}
            </Text>
          </View>
        </View>

        {/* Constraints */}
        <View className="flex-row items-center gap-3 mb-2">
          {/* Party Size */}
          {event.minimum_party_size > 1 || event.maximum_party_size !== null ? (
            <View className="flex-row items-center gap-1.5">
              <Users size={12} color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Text className="text-xs text-muted-foreground">
                {event.minimum_party_size === event.maximum_party_size
                  ? `${event.minimum_party_size} guests`
                  : event.maximum_party_size
                    ? `${event.minimum_party_size}-${event.maximum_party_size} guests`
                    : `${event.minimum_party_size}+ guests`}
              </Text>
            </View>
          ) : null}

          {/* Age Restriction */}
          {event.minimum_age && (
            <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
              <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                {event.minimum_age}+
              </Text>
            </View>
          )}
        </View>

        {/* More Occurrences Indicator */}
        {event.occurrences.length > 1 && (
          <Text className="text-xs text-muted-foreground">
            +{event.occurrences.length - 1} more date
            {event.occurrences.length > 2 ? "s" : ""} available
          </Text>
        )}
      </View>
    </Pressable>
  );
}
