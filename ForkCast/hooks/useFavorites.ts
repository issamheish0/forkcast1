// hooks/useFavorites.ts — Supabase-backed (falls back to local store for test user)
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useRestaurantStore } from "@/stores";
import { MOCK_USER_ID } from "@/lib/mockData";


export function useFavorites(_userId?: string) {
  const { user } = useAuth();
  const { favorites: storeSet, addToFavorites, removeFromFavorites } = useRestaurantStore();
  const isMockUser = !user || user.id === MOCK_USER_ID;

  const [dbFavorites, setDbFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (isMockUser || !user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from("favorites")
      .select(`id, user_id, restaurant_id, created_at, restaurant:restaurants(id, name, main_image_url, address, cuisine_type, average_rating, price_range)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setDbFavorites(data as Favorite[]);
      // Sync into store so UI toggles work
      const store = useRestaurantStore.getState();
      data.forEach((f) => {
        if (!store.favorites.has(f.restaurant_id)) store.addToFavorites(f.restaurant_id);
      });
    }
    setIsLoading(false);
  }, [isMockUser, user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const toggleFavorite = useCallback(
    async (restaurantId: string) => {
      if (isMockUser) {
        if (storeSet.has(restaurantId)) removeFromFavorites(restaurantId);
        else addToFavorites(restaurantId);
        return;
      }

      const alreadyFav = storeSet.has(restaurantId);
      if (alreadyFav) {
        removeFromFavorites(restaurantId);
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user!.id)
          .eq("restaurant_id", restaurantId);
        setDbFavorites((prev) => prev.filter((f) => f.restaurant_id !== restaurantId));
      } else {
        addToFavorites(restaurantId);
        const { data } = await supabase
          .from("favorites")
          .insert({ user_id: user!.id, restaurant_id: restaurantId })
          .select()
          .single();
        if (data) setDbFavorites((prev) => [data as Favorite, ...prev]);
      }
    },
    [isMockUser, storeSet, user, addToFavorites, removeFromFavorites],
  );

  const isFavorite = useCallback(
    (restaurantId: string) => storeSet.has(restaurantId),
    [storeSet],
  );

  return {
    favorites: storeSet,
    favoritesList: isMockUser ? [] : dbFavorites,
    toggleFavorite,
    isFavorite,
    isLoading,
    refresh: loadFavorites,
  };
}


export type Favorite = {
  id: string;
  user_id: string;
  restaurant_id: string;
  created_at: string;
  restaurant?: any;
  [key: string]: any;
};
