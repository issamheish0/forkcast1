// hooks/useRestaurant.ts — Supabase-backed
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Linking, Share } from "react-native";
import { supabase } from "@/config/supabase";
import { MOCK_RESTAURANT_MAP } from "@/lib/mockData";
import { useRestaurantStore } from "@/stores/index";

const RESTAURANT_FIELDS = `
  id, name, cuisine_type, secondary_cuisines, address,
  latitude, longitude, main_image_url, price_range,
  average_rating, total_reviews, status, featured, tier,
  booking_policy, scratch_card_enabled, outdoor_seating,
  valet_parking, parking_available, shisha_available,
  max_party_size, min_party_size, review_summary,
  created_at, updated_at
`;

function toGeoJsonLocation(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return { type: "Point", coordinates: [lng, lat] };
}

export function useRestaurant(restaurantId: string) {
  const router = useRouter();
  const { favorites, addToFavorites, removeFromFavorites } = useRestaurantStore();
  const isFav = favorites.has(restaurantId);

  const [restaurant, setRestaurant] = useState<any>(
    MOCK_RESTAURANT_MAP.get(restaurantId) ?? null,
  );
  const [loading, setLoading] = useState(!MOCK_RESTAURANT_MAP.has(restaurantId));

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    supabase
      .from("restaurants")
      .select(RESTAURANT_FIELDS)
      .eq("id", restaurantId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setRestaurant({
            ...data,
            location: toGeoJsonLocation(data.latitude, data.longitude),
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const toggleFavorite = useCallback(async () => {
    if (isFav) removeFromFavorites(restaurantId);
    else addToFavorites(restaurantId);
  }, [isFav, restaurantId, addToFavorites, removeFromFavorites]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `Check out ${restaurant?.name} on ForkCast!` });
    } catch {}
  }, [restaurant]);

  const handleBooking = useCallback(
    (_date: Date, _time: string, _partySize: number) => {
      router.push(`/(protected)/booking/create?restaurantId=${restaurantId}`);
    },
    [router, restaurantId],
  );

  const navigateToCreateReview = useCallback(() => {
    router.push(`/(protected)/review/create?restaurantId=${restaurantId}`);
  }, [router, restaurantId]);

  const handleCall = useCallback((r: any) => {
    if (r?.phone_number) Linking.openURL(`tel:${r.phone_number}`);
  }, []);

  const handleWhatsApp = useCallback((r: any) => {
    if (r?.whatsapp_number) Linking.openURL(`https://wa.me/${r.whatsapp_number}`);
  }, []);

  const extractLocationCoordinates = useCallback((location: any) => {
    if (!location?.coordinates) return null;
    const [lng, lat] = location.coordinates;
    return { latitude: lat, longitude: lng };
  }, []);

  const isRestaurantOpen = useCallback((_r: any) => true, []);
  const getDistanceText = useCallback((d: number) => `${d.toFixed(1)} km`, []);

  return {
    restaurant,
    reviews: [],
    isFavorite: isFav,
    loading,
    availableSlots: [],
    loadingSlots: false,
    toggleFavorite,
    handleShare,
    handleBooking,
    navigateToCreateReview,
    refresh: async () => {
      setLoading(true);
      const { data } = await supabase
        .from("restaurants")
        .select(RESTAURANT_FIELDS)
        .eq("id", restaurantId)
        .single();
      if (data) setRestaurant({ ...data, location: toGeoJsonLocation(data.latitude, data.longitude) });
      setLoading(false);
    },
    extractLocationCoordinates,
    isRestaurantOpen,
    getDistanceText,
    handleCall,
    handleWhatsApp,
  };
}

