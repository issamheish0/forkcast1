// hooks/useSearchLogic.ts — Mock version (delegates to useRestaurantSearch)
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { Region } from "react-native-maps";
import { useRestaurantSearch } from "@/hooks/useRestaurantSearch";
import {
  DEFAULT_BOOKING_FILTERS,
  DEFAULT_GENERAL_FILTERS,
  DEFAULT_MAP_REGION,
} from "@/constants/searchConstants";
import type { BookingFilters, GeneralFilters, ViewMode } from "@/types/search";

export function useSearchLogic() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [bookingFilters, setBookingFilters] = useState<BookingFilters>(DEFAULT_BOOKING_FILTERS);
  const [generalFilters, setGeneralFilters] = useState<GeneralFilters>(DEFAULT_GENERAL_FILTERS);
  const [showBookingFilters, setShowBookingFilters] = useState(false);
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);
  const [isGuestPromptVisible, setIsGuestPromptVisible] = useState(false);

  const searchFilters = useMemo(() => ({
    cuisines: generalFilters.cuisines ?? [],
    features: generalFilters.features ?? [],
    bookingPolicy: "all" as const,
    priceRange: [1, 4] as [number, number],
    sortBy: "rating" as const,
  }), [generalFilters]);

  const { restaurants, loading } = useRestaurantSearch({ query, filters: searchFilters });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (bookingFilters.date) count++;
    if (bookingFilters.time) count++;
    if (bookingFilters.partySize !== DEFAULT_BOOKING_FILTERS.partySize) count++;
    if ((generalFilters.cuisines ?? []).length > 0) count++;
    return count;
  }, [bookingFilters, generalFilters]);

  return {
    searchState: {
      query,
      searchQuery: query, // alias expected by search.tsx
      viewMode,
      bookingFilters,
      generalFilters,
      restaurants,
      loading,
      refreshing: false,
      favorites: new Set<string>(),
      userLocation: null,
      mapRegion,
      selectedRestaurant,
      isGuestPromptVisible,
      showBookingFilters,
      showGeneralFilters,
      showDatePicker,
      showTimePicker,
      showPartySizePicker,
    },
    actions: {
      setQuery,
      setSearchQuery: setQuery, // alias expected by search.tsx
      setViewMode,
      setBookingFilters,
      setGeneralFilters,
      updateGeneralFilters: setGeneralFilters,
      updateBookingFilters: (updates: Partial<BookingFilters>) =>
        setBookingFilters((prev) => ({ ...prev, ...updates })),
      setShowBookingFilters,
      setShowGeneralFilters,
      setShowDatePicker,
      setShowTimePicker,
      setShowPartySizePicker,
      setSelectedRestaurant,
      setMapRegion,
      setIsGuestPromptVisible,
      toggleFavorite: (_id: string) => {},
      handleRefresh: () => {},
      clearAllFilters: () => {
        setBookingFilters(DEFAULT_BOOKING_FILTERS);
        setGeneralFilters(DEFAULT_GENERAL_FILTERS);
      },
    },
    handlers: {
      handleRestaurantPress: (id: string) => router.push(`/(protected)/restaurant/${id}`),
      openDirections: (_restaurant: any) => {},
      handleFavoriteToggle: (_id: string) => {},
      handleSearch: (_q: string) => {},
      handleClearSearch: () => setQuery(""),
      handleApplyBookingFilters: (f: BookingFilters) => setBookingFilters(f),
      handleApplyGeneralFilters: (f: GeneralFilters) => setGeneralFilters(f),
      handleClearAllFilters: () => {
        setBookingFilters(DEFAULT_BOOKING_FILTERS);
        setGeneralFilters(DEFAULT_GENERAL_FILTERS);
      },
    },
    computed: {
      activeFilterCount,
      hasActiveFilters: activeFilterCount > 0,
      dateOptions: [],
    },
  };
}
