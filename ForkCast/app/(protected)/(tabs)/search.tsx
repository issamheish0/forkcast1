// app/(protected)/(tabs)/search.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Keyboard } from "react-native";
import { Region } from "react-native-maps";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { useAuth } from "@/context/supabase-provider"; // Import useAuth
import { useColorScheme } from "@/lib/useColorScheme";
import { useSearchLogic } from "@/hooks/useSearchLogic";
import {
  DEFAULT_MAP_REGION,
  DEFAULT_GENERAL_FILTERS,
} from "@/constants/searchConstants";
import { SearchHeader } from "@/components/search/SearchHeader";
import { ViewToggleTabs, ViewMode } from "@/components/search/ViewToggleTabs";
import { SearchContent } from "@/components/search/SearchContent";
import { BookingQuickModal } from "@/components/search/BookingQuickModal";
import { DatePickerModal } from "@/components/search/DatePickerModal";
import { TimePickerModal } from "@/components/search/TimePickerModal";
import { PartySizePickerModal } from "@/components/search/PartySizePickerModal";
import { GeneralFiltersModal } from "@/components/search/GeneralFiltersModal";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import {
  getSearchHistory,
  addToSearchHistory,
  removeFromSearchHistory,
  clearSearchHistory,
  type SearchHistoryItem,
} from "@/lib/searchHistory";
import type { GeneralFilters } from "@/types/search";

const isDefaultPriceRange = (priceRange: number[]): boolean => {
  if (priceRange.length !== DEFAULT_GENERAL_FILTERS.priceRange.length) {
    return false;
  }

  return priceRange.every(
    (value, index) => value === DEFAULT_GENERAL_FILTERS.priceRange[index],
  );
};

const createFilterSnapshot = (filters: GeneralFilters) => ({
  cuisines: [...filters.cuisines],
  features: [...filters.features],
  priceRange: [...filters.priceRange],
  minRating: filters.minRating,
});

const STABLE_QUERY_THRESHOLD_MS = 600;

