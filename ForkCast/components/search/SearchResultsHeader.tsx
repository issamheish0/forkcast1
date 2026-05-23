// components/search/SearchResultsHeader.tsx
import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import type { BookingFilters } from "@/types/search";
import { formatDateShort } from "@/utils/birthday";

interface SearchResultsHeaderProps {
  restaurantCount: number;
  loading: boolean;
  bookingFilters: BookingFilters;
}

export const SearchResultsHeader = React.memo(
  ({ restaurantCount, loading, bookingFilters }: SearchResultsHeaderProps) => {
    const { location } = useLocationWithDistance();

    const getLocationText = () => {
      if (!location) return "";

      if (
        location.district &&
        location.city &&
        location.district !== location.city
      ) {
        return ` in ${location.district}, ${location.city}`;
      }
      return ` in ${location.city}`;
    };

    const getFilterText = () => {
      if (bookingFilters.availableOnly) {
        return ` • Showing only available restaurants`;
      }

      if (
        bookingFilters.date === null &&
        bookingFilters.partySize === null &&
        bookingFilters.time === null
      ) {
        return ` • Showing all restaurants`;
      }

      const parts = [];

      // Add party size info
      if (bookingFilters.partySize !== null) {
        parts.push(`party of ${bookingFilters.partySize}`);
      }

      // Add date/time info
      if (bookingFilters.date !== null || bookingFilters.time !== null) {
        let dateTimePart = "";

        if (bookingFilters.date !== null && bookingFilters.time !== null) {
          const datePart =
            bookingFilters.date.toDateString() === new Date().toDateString()
              ? "today"
              : `${String(bookingFilters.date.getDate()).padStart(2, "0")}/${String(bookingFilters.date.getMonth() + 1).padStart(2, "0")}`;
          dateTimePart = `${datePart} at ${bookingFilters.time}`;
        } else if (bookingFilters.date !== null) {
          const datePart =
            bookingFilters.date.toDateString() === new Date().toDateString()
              ? "today"
              : `${String(bookingFilters.date.getDate()).padStart(2, "0")}/${String(bookingFilters.date.getMonth() + 1).padStart(2, "0")}`;
          dateTimePart = `${datePart} at any time`;
        } else if (bookingFilters.time !== null) {
          dateTimePart = `any date at ${bookingFilters.time}`;
        }

        if (dateTimePart) {
          parts.push(dateTimePart);
        }
      }

      if (parts.length === 0) {
        return ` • Showing all restaurants`;
      }

      return ` • Showing availability for ${parts.join(", ")}`;
    };

    return (
      <View className="px-4 py-2 border-b border-border">
        <Text className="text-sm text-muted-foreground">
          {loading ? (
            "Searching restaurants..."
          ) : (
            <>
              Restaurants{getLocationText()}
              {getFilterText()}
            </>
          )}
        </Text>
      </View>
    );
  },
);
