// types/menu.ts

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: MenuItem[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  dietary_tags: string[];
  allergens: string[];
  calories: number | null;
  preparation_time: number | null;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuFilters {
  dietary_tags: string[];
  maxPrice: number | null;
  searchQuery: string;
  showUnavailable: boolean;
}

export const DIETARY_TAGS = {
  VEGETARIAN: "vegetarian",
  VEGAN: "vegan",
  GLUTEN_FREE: "gluten-free",
  DAIRY_FREE: "dairy-free",
  NUT_FREE: "nut-free",
  HALAL: "halal",

  ORGANIC: "organic",
  SPICY: "spicy",
  LOW_CARB: "low-carb",
  KETO: "keto",
} as const;

export const ALLERGENS = {
  MILK: "milk",
  EGGS: "eggs",
  FISH: "fish",
  SHELLFISH: "shellfish",
  TREE_NUTS: "tree-nuts",
  PEANUTS: "peanuts",
  WHEAT: "wheat",
  SOYBEANS: "soybeans",
  SESAME: "sesame",
} as const;

export type DietaryTag = (typeof DIETARY_TAGS)[keyof typeof DIETARY_TAGS];
export type Allergen = (typeof ALLERGENS)[keyof typeof ALLERGENS];
