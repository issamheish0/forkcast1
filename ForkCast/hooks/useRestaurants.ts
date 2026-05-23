// hooks/useRestaurants.ts — Supabase-backed
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import {
  MOCK_RESTAURANTS,
  MOCK_FEATURED_RESTAURANTS,
  MOCK_OFFERS,
} from "@/lib/mockData";

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

function mapRow(r: any) {
  return {
    ...r,
    location: toGeoJsonLocation(r.latitude, r.longitude),
  };
}

export function useRestaurants(_options: Record<string, any> = {}) {
  const [allRestaurants, setAllRestaurants] = useState<any[]>(MOCK_RESTAURANTS);
  const [featuredRestaurants, setFeaturedRestaurants] = useState<any[]>(MOCK_FEATURED_RESTAURANTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("restaurants")
        .select(RESTAURANT_FIELDS)
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("average_rating", { ascending: false });

      if (err) throw err;
      if (data && data.length > 0) {
        const mapped = data.map(mapRow);
        setAllRestaurants(mapped);
        setFeaturedRestaurants(mapped.filter((r) => r.featured));
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load restaurants");
      // Keep mock data as fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    featuredRestaurants,
    recentlyBooked: allRestaurants.slice(0, 3),
    specialOffers: MOCK_OFFERS, // offers fetched separately via useOffers
    allRestaurants,
    loading,
    error,
    refresh: fetch,
  };
}

