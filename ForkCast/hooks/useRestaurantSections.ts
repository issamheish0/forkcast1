import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

type RestaurantSection =
  Database["public"]["Tables"]["restaurant_sections"]["Row"];

export function useRestaurantSections(
  restaurantId: string | undefined,
  _bookingDate?: Date,
  _bookingTime?: string,
) {
  const [sections, setSections] = useState<RestaurantSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    if (!restaurantId) {
      setSections([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (fetchError) throw fetchError;
      setSections(data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load sections");
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return {
    sections,
    loading,
    error,
    refresh: fetchSections,
  };
}