// hooks/useRestaurantSearch.ts — Supabase-backed with client-side filtering
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/config/supabase";
import { MOCK_RESTAURANTS } from "@/lib/mockData";

type Restaurant = (typeof MOCK_RESTAURANTS)[number] & { [key: string]: any };

export interface SearchFilters {
  cuisines: string[];
  features: string[];
  bookingPolicy: "all" | "instant" | "request";
  priceRange: [number, number];
  sortBy: "rating" | "distance" | "name";
  openNow?: boolean;
  date?: Date;
  time?: string;
  partySize?: number;
}

interface UseRestaurantSearchOptions {
  query: string;
  filters: SearchFilters;
  pageSize?: number;
}

const RESTAURANT_FIELDS = `
  id, name, cuisine_type, secondary_cuisines, address,
  latitude, longitude, main_image_url, price_range,
  average_rating, total_reviews, status, featured, tier,
  booking_policy, scratch_card_enabled, outdoor_seating,
  valet_parking, parking_available, shisha_available,
  created_at, updated_at
`;

function toGeoJsonLocation(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return { type: "Point", coordinates: [lng, lat] };
}

// Shared cache so all instances share the same fetch
let cachedData: Restaurant[] | null = null;
let fetchPromise: Promise<Restaurant[]> | null = null;

async function fetchAllRestaurants(): Promise<Restaurant[]> {
  if (cachedData) return cachedData;
  if (fetchPromise) return fetchPromise;

  fetchPromise = supabase
    .from("restaurants")
    .select(RESTAURANT_FIELDS)
    .eq("status", "active")
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        cachedData = MOCK_RESTAURANTS as Restaurant[];
      } else {
        cachedData = data.map((r) => ({
          ...r,
          location: toGeoJsonLocation(r.latitude, r.longitude),
        })) as Restaurant[];
      }
      fetchPromise = null;
      return cachedData;
    })
    .catch(() => {
      fetchPromise = null;
      cachedData = MOCK_RESTAURANTS as Restaurant[];
      return cachedData;
    });

  return fetchPromise;
}

function applyFilters(
  all: Restaurant[],
  query: string,
  filters: SearchFilters,
  pageSize: number,
): Restaurant[] {
  let results = [...all];

  const q = query.trim().toLowerCase();
  if (q) {
    results = results.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine_type.toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q) ||
        (r.secondary_cuisines ?? []).some((c: string) =>
          c.toLowerCase().includes(q),
        ),
    );
  }

  if (filters.cuisines.length > 0) {
    results = results.filter(
      (r) =>
        filters.cuisines.includes(r.cuisine_type) ||
        (r.secondary_cuisines ?? []).some((c: string) =>
          filters.cuisines.includes(c),
        ),
    );
  }

  results = results.filter(
    (r) =>
      r.price_range >= filters.priceRange[0] &&
      r.price_range <= filters.priceRange[1],
  );

  if (filters.bookingPolicy !== "all") {
    results = results.filter((r) => r.booking_policy === filters.bookingPolicy);
  }

  if (filters.features.includes("outdoor_seating")) {
    results = results.filter((r) => r.outdoor_seating);
  }
  if (filters.features.includes("valet_parking")) {
    results = results.filter((r) => r.valet_parking);
  }
  if (filters.features.includes("shisha")) {
    results = results.filter((r) => r.shisha_available);
  }

  switch (filters.sortBy) {
    case "rating":
      results.sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
      break;
    case "name":
      results.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      results.sort(
        (a, b) =>
          (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
          (b.average_rating ?? 0) - (a.average_rating ?? 0),
      );
  }

  return results.slice(0, pageSize);
}

export function useRestaurantSearch({
  query,
  filters,
  pageSize = 20,
}: UseRestaurantSearchOptions) {
  const [allData, setAllData] = useState<Restaurant[]>(
    cachedData ?? (MOCK_RESTAURANTS as Restaurant[]),
  );
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(!cachedData);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all restaurants once
  useEffect(() => {
    if (cachedData) {
      setAllData(cachedData);
      return;
    }
    setLoading(true);
    fetchAllRestaurants().then((data) => {
      setAllData(data);
      setLoading(false);
    });
  }, []);

  // Re-filter whenever query / filters / data change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setRestaurants(applyFilters(allData, query, filters, pageSize));
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [allData, query, filters, pageSize]);

  const refresh = useCallback(async () => {
    cachedData = null; // invalidate cache
    setLoading(true);
    const data = await fetchAllRestaurants();
    setAllData(data);
    setLoading(false);
  }, []);

  return {
    restaurants,
    loading,
    hasMore: false,
    loadMore: () => {},
    refresh,
  };
}

