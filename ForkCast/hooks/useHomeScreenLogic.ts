// hooks/useHomeScreenLogic.ts — Supabase-backed
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { Region } from "react-native-maps";
import { supabase } from "@/config/supabase";
import {
  MOCK_FEATURED_RESTAURANTS,
  MOCK_NEW_RESTAURANTS,
  MOCK_TOP_RATED,
  MOCK_TRENDING,
  MOCK_RESTAURANTS,
} from "@/lib/mockData";

export type RecommendedSection = {
  cuisine: string;
  restaurants: any[];
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  key?: string;
};

const FIELDS = `
  id, name, cuisine_type, secondary_cuisines, address,
  latitude, longitude, main_image_url, price_range,
  average_rating, total_reviews, status, featured, tier,
  booking_policy, scratch_card_enabled, outdoor_seating,
  valet_parking, parking_available, shisha_available,
  created_at, updated_at
`;

function toGeoJson(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return { type: "Point", coordinates: [lng, lat] };
}
function mapRow(r: any) {
  return { ...r, location: toGeoJson(r.latitude, r.longitude) };
}

export function useHomeScreenLogic() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [allRestaurants, setAllRestaurants] = useState<any[]>(MOCK_RESTAURANTS);
  const [featuredRestaurants, setFeaturedRestaurants] = useState<any[]>(MOCK_FEATURED_RESTAURANTS);
  const [topRatedRestaurants, setTopRatedRestaurants] = useState<any[]>(MOCK_TOP_RATED);
  const [newRestaurants, setNewRestaurants] = useState<any[]>(MOCK_NEW_RESTAURANTS);
  const [trendingRestaurants, setTrendingRestaurants] = useState<any[]>(MOCK_TRENDING);

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select(FIELDS)
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("average_rating", { ascending: false });

      if (error || !data || data.length === 0) return; // keep mock

      const mapped = data.map(mapRow);
      setAllRestaurants(mapped);
      setFeaturedRestaurants(mapped.filter((r) => r.featured));
      setTopRatedRestaurants(
        [...mapped].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0)).slice(0, 5),
      );
      setNewRestaurants(mapped.slice(-4)); // last 4 by insertion order
      setTrendingRestaurants(mapped.slice(0, 6));
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleRestaurantPress = useCallback(
    (id: string) => router.push(`/(protected)/restaurant/${id}`),
    [router],
  );
  const handleFavoriteToggle = useCallback((_id: string) => {}, []);
  const handleSearchPress = useCallback(() => {
    router.push("/(protected)/(tabs)/search");
  }, [router]);
  const handleSearchWithParams = useCallback(
    (params?: Record<string, string>) => {
      router.push({ pathname: "/(protected)/(tabs)/search", params });
    },
    [router],
  );
  const handleCuisinePress = useCallback(
    (cuisineId: string) => router.push(`/(protected)/cuisine/${cuisineId}`),
    [router],
  );
  const handleLocationPress = useCallback(() => {
    router.push("/(protected)/location-selector");
  }, [router]);
  const handleProfilePress = useCallback(() => {
    router.push("/(protected)/profile");
  }, [router]);
  const fetchNearbyRestaurants = useCallback(async (_forceRefresh?: boolean) => {}, []);

  return {
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    trendingRestaurants,
    barsRestaurants: [],
    recentlyVisitedRestaurants: [],
    recommendedSections: [] as RecommendedSection[],
    nearbyRestaurants: allRestaurants.slice(0, 5),
    allRestaurants,
    nearbyPage: 0,
    hasMoreNearby: false,
    location: null,
    locationData: null,
    quickFilters: [],
    loading,
    refreshing: isRefreshing,
    isRefreshing,
    isLoadingNearby: false,
    isLoadingMoreNearby: false,
    isLoadingRecentlyVisited: false,
    handleRefresh,
    handleRestaurantPress,
    handleFavoriteToggle,
    handleSearchPress,
    handleSearchWithParams,
    handleCuisinePress,
    handleLocationPress,
    handleProfilePress,
    fetchNearbyRestaurants,
    navigateToSearch: handleSearchPress,
    loadMoreNearby: async () => {},
    navigateToQuickFilter: (_f: any) => {},
  };
}

