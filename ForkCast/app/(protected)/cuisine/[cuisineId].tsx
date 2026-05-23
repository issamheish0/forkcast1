// app/(protected)/cuisine/[cuisineId].tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  Star,
  Filter,
  SlidersHorizontal,
  Clock,
  Utensils,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import RestaurantSearchCardSkeleton from "@/components/skeletons/RestaurantSearchCardSkeleton";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { MOCK_RESTAURANTS } from "@/lib/mockData";
import type { Restaurant } from "@/types/search";
import { checkRestaurantAvailability } from "@/lib/searchUtils";
import { useCuisineSponsorship } from "@/hooks/useCuisineSponsorship";

// Type Definitions
type DatabaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type CuisineScreenParams = {
  cuisineId: string;
  cuisineName?: string;
};

type FilterOptions = {
  priceRange: number[];
  rating: number;
  distance: number;
  sortBy: "rating" | "distance" | "name" | "price";
  openNow: boolean;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "distance", label: "Nearest" },
  { value: "name", label: "Name (A-Z)" },
  { value: "price", label: "Price (Low to High)" },
] as const;

export default function CuisineScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { cuisineId, cuisineName } =
    useLocalSearchParams<CuisineScreenParams>();

  // Ramadan is a collection/section, not a cuisine - redirect to Ramadan page
  useEffect(() => {
    if (cuisineId && cuisineId.toLowerCase() === "ramadan") {
      router.replace("/ramadan");
    }
  }, [cuisineId, router]);

  // Cuisine sponsorship hook - fetches sponsored restaurants for this cuisine
  const {
    sortWithSponsored,
    isSponsored,
    getSponsorshipId,
    trackImpression,
    trackClick,
    loading: sponsorshipLoading,
  } = useCuisineSponsorship(cuisineId);

  // State Management
  const [restaurants, setRestaurants] = useState<DatabaseRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    priceRange: [1, 2, 3, 4],
    rating: 0,
    distance: 50,
    sortBy: "rating",
    openNow: false,
  });

  // Fetch restaurants by cuisine — uses MOCK_RESTAURANTS in Expo Go
  const fetchCuisineRestaurants = useCallback(async () => {
    try {
      setLoading(true);

      // Use mock data — filter client-side for reliable matching
      const allData = MOCK_RESTAURANTS as any[];

      // Filter restaurants that match the cuisine (case-insensitive)
      const cuisineLower = cuisineId.toLowerCase();
      const restaurantData = allData.filter((restaurant) => {
        // Check primary cuisine_type (case-insensitive)
        if (restaurant.cuisine_type?.toLowerCase() === cuisineLower) {
          return true;
        }
        // Check secondary_cuisines array (case-insensitive)
        if (restaurant.secondary_cuisines?.length) {
          const hasSecondary = restaurant.secondary_cuisines.some(
            (cuisine: string) => cuisine.toLowerCase() === cuisineLower,
          );
          if (hasSecondary) return true;
        }
        // Check tags as fallback
        if (restaurant.tags?.length) {
          const hasTag = restaurant.tags.some(
            (tag: string) => tag.toLowerCase() === cuisineLower,
          );
          if (hasTag) return true;
        }
        return false;
      });

      // Apply additional filters
      let processedRestaurants = restaurantData;

      // Rating filter
      if (filters.rating > 0) {
        processedRestaurants = processedRestaurants.filter(
          (restaurant) => (restaurant.average_rating || 0) >= filters.rating,
        );
      }

      // Price range filter
      if (filters.priceRange.length < 4) {
        processedRestaurants = processedRestaurants.filter((restaurant) =>
          filters.priceRange.includes(restaurant.price_range),
        );
      }

      // Apply client-side filtering for open now using enhanced availability checking
      if (filters.openNow) {
        const now = new Date();
        const availabilityChecks = await Promise.all(
          processedRestaurants.map(async (restaurant) => {
            try {
              const isOpen = await checkRestaurantAvailability(
                restaurant.id,
                now,
                "19:00", // Default time check
                2, // Default party size
              );
              return { ...restaurant, isCurrentlyOpen: isOpen };
            } catch (error) {
              console.error(
                "Error checking availability for restaurant:",
                restaurant.id,
                error,
              );
              return { ...restaurant, isCurrentlyOpen: true }; // Conservative fallback
            }
          }),
        );

        processedRestaurants = availabilityChecks.filter(
          (restaurant) => restaurant.isCurrentlyOpen,
        );
      }

      // Sort restaurants
      processedRestaurants.sort(getSortComparator(filters.sortBy));

      setRestaurants(processedRestaurants as DatabaseRestaurant[]);
    } catch (error) {
      console.error("Error in fetchCuisineRestaurants:", error);
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cuisineId, filters]);

  // Utility Functions
  const getSortComparator = (sortBy: FilterOptions["sortBy"]) => {
    return (a: Restaurant, b: Restaurant) => {
      // Prioritize featured restaurants
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      switch (sortBy) {
        case "rating": {
          const aHas =
            typeof a.average_rating === "number" && (a.average_rating || 0) > 0;
          const bHas =
            typeof b.average_rating === "number" && (b.average_rating || 0) > 0;
          if (aHas && !bHas) return -1; // a before b
          if (!aHas && bHas) return 1; // b before a
          const aRating = a.average_rating || 0;
          const bRating = b.average_rating || 0;
          return bRating - aRating; // desc when both rated or both unrated
        }
        case "name":
          return a.name.localeCompare(b.name);
        case "price":
          return (a.price_range || 0) - (b.price_range || 0);
        case "distance":
          // Placeholder - implement distance calculation if needed
          return 0;
        default:
          return 0;
      }
    };
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCuisineRestaurants();
  }, [fetchCuisineRestaurants]);

  const handleRestaurantPress = useCallback(
    (restaurant: Restaurant) => {
      router.push(`/(protected)/restaurant/${restaurant.id}`);
    },
    [router],
  );

  const handleToggleFavorite = useCallback(async (restaurantId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(restaurantId)) {
        newFavorites.delete(restaurantId);
      } else {
        newFavorites.add(restaurantId);
      }
      return newFavorites;
    });
  }, []);

  const handleDirections = useCallback(async (restaurant: any) => {
    // Simple directions implementation that works with the restaurant data
    // Default coordinates (Beirut) if no location available
    let lat = 33.8938;
    let lng = 35.5018;

    // Try to extract location from various possible formats
    if (restaurant.location) {
      if (
        typeof restaurant.location === "object" &&
        restaurant.location.coordinates
      ) {
        [lng, lat] = restaurant.location.coordinates;
      } else if (typeof restaurant.location === "string") {
        const match = restaurant.location.match(/POINT\(([^)]+)\)/);
        if (match) {
          [lng, lat] = match[1].split(" ").map(Number);
        }
      }
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error("Error opening maps:", error);
        Alert.alert("Error", "Unable to open maps application");
      }
    }
  }, []);

  const applyFilters = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setShowFilters(false);
  }, []);

  // Effects
  useEffect(() => {
    if (cuisineId) {
      fetchCuisineRestaurants();
    }
  }, [cuisineId, fetchCuisineRestaurants]);

  // Apply sponsorship sorting - sponsored restaurants appear first
  const sortedRestaurants = useMemo(() => {
    if (sponsorshipLoading || restaurants.length === 0) return restaurants;
    return sortWithSponsored(restaurants);
  }, [restaurants, sortWithSponsored, sponsorshipLoading]);

  // Filter Statistics
  const stats = useMemo(() => {
    // Filter restaurants that have ratings (average_rating exists and > 0, or total_reviews > 0)
    const restaurantsWithRatings = restaurants.filter(
      (r) =>
        (r.average_rating && r.average_rating > 0) ||
        (r.total_reviews && r.total_reviews > 0),
    );

    return {
      total: restaurants.length,
      avgRating:
        restaurantsWithRatings.length > 0
          ? restaurantsWithRatings.reduce(
              (sum, r) => sum + (r.average_rating || 0),
              0,
            ) / restaurantsWithRatings.length
          : 0,
      priceRange:
        restaurants.length > 0
          ? Math.round(
              restaurants.reduce((sum, r) => sum + (r.price_range || 0), 0) /
                restaurants.length,
            )
          : 0,
    };
  }, [restaurants]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <View>
            <H1 className="text-lg">{cuisineName || cuisineId}</H1>
            <Muted>
              {loading && !refreshing
                ? "Loading restaurants..."
                : `${stats.total} restaurants found`}
            </Muted>
          </View>
        </View>

        <Pressable
          onPress={() => setShowFilters(true)}
          className="w-10 h-10 items-center justify-center rounded-full bg-muted"
        >
          <SlidersHorizontal
            size={20}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
      </View>

      {/* Stats Bar */}
      {restaurants.length > 0 && (
        <View className="flex-row items-center justify-between px-4 py-3 bg-muted/30">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-medium">
                {stats.avgRating.toFixed(1)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-medium">
                {"$".repeat(stats.priceRange)} avg
              </Text>
            </View>
            {filters.openNow && (
              <View className="flex-row items-center gap-1">
                <Clock size={16} color="#10b981" />
                <Text className="text-sm text-green-600 font-medium">
                  Open Now
                </Text>
              </View>
            )}
          </View>

          <Text className="text-sm text-muted-foreground">
            Sorted by{" "}
            {SORT_OPTIONS.find((opt) => opt.value === filters.sortBy)?.label}
          </Text>
        </View>
      )}

      {/* Restaurant List */}
      <FlatList
        data={loading && !refreshing ? Array(4).fill(null) : sortedRestaurants}
        renderItem={({ item, index }) => {
          // Show skeleton when loading
          if (loading && !refreshing && !item) {
            return <RestaurantSearchCardSkeleton key={`skeleton-${index}`} />;
          }

          const restaurantIsSponsored = isSponsored(item.id);
          const sponsorshipId = getSponsorshipId(item.id);

          // Track impression when sponsored restaurant is rendered
          if (restaurantIsSponsored && sponsorshipId) {
            trackImpression(sponsorshipId);
          }

          return (
            <RestaurantSearchCard
              item={item}
              bookingFilters={{
                date: new Date(),
                time: "19:00",
                partySize: 2,
                availableOnly: filters.openNow,
              }}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onDirections={handleDirections}
              onPress={() => {
                // Track click when sponsored restaurant is pressed
                if (restaurantIsSponsored && sponsorshipId) {
                  trackClick(sponsorshipId);
                }
                handleRestaurantPress(item);
              }}
              isSponsored={restaurantIsSponsored}
            />
          );
        }}
        keyExtractor={(item, index) => item?.id || `skeleton-${index}`}
        contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
        ListEmptyComponent={
          !loading && sortedRestaurants.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Utensils size={48} color="#666" />
              <H3 className="mt-4 text-center">No restaurants found</H3>
              <Muted className="mt-2 text-center px-4">
                {`No ${cuisineName || cuisineId} restaurants found. Try adjusting your filters or check back later.`}
              </Muted>
            </View>
          ) : null
        }
      />

      {/* Bottom Sheet Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <FilterBottomSheet
          filters={filters}
          onApply={applyFilters}
          onClose={() => setShowFilters(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// Bottom Sheet Filter Component
function FilterBottomSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  onClose: () => void;
}) {
  const [tempFilters, setTempFilters] = useState(filters);

  return (
    <View className="flex-1 justify-end">
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      {/* Bottom Sheet Content */}
      <View
        style={{
          height: SCREEN_HEIGHT * 0.75,
          backgroundColor: "white",
        }}
        className="bg-background rounded-t-3xl"
      >
        <SafeAreaView className="flex-1">
          {/* Handle Bar */}
          <View className="items-center py-3">
            <View className="w-10 h-1 bg-muted rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Button variant="ghost" onPress={onClose}>
              <Text>Cancel</Text>
            </Button>
            <H3>Filters</H3>
            <Button onPress={() => onApply(tempFilters)} variant="default">
              <Text>Apply</Text>
            </Button>
          </View>

          <ScrollView className="flex-1 px-4 py-6">
            {/* Sort By */}
            <View className="mb-6">
              <H3 className="mb-3">Sort By</H3>
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    setTempFilters((prev) => ({
                      ...prev,
                      sortBy: option.value,
                    }))
                  }
                  className="flex-row items-center justify-between py-3"
                >
                  <Text>{option.label}</Text>
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      tempFilters.sortBy === option.value
                        ? "border-primary"
                        : "border-muted"
                    }`}
                  >
                    {tempFilters.sortBy === option.value && (
                      <View className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Price Range */}
            <View className="mb-6">
              <H3 className="mb-3">Price Range</H3>
              <View className="flex-row gap-2">
                {[1, 2, 3, 4].map((price) => (
                  <Pressable
                    key={price}
                    onPress={() => {
                      const isSelected = tempFilters.priceRange.includes(price);
                      setTempFilters((prev) => ({
                        ...prev,
                        priceRange: isSelected
                          ? prev.priceRange.filter((p) => p !== price)
                          : [...prev.priceRange, price],
                      }));
                    }}
                    className={`px-4 py-2 rounded-lg border ${
                      tempFilters.priceRange.includes(price)
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.priceRange.includes(price)
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }
                    >
                      {"$".repeat(price)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Rating Filter */}
            <View className="mb-6">
              <H3 className="mb-3">Minimum Rating</H3>
              <View className="flex-row gap-2">
                {[0, 3, 4, 4.5].map((rating) => (
                  <Pressable
                    key={rating}
                    onPress={() =>
                      setTempFilters((prev) => ({ ...prev, rating }))
                    }
                    className={`px-4 py-2 rounded-lg border ${
                      tempFilters.rating === rating
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.rating === rating
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }
                    >
                      {rating === 0 ? "Any" : `${rating}+ ⭐`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Open Now Toggle */}
            <View className="flex-row items-center justify-between">
              <H3>Open Now</H3>
              <Pressable
                onPress={() =>
                  setTempFilters((prev) => ({
                    ...prev,
                    openNow: !prev.openNow,
                  }))
                }
                className={`w-12 h-6 rounded-full p-1 ${
                  tempFilters.openNow ? "bg-primary" : "bg-muted"
                }`}
              >
                <View
                  className="w-4 h-4 rounded-full bg-white"
                  style={{
                    transform: [{ translateX: tempFilters.openNow ? 24 : 0 }],
                  }}
                />
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </View>
  );
}
