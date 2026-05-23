// hooks/useMenu.ts

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/config/supabase";
import { MenuCategory, MenuItem, MenuFilters } from "@/types/menu";

// OPTIMIZATION: Cache for menu data (10 minutes) - menus don't change frequently
const MENU_CACHE_TTL = 10 * 60 * 1000;
const globalMenuCache = new Map<
  string,
  {
    categories: MenuCategory[];
    restaurant: { menu_urls: any[] | null; name: string } | null;
    timestamp: number;
  }
>();

interface UseMenuParams {
  restaurantId: string;
}

interface RestaurantMenuMeta {
  menu_urls: Array<{ url: string; title: string | null }> | null;
  name: string;
}

interface UseMenuReturn {
  categories: MenuCategory[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  filters: MenuFilters;
  filteredItems: MenuItem[];
  setFilters: (filters: Partial<MenuFilters>) => void;
  refresh: () => Promise<void>;
  featuredItems: MenuItem[];
  restaurant: RestaurantMenuMeta | null;
}

export function useMenu({ restaurantId }: UseMenuParams): UseMenuReturn {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantMenuMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFiltersState] = useState<MenuFilters>({
    dietary_tags: [],
    maxPrice: null,
    searchQuery: "",
    showUnavailable: false,
  });
  const hasFetched = useRef(false);

  const fetchMenu = useCallback(async () => {
    // Guard against missing restaurantId
    if (!restaurantId) {
      setLoading(false);
      setError("Restaurant ID is required");
      return;
    }

    try {
      setError(null);

      // OPTIMIZATION: Check cache first
      if (!hasFetched.current) {
        const cached = globalMenuCache.get(restaurantId);
        const now = Date.now();

        if (cached && now - cached.timestamp < MENU_CACHE_TTL) {
          setCategories(cached.categories);
          setRestaurant(cached.restaurant);
          setLoading(false);
          hasFetched.current = true;
          return;
        }
      }

      // Fetch restaurant data for menu_urls
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("menu_urls, name")
        .eq("id", restaurantId)
        .single();

      if (restaurantError) throw restaurantError;
      if (restaurantData) {
        setRestaurant(restaurantData);
      }

      // OPTIMIZED: Fetch categories with selective fields
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("menu_categories")
        .select(
          "id, name, description, display_order, is_active, restaurant_id",
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (categoriesError) throw categoriesError;

      // OPTIMIZED: Fetch menu items with selective fields
      const { data: itemsData, error: itemsError } = await supabase
        .from("menu_items")
        .select(
          "id, name, description, price, category_id, is_available, dietary_tags, allergens, display_order, restaurant_id, image_url",
        )
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true });

      if (itemsError) throw itemsError;

      // Normalize menu items to ensure arrays are never null
      const normalizedItems = (itemsData || []).map((item) => ({
        ...item,
        dietary_tags: item.dietary_tags || [],
        allergens: item.allergens || [],
      }));

      // Group items by category
      const categoriesWithItems = (categoriesData || []).map((category) => ({
        ...category,
        items: normalizedItems.filter(
          (item) =>
            item.category_id === category.id &&
            (filters.showUnavailable || item.is_available),
        ),
      }));

      // OPTIMIZATION: Cache the results
      globalMenuCache.set(restaurantId, {
        categories: categoriesWithItems as any,
        restaurant: restaurantData,
        timestamp: Date.now(),
      });

      setCategories(categoriesWithItems as any);
      hasFetched.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, filters.showUnavailable]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMenu();
  }, [fetchMenu]);

  const setFilters = useCallback((newFilters: Partial<MenuFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Calculate filtered items
  const filteredItems = useMemo(() => {
    const allItems = categories.flatMap((cat) => cat.items || []);

    return allItems.filter((item) => {
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (
          !item.name.toLowerCase().includes(query) &&
          !item.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Price filter
      if (filters.maxPrice && item.price > filters.maxPrice) {
        return false;
      }

      // Dietary tags filter
      if (filters.dietary_tags.length > 0) {
        const itemDietaryTags = item.dietary_tags || [];
        const hasAllTags = filters.dietary_tags.every((tag) =>
          itemDietaryTags.includes(tag),
        );
        if (!hasAllTags) return false;
      }

      // Availability filter
      if (!filters.showUnavailable && !item.is_available) {
        return false;
      }

      return true;
    });
  }, [categories, filters]);

  // Get featured items
  const featuredItems = useMemo(() => {
    return categories
      .flatMap((cat) => cat.items || [])
      .filter((item) => item.is_featured && item.is_available)
      .slice(0, 6);
  }, [categories]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  return {
    categories,
    loading,
    error,
    refreshing,
    filters,
    filteredItems,
    setFilters,
    refresh,
    featuredItems,
    restaurant,
  };
}