export default function SearchScreen() {
  const { colorScheme } = useColorScheme();
  const { searchState, actions, handlers, computed } = useSearchLogic();
  const navigation = useNavigation();

  // Get focus param from navigation (passed from home screen search bar)
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [tabFocusSignal, setTabFocusSignal] = useState<string | undefined>();

  // Focus search input every time this tab comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setTabFocusSignal(String(Date.now()));
    });
    return unsubscribe;
  }, [navigation]);

  // --- MODIFIED: Auth and Guest State ---
  const { user, isGuest, convertGuestToUser } = useAuth();
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Other modal visibility states
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // --- Recent Search History State ---
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Map region state
  const [mapRegion, setMapRegion] = useState<Region>(() => {
    if (searchState.userLocation) {
      return {
        latitude: searchState.userLocation.latitude,
        longitude: searchState.userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return DEFAULT_MAP_REGION;
  });

  // Update map region when user location changes
  React.useEffect(() => {
    if (searchState.userLocation) {
      setMapRegion((prev) => ({
        ...prev,
        latitude: searchState.userLocation!.latitude,
        longitude: searchState.userLocation!.longitude,
      }));
    }
  }, [searchState.userLocation]);

  // --- Load search history on mount ---
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async (): Promise<void> => {
    const history = await getSearchHistory();
    setSearchHistory(history);
  };

  // --- Save search to history when search completes ---
  // Use refs to track state
  const lastSavedSearchRef = useRef<string>("");
  const latestSearchSnapshotRef = useRef<{
    query: string;
    filters: {
      cuisines: string[];
      features: string[];
      priceRange: number[];
      minRating: number;
    };
  } | null>(null);
  const previousLoadingRef = useRef<boolean>(searchState.loading);
  const previousQueryRef = useRef<string>(searchState.searchQuery.trim());
  const previousFiltersRef = useRef<GeneralFilters>(searchState.generalFilters);
  const lastQueryChangeAtRef = useRef<number>(Date.now());
  const lastFilterChangeAtRef = useRef<number>(0);

  // Track query changes and update snapshot state
  useEffect(() => {
    const trimmedQuery = searchState.searchQuery.trim();

    if (trimmedQuery !== previousQueryRef.current) {
      previousQueryRef.current = trimmedQuery;
      lastQueryChangeAtRef.current = Date.now();
    }

    if (trimmedQuery.length >= 2) {
      latestSearchSnapshotRef.current = {
        query: trimmedQuery,
        filters: createFilterSnapshot(searchState.generalFilters),
      };
    }
  }, [searchState.searchQuery, searchState.generalFilters]);

  // Track filter changes so updated filters are reflected in the snapshot
  useEffect(() => {
    if (previousFiltersRef.current !== searchState.generalFilters) {
      previousFiltersRef.current = searchState.generalFilters;
      lastFilterChangeAtRef.current = Date.now();

      const trimmedQuery = searchState.searchQuery.trim();
      if (trimmedQuery.length >= 2) {
        latestSearchSnapshotRef.current = {
          query: trimmedQuery,
          filters: createFilterSnapshot(searchState.generalFilters),
        };
      }
    }
  }, [searchState.generalFilters, searchState.searchQuery]);

  useEffect(() => {
    const previousLoading = previousLoadingRef.current;
    previousLoadingRef.current = searchState.loading;

    const snapshot = latestSearchSnapshotRef.current;
    const currentQueryTrimmed = searchState.searchQuery.trim();
    const now = Date.now();
    const transitionedToIdle = previousLoading && !searchState.loading;
    const hasResults = searchState.restaurants.length > 0;
    const timeSinceQueryChange = now - lastQueryChangeAtRef.current;
    const timeSinceFilterChange =
      lastFilterChangeAtRef.current === 0
        ? null
        : now - lastFilterChangeAtRef.current;
    const matchesSnapshot =
      snapshot !== null &&
      (currentQueryTrimmed.length === 0 ||
        currentQueryTrimmed.toLowerCase() === snapshot.query.toLowerCase());
    const queryStable =
      currentQueryTrimmed.length === 0 ||
      timeSinceQueryChange >= STABLE_QUERY_THRESHOLD_MS;
    const shouldAttemptSave =
      snapshot !== null &&
      transitionedToIdle &&
      hasResults &&
      matchesSnapshot &&
      queryStable;

    if (shouldAttemptSave && snapshot) {
      const { query, filters } = snapshot;
      const searchKey = JSON.stringify({
        query,
        cuisines: filters.cuisines,
        priceRange: filters.priceRange,
        rating: filters.minRating,
      });

      if (searchKey !== lastSavedSearchRef.current) {
        lastSavedSearchRef.current = searchKey;

        const saveSearch = async (): Promise<void> => {
          const shouldIncludePriceRange =
            filters.priceRange.length > 0 &&
            !isDefaultPriceRange(filters.priceRange);
          await addToSearchHistory(query, {
            cuisine:
              filters.cuisines.length > 0
                ? filters.cuisines.join(", ")
                : undefined,
            priceRange: shouldIncludePriceRange
              ? Math.max(...filters.priceRange).toString()
              : undefined,
            rating:
              filters.minRating > 0 ? filters.minRating.toString() : undefined,
            features:
              filters.features.length > 0 ? filters.features : undefined,
          });
          await loadSearchHistory();
        };
        saveSearch();
      }
    }
  }, [searchState.loading, searchState.restaurants.length]);

  // --- NEW: Guest Guard Logic ---
  // This function wraps actions that are not available to guests.
  const runProtectedAction = (callback: () => void) => {
    if (isGuest) {
      // If user is a guest, show the prompt instead of running the action.
      setShowGuestPrompt(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (user) {
      // If user is logged in, run the action.
      callback();
    }
  };

  // --- NEW: Handler for the guest prompt's confirm button ---
  const handleConfirmGuestPrompt = async () => {
    setShowGuestPrompt(false);
    await convertGuestToUser();
    // The AuthProvider will automatically handle navigation to the welcome screen.
  };

  // --- MODIFIED: The favorite action is now wrapped by the guest guard ---
  const handleToggleFavoriteProtected = async (restaurantId: string) => {
    runProtectedAction(() => actions.toggleFavorite(restaurantId));
  };

  // --- Search History Handlers ---
  const handleSelectSearch = useCallback(
    (item: SearchHistoryItem) => {
      // Reapply search query
      actions.setSearchQuery(item.query);

      // Reapply filters
      if (item.filters) {
        const updatedFilters: Partial<typeof searchState.generalFilters> = {};

        if (item.filters.cuisine) {
          updatedFilters.cuisines = item.filters.cuisine
            .split(", ")
            .filter(Boolean);
        }

        if (item.filters.priceRange) {
          const maxPrice = parseInt(item.filters.priceRange, 10);
          if (!isNaN(maxPrice)) {
            updatedFilters.priceRange = Array.from(
              { length: maxPrice },
              (_, i) => i + 1,
            );
          }
        }

        if (item.filters.rating) {
          const rating = parseFloat(item.filters.rating);
          if (!isNaN(rating)) {
            updatedFilters.minRating = rating;
          }
        }

        if (item.filters.features) {
          updatedFilters.features = item.filters.features;
        }

        actions.updateGeneralFilters({
          ...searchState.generalFilters,
          ...updatedFilters,
        });
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [actions, searchState.generalFilters],
  );

  const handleRemoveSearch = useCallback(async (id: string) => {
    await removeFromSearchHistory(id);
    await loadSearchHistory();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleClearAllSearches = useCallback(async () => {
    await clearSearchHistory();
    setSearchHistory([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleScroll = useCallback(
    (event: any) => {
      if (searchState.viewMode === "map") return;

      Keyboard.dismiss();

      const scrollY = event.nativeEvent.contentOffset.y;
      const shouldCollapse = scrollY > 20;
      if (shouldCollapse !== isHeaderCollapsed) {
        setIsHeaderCollapsed(shouldCollapse);
      }
    },
    [isHeaderCollapsed, searchState.viewMode],
  );

  const handleMapViewSelected = useCallback(() => {
    requestAnimationFrame(() => {
      if (!isHeaderCollapsed) {
        setIsHeaderCollapsed(true);
      }
    });
  }, [isHeaderCollapsed]);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      actions.setViewMode(mode);
      requestAnimationFrame(() => {
        if (mode === "list" && isHeaderCollapsed) {
          setIsHeaderCollapsed(false);
        }
      });
    },
    [actions, isHeaderCollapsed],
  );

  const handleMapRegionChange = useCallback((region: Region) => {
    setMapRegion(region);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SearchHeader
        searchQuery={searchState.searchQuery}
        bookingFilters={searchState.bookingFilters}
        activeFilterCount={computed.activeFilterCount}
        colorScheme={colorScheme}
        isCollapsed={isHeaderCollapsed}
        isSearching={searchState.loading}
        focusSignal={focus || tabFocusSignal}
        onSearchChange={actions.setSearchQuery}
        onShowDatePicker={() => setShowDatePicker(true)}
        onShowTimePicker={() => setShowTimePicker(true)}
        onShowPartySizePicker={() => setShowPartySizePicker(true)}
        onShowGeneralFilters={() => setShowGeneralFilters(true)}
      />

      <ViewToggleTabs
        viewMode={searchState.viewMode}
        colorScheme={colorScheme}
        onViewModeChange={handleViewModeChange}
        onMapViewSelected={handleMapViewSelected}
        restaurantCount={searchState.restaurants.length}
      />

      <SearchContent
        viewMode={searchState.viewMode}
        restaurants={searchState.restaurants}
        favorites={searchState.favorites}
        loading={searchState.loading}
        refreshing={searchState.refreshing}
        bookingFilters={searchState.bookingFilters}
        colorScheme={colorScheme}
        mapRegion={mapRegion}
        onToggleFavorite={handleToggleFavoriteProtected} // MODIFIED: Use the protected handler
        onDirections={handlers.openDirections}
        onRestaurantPress={handlers.handleRestaurantPress}
        onRefresh={actions.handleRefresh}
        onClearFilters={actions.clearAllFilters}
        onMapRegionChange={handleMapRegionChange}
        onScroll={handleScroll}
      />

      {/* Modals */}
      <BookingQuickModal
        visible={showBookingModal}
        bookingFilters={searchState.bookingFilters}
        colorScheme={colorScheme}
        onClose={() => setShowBookingModal(false)}
        onApply={(filters) => {
          actions.updateBookingFilters(filters);
          setShowBookingModal(false);
        }}
      />

      <DatePickerModal
        visible={showDatePicker}
        bookingFilters={searchState.bookingFilters}
        onDateSelect={(date) => actions.updateBookingFilters({ date })}
        onClose={() => setShowDatePicker(false)}
      />

      <TimePickerModal
        visible={showTimePicker}
        bookingFilters={searchState.bookingFilters}
        onTimeSelect={(time) => actions.updateBookingFilters({ time })}
        onClose={() => setShowTimePicker(false)}
      />

      <PartySizePickerModal
        visible={showPartySizePicker}
        bookingFilters={searchState.bookingFilters}
        onPartySizeSelect={(partySize) =>
          actions.updateBookingFilters({ partySize })
        }
        onClose={() => setShowPartySizePicker(false)}
      />

      <GeneralFiltersModal
        visible={showGeneralFilters}
        generalFilters={searchState.generalFilters}
        onApplyFilters={(filters) => {
          actions.updateGeneralFilters(filters);
          setShowGeneralFilters(false);
        }}
        onClose={() => setShowGeneralFilters(false)}
      />

      {/* Guest prompt modal for protected actions */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onSignUp={handleConfirmGuestPrompt}
        featureName="save restaurants to your favorites"
      />
    </SafeAreaView>
  );
}
