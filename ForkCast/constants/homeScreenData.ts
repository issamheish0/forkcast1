import { Zap, Star, Award, MapPin, TrendingUp } from "lucide-react-native";

interface QuickFilter {
  id: string;
  label: string;
  icon: any;
  color: string;
  params: Record<string, string>;
}

interface CuisineCategory {
  id: string;
  label: string;
  image: string;
  popular?: boolean;
}

export const QUICK_FILTERS: QuickFilter[] = [
  {
    id: "instant_book",
    label: "Instant Book",
    icon: Zap,
    color: "#10b981",
    params: { bookingPolicy: "instant" },
  },
  {
    id: "top_rated",
    label: "Top Rated",
    icon: Star,
    color: "#f59e0b",
    params: { minRating: "4.5" },
  },
  {
    id: "fine_dining",
    label: "Fine Dining",
    icon: Award,
    color: "#8b5cf6",
    params: { priceRange: "4" },
  },
  {
    id: "outdoor",
    label: "Outdoor",
    icon: MapPin,
    color: "#06b6d4",
    params: { feature: "outdoor_seating" },
  },
  {
    id: "trending",
    label: "Trending",
    icon: TrendingUp,
    color: "#ef4444",
    params: { trending: "true" },
  },
];

/**
 * Image mapping for cuisine categories
 * Used by useCuisineCategories hook to map database results to local images
 */
export const CUISINE_IMAGE_MAP: Record<string, any> = {
  american: require("@/assets/cuisine-categories/american.png"),
  bars: require("@/assets/cuisine-categories/bars.png"),
  cafe: require("@/assets/cuisine-categories/cafe.png"),
  chinese: require("@/assets/cuisine-categories/chinese.png"),
  french: require("@/assets/cuisine-categories/french.png"),
  greek: require("@/assets/cuisine-categories/greek.png"),
  indian: require("@/assets/cuisine-categories/indian.png"),
  international: require("@/assets/cuisine-categories/international.png"),
  italian: require("@/assets/cuisine-categories/italian.png"),
  japanese: require("@/assets/cuisine-categories/japanese.png"),
  lebanese: require("@/assets/cuisine-categories/lebanese.png"),
  mediterranean: require("@/assets/cuisine-categories/mediterranean.png"),
  mediterrasian: require("@/assets/cuisine-categories/mediterrasian.png"),
  mexican: require("@/assets/cuisine-categories/mexican.png"),
  seafood: require("@/assets/cuisine-categories/seafood.png"),
  spanish: require("@/assets/cuisine-categories/spanish.png"),
  thai: require("@/assets/cuisine-categories/thai.png"),
  asian: require("@/assets/cuisine-categories/chinese.png"),
};

/**
 * @deprecated Use useCuisineCategories hook instead for dynamic categories from database
 * Kept for backward compatibility only
 */
export const CUISINE_CATEGORIES: CuisineCategory[] = [
  {
    id: "american",
    label: "American",
    image: require("@/assets/cuisine-categories/american.png"),
  },
  {
    id: "cafe",
    label: "Cafe",
    image: require("@/assets/cuisine-categories/cafe.png"),
  },
  {
    id: "chinese",
    label: "Chinese",
    image: require("@/assets/cuisine-categories/chinese.png"),
  },
  {
    id: "french",
    label: "French",
    image: require("@/assets/cuisine-categories/french.png"),
  },
  {
    id: "greek",
    label: "Greek",
    image: require("@/assets/cuisine-categories/greek.png"),
  },
  {
    id: "indian",
    label: "Indian",
    image: require("@/assets/cuisine-categories/indian.png"),
  },
  {
    id: "international",
    label: "International",
    image: require("@/assets/cuisine-categories/international.png"),
  },
  {
    id: "italian",
    label: "Italian",
    image: require("@/assets/cuisine-categories/italian.png"),
    popular: true,
  },
  {
    id: "japanese",
    label: "Japanese",
    image: require("@/assets/cuisine-categories/japanese.png"),
    popular: true,
  },
  {
    id: "lebanese",
    label: "Lebanese",
    image: require("@/assets/cuisine-categories/lebanese.png"),
    popular: true,
  },
  {
    id: "mediterranean",
    label: "Mediterranean",
    image: require("@/assets/cuisine-categories/mediterranean.png"),
    popular: true,
  },
  {
    id: "mediterrasian",
    label: "Mediterrasian",
    image: require("@/assets/cuisine-categories/mediterrasian.png"),
  },
  {
    id: "mexican",
    label: "Mexican",
    image: require("@/assets/cuisine-categories/mexican.png"),
  },
  {
    id: "seafood",
    label: "Seafood",
    image: require("@/assets/cuisine-categories/seafood.png"),
  },
  {
    id: "spanish",
    label: "Spanish",
    image: require("@/assets/cuisine-categories/spanish.png"),
  },
  {
    id: "thai",
    label: "Thai",
    image: require("@/assets/cuisine-categories/thai.png"),
  },
];
