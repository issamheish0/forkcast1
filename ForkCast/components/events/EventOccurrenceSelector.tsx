import React from "react";
import { View, Pressable } from "react-native";
import { Calendar, Users } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import type { EventOccurrence } from "@/types/events";
import {
  formatOccurrenceRange,
  getRemainingCapacity,
  isOccurrenceAvailable,
} from "@/types/events";
import { format } from "date-fns";

interface EventOccurrenceSelectorProps {
  occurrences: EventOccurrence[];
  selectedOccurrence: EventOccurrence | null;
  onSelectOccurrence: (occurrence: EventOccurrence) => void;
  partySize?: number;
}

export function EventOccurrenceSelector({
  occurrences,
  selectedOccurrence,
  onSelectOccurrence,
  partySize = 1,
}: EventOccurrenceSelectorProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (!occurrences || occurrences.length === 0) {
    return (
      <View className="bg-muted/30 rounded-xl p-4">
        <Text className="text-sm text-muted-foreground text-center">
          No upcoming dates available for this event
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-3">
      {occurrences.map((occurrence) => {
        const isSelected = selectedOccurrence?.id === occurrence.id;
        const isAvailable = isOccurrenceAvailable(occurrence, partySize);
        const isFull = occurrence.status === "full";
        const remainingCapacity = getRemainingCapacity(occurrence);
        const rangeLabel = formatOccurrenceRange(occurrence, format);

        return (
          <Pressable
            key={occurrence.id}
            onPress={() => isAvailable && onSelectOccurrence(occurrence)}
            disabled={!isAvailable}
            className={`w-full rounded-xl border p-4 ${
              isSelected
                ? "bg-primary border-primary"
                : isAvailable
                  ? "bg-background border-border"
                  : "bg-muted/30 border-border opacity-60"
            }`}
          >
            {/* Date & Time combined */}
            <View className="flex-row items-center gap-2 mb-2">
              <Calendar
                size={14}
                color={isSelected ? "#FFF" : isDark ? "#9CA3AF" : "#6B7280"}
              />
              <Text
                className={`text-sm font-semibold ${
                  isSelected ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {rangeLabel}
              </Text>
            </View>

            {/* Capacity Status */}
            {occurrence.max_capacity !== null && (
              <View className="flex-row items-center gap-2">
                <Users
                  size={14}
                  color={isSelected ? "#FFF" : isDark ? "#9CA3AF" : "#6B7280"}
                />
                <Text
                  className={`text-xs ${
                    isSelected
                      ? "text-primary-foreground"
                      : isFull
                        ? "text-red-500"
                        : remainingCapacity !== null && remainingCapacity < 5
                          ? "text-amber-500"
                          : "text-muted-foreground"
                  }`}
                >
                  {isFull
                    ? "Fully Booked"
                    : remainingCapacity !== null
                      ? `${remainingCapacity} spots left`
                      : "Available"}
                </Text>
              </View>
            )}

            {/* Status Badge */}
            {!isAvailable && (
              <View className="mt-2 bg-red-500/20 rounded px-2 py-1">
                <Text className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
                  {occurrence.status === "cancelled"
                    ? "Cancelled"
                    : occurrence.status === "completed"
                      ? "Completed"
                      : "Unavailable"}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
