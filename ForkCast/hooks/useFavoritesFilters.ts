// Stub: useFavoritesFilters — not implemented in ForkCastApp
import { Star, ArrowUp, ArrowDown, Clock, X, Utensils, MapPin, DollarSign } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

export type SortBy = "default" | "name_asc" | "name_desc" | "rating" | "recent";
export type GroupBy = "none" | "cuisine" | "city" | "price";

export const SORT_OPTIONS: Array<{ label: string; value: SortBy; icon: LucideIcon }> = [
  { label: "Default", value: "default", icon: Star },
  { label: "Name A-Z", value: "name_asc", icon: ArrowUp },
  { label: "Name Z-A", value: "name_desc", icon: ArrowDown },
  { label: "Rating", value: "rating", icon: Star },
  { label: "Recent", value: "recent", icon: Clock },
];

export const GROUP_OPTIONS: Array<{ label: string; value: GroupBy; icon: LucideIcon }> = [
  { label: "None", value: "none", icon: X },
  { label: "Cuisine", value: "cuisine", icon: Utensils },
  { label: "City", value: "city", icon: MapPin },
  { label: "Price", value: "price", icon: DollarSign },
];

export type FavoritePair = [any, any | undefined];

export function useFavoritesFilters() {
  return {
    filters: {} as Record<string, any>,
    setFilter: (_key: string, _value: any) => {},
    clearFilters: () => {},
    filteredFavorites: [] as any[],
    sortBy: "default" as SortBy,
    setSortBy: (_value: SortBy) => {},
    groupBy: "none" as GroupBy,
    setGroupBy: (_value: GroupBy) => {},
  };
}
