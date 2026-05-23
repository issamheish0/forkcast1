// hooks/useCuisineCategories.ts — Mock version
import { useState } from "react";
import { MOCK_CUISINE_CATEGORIES } from "@/lib/mockData";

export interface CuisineCategory {
  id: string;
  label: string;
  image: any;
  restaurantCount: number;
}

export function useCuisineCategories() {
  const refresh = async () => {};
  return {
    categories: MOCK_CUISINE_CATEGORIES as CuisineCategory[],
    loading: false,
    error: null as string | null,
    refresh,
    refreshCategories: refresh,
  };
}
