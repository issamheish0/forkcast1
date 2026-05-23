// lib/constants/cuisines.ts
// Centralized cuisine types and dietary options constants

export const CUISINE_TYPES = [
  "Lebanese",
  "Mediterranean",
  "Mediterrasian",
  "Italian",
  "French",
  "Japanese",
  "Chinese",
  "Indian",
  "Mexican",
  "Bars",
  "American",
  "Seafood",
  "Steakhouse",
  "Fusion",
  "Vegetarian",
  "Cafe",
  "Asian",
  "International",
  "Thai",   
  "Korean",
  "Greek",
  "Spanish",
  "Middle Eastern",
  "Turkish",
  "Brazilian",
  "Vietnamese",
  "African",
  "Caribbean",
  "British",
  "German",
  "Persian"
] as const

export type CuisineType = typeof CUISINE_TYPES[number]

export const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "halal",
  "dairy-free",
  "nut-free",
  "pescatarian",
  "organic",
  "low-carb",
  "keto-friendly"
] as const

export type DietaryOption = typeof DIETARY_OPTIONS[number]

export const AMBIANCE_TAGS = [
  "casual",
  "fine dining",
  "family-friendly",
  "romantic",
  "business",
  "trendy",
  "cozy",
  "lively",
  "outdoor",
  "rooftop",
  "waterfront",
  "historic",
  "modern",
  "traditional"
] as const

export type AmbianceTag = typeof AMBIANCE_TAGS[number]
