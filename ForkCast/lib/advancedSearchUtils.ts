import Fuse, { type IFuseOptions } from "fuse.js";
import type { Restaurant, UserLocation } from "@/types/search";

// Common cuisine types with variations and misspellings - based on your actual cuisine categories
const CUISINE_MAPPING: Record<string, string[]> = {
  American: [
    "american",
    "burger",
    "burgers",
    "steakhouse",
    "steak",
    "bbq",
    "barbecue",
    "usa",
    "us",
  ],
  Cafe: [
    "cafe",
    "coffee",
    "bistro",
    "breakfast",
    "brunch",
    "bakery",
    "pastry",
    "dessert",
  ],
  Chinese: [
    "chinese",
    "chineese",
    "chineze",
    "asian",
    "noodles",
    "dim sum",
    "wok",
    "canton",
    "cantonese",
  ],
  French: [
    "french",
    "france",
    "bistro",
    "brasserie",
    "croissant",
    "crepe",
    "patisserie",
  ],
  Greek: [
    "greek",
    "greece",
    "gyro",
    "souvlaki",
    "feta",
    "olive",
    "mediterranean",
    "moussaka",
  ],
  Indian: [
    "indian",
    "india",
    "curry",
    "tandoor",
    "biryani",
    "naan",
    "masala",
    "spicy",
  ],
  International: [
    "international",
    "fusion",
    "global",
    "world",
    "mixed",
    "varied",
    "diverse",
  ],
  Italian: [
    "italian",
    "italain",
    "itallian",
    "italy",
    "pasta",
    "pizza",
    "risotto",
    "gelato",
  ],
  Japanese: [
    "japanese",
    "japan",
    "sushi",
    "ramen",
    "tempura",
    "teriyaki",
    "sake",
    "asian",
  ],
  Lebanese: [
    "lebanese",
    "lebanse",
    "lebanees",
    "lebanise",
    "lebanon",
    "arab",
    "middle eastern",
    "levantine",
    "hummus",
    "shawarma",
    "kebab",
  ],
  Mediterranean: [
    "mediterranean",
    "med",
    "olive",
    "greek",
    "healthy",
    "fresh",
    "herbs",
  ],
  Mediterrasian: [
    "mediterrasian",
    "mediterassian",
    "mediterranean asian",
    "med asian",
    "fusion mediterranean",
    "fusion asian",
  ],
  Mexican: [
    "mexican",
    "mexico",
    "tex-mex",
    "texmex",
    "tacos",
    "burritos",
    "quesadilla",
    "salsa",
  ],
  Seafood: [
    "seafood",
    "fish",
    "shrimp",
    "crab",
    "lobster",
    "oyster",
    "salmon",
    "tuna",
    "ocean",
  ],
  Spanish: [
    "spanish",
    "spain",
    "tapas",
    "paella",
    "iberian",
    "flamenco",
    "sangria",
  ],
  Thai: [
    "thai",
    "thailand",
    "pad thai",
    "curry",
    "spicy",
    "coconut",
    "asian",
    "tom yum",
  ],
};

// Normalize cuisine names for better matching
const NORMALIZED_CUISINES = Object.keys(CUISINE_MAPPING).reduce(
  (acc, key) => {
    CUISINE_MAPPING[key].forEach((variation) => {
      acc[variation.toLowerCase()] = key;
    });
    return acc;
  },
  {} as Record<string, string>,
);

// Advanced search configuration for restaurants
const RESTAURANT_SEARCH_CONFIG: IFuseOptions<Restaurant> = {
  keys: [
    { name: "name", weight: 0.5 }, // Increased weight for name
    { name: "cuisine_type", weight: 0.2 },
    { name: "tags", weight: 0.15 },
    { name: "description", weight: 0.1 },
    { name: "address", weight: 0.05 },
  ],
  threshold: 0.2, // Strict threshold — avoids loose character-overlap matches
  distance: 30, // Tighter distance — match must be near expected position
  location: 0, // Start matching from beginning
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: false,
  findAllMatches: true,
  useExtendedSearch: true,
};

// Cuisine search configuration for better matching
const CUISINE_SEARCH_CONFIG: IFuseOptions<{
  name: string;
  variations: string[];
}> = {
  keys: [
    { name: "name", weight: 0.6 },
    { name: "variations", weight: 0.4 },
  ],
  threshold: 0.3,
  distance: 50,
  minMatchCharLength: 3,
  includeScore: true,
  ignoreLocation: false,
  findAllMatches: true,
};

export interface SearchSuggestion {
  type: "restaurant" | "cuisine" | "tag" | "location";
  value: string;
  label: string;
  score?: number;
  matches?: any[];
}

export interface AdvancedSearchResult {
  restaurants: Restaurant[];
  suggestions: SearchSuggestion[];
  totalResults: number;
  searchTime: number;
  hasMore: boolean;
}

// Stop words to ignore in search queries
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "at",
  "in",
  "on",
  "restaurant",
  "cafe",
  "bar",
  "grill",
]);

// Search tier definitions for scoring
enum SearchTier {
  EXACT_MATCH = 0.05, // Exact name match
  PREFIX_MATCH = 0.15, // Name starts with query
  ALL_WORDS_MATCH = 0.25, // All query words in name
  FUZZY_MATCH_BASE = 0.35, // Base for fuzzy matches
}

export class AdvancedSearchEngine {
  private restaurantIndex: Fuse<Restaurant> | null = null;
  private cuisineIndex: Fuse<{ name: string; variations: string[] }>;
  private lastIndexUpdate = 0;
  private readonly INDEX_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize cuisine index
    const cuisineData = Object.entries(CUISINE_MAPPING).map(
      ([name, variations]) => ({
        name,
        variations,
      }),
    );
    this.cuisineIndex = new Fuse(cuisineData, CUISINE_SEARCH_CONFIG);
  }

  /**
   * Initialize or update the restaurant search index
   */
  updateRestaurantIndex(restaurants: Restaurant[]): void {
    this.restaurantIndex = new Fuse(restaurants, RESTAURANT_SEARCH_CONFIG);
    this.lastIndexUpdate = Date.now();
  }

  /**
   * Check if the index needs refreshing
   */
  private shouldRefreshIndex(): boolean {
    return Date.now() - this.lastIndexUpdate > this.INDEX_REFRESH_INTERVAL;
  }

  /**
   * Normalize and expand search query for better matching
   * Only expands short, generic queries - not specific restaurant names
   */
  private preprocessQuery(query: string): string[] {
    const normalizedQuery = query.toLowerCase().trim();
    const queries = [normalizedQuery];

    // Don't expand if query looks like a specific restaurant name
    if (this.isLikelyRestaurantName(query)) {
      return queries;
    }

    // Only expand short queries (1-2 words) to cuisine variations
    const wordCount = normalizedQuery.split(/\s+/).length;
    if (wordCount <= 2) {
      // Check for cuisine matches and add normalized cuisine names
      Object.entries(NORMALIZED_CUISINES).forEach(([variation, cuisine]) => {
        if (normalizedQuery.includes(variation)) {
          queries.push(cuisine.toLowerCase());
        }
      });
    }

    return [...new Set(queries)]; // Remove duplicates
  }

  /**
   * Detect if query is likely a specific restaurant name vs generic search
   */
  private isLikelyRestaurantName(query: string): boolean {
    const words = query.trim().split(/\s+/);
    // 3+ words likely a restaurant name
    if (words.length >= 3) return true;
    // Starts with capital letter (proper noun)
    if (/^[A-Z]/.test(query)) return true;
    // Contains numbers (often in restaurant names)
    if (/\d/.test(query)) return true;
    return false;
  }

  /**
   * Tokenize query by removing stop words
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => !STOP_WORDS.has(word) && word.length > 1);
  }

  /**
   * Check for exact name match
   */
  private exactMatch(restaurant: Restaurant, query: string): number | null {
    if (restaurant.name.toLowerCase() === query.toLowerCase()) {
      return SearchTier.EXACT_MATCH;
    }
    return null;
  }

  /**
   * Check if restaurant name starts with query
   */
  private prefixMatch(restaurant: Restaurant, query: string): number | null {
    const nameTokens = restaurant.name.toLowerCase().split(/\s+/);
    const queryTokens = query.toLowerCase().split(/\s+/);

    // Check if name starts with query
    if (restaurant.name.toLowerCase().startsWith(query.toLowerCase())) {
      return SearchTier.PREFIX_MATCH;
    }

    // Check if any significant word in name starts with query
    const significantMatch = nameTokens.some(
      (nameToken) =>
        !STOP_WORDS.has(nameToken) &&
        nameToken.length > 2 &&
        nameToken.startsWith(query.toLowerCase()),
    );

    if (significantMatch && queryTokens.length === 1) {
      return SearchTier.PREFIX_MATCH + 0.05;
    }

    return null;
  }

  /**
   * Check if all query words exist in restaurant name
   */
  private allWordsMatch(restaurant: Restaurant, query: string): number | null {
    const queryTokens = this.tokenizeQuery(query);
    if (queryTokens.length === 0) return null;

    const nameTokens = this.tokenizeQuery(restaurant.name);
    const cuisineTokens = this.tokenizeQuery(restaurant.cuisine_type);
    const allTokens = [...nameTokens, ...cuisineTokens];

    // Check if all query tokens exist in name/cuisine
    const allPresent = queryTokens.every((queryToken) =>
      allTokens.some(
        (token) => token.includes(queryToken) || queryToken.includes(token),
      ),
    );

    if (allPresent) {
      // Better score if more tokens match
      const matchRatio = queryTokens.length / Math.max(nameTokens.length, 1);
      return SearchTier.ALL_WORDS_MATCH + (1 - matchRatio) * 0.05;
    }

    return null;
  }

  /**
   * Generate search suggestions based on partial input
   * Improved to prioritize exact matches and avoid over-suggesting
   */
  generateSuggestions(
    query: string,
    restaurants: Restaurant[],
  ): SearchSuggestion[] {
    if (query.length < 2) return [];

    const suggestions: SearchSuggestion[] = [];
    const normalizedQuery = query.toLowerCase();

    // Restaurant name suggestions - prioritize exact and prefix matches
    if (this.restaurantIndex) {
      const restaurantResults = this.restaurantIndex.search(query);
      restaurantResults
        .filter((result) => result.score && result.score < 0.4) // Tighter threshold
        .slice(0, 3)
        .forEach((result) => {
          suggestions.push({
            type: "restaurant",
            value: result.item.name,
            label: `${result.item.name} • ${result.item.cuisine_type}`,
            score: result.score,
          });
        });
    }

    // Only suggest cuisines for short, generic queries
    if (query.split(/\s+/).length <= 2 && !this.isLikelyRestaurantName(query)) {
      const cuisineResults = this.cuisineIndex.search(query);
      cuisineResults
        .filter((result) => result.score && result.score < 0.3) // Stricter for cuisines
        .slice(0, 2) // Fewer cuisine suggestions
        .forEach((result) => {
          suggestions.push({
            type: "cuisine",
            value: result.item.name,
            label: `${result.item.name} cuisine`,
            score: result.score,
          });
        });
    }

    // Tag-based suggestions - only for very relevant matches
    const uniqueTags = [
      ...new Set(restaurants.flatMap((r) => r.tags || [])),
    ].filter((tag) => tag.toLowerCase().includes(normalizedQuery));

    uniqueTags.slice(0, 2).forEach((tag) => {
      suggestions.push({
        type: "tag",
        value: tag,
        label: `Places with ${tag}`,
        score: 0,
      });
    });

    // Sort by relevance score and remove duplicates
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map((s) => [s.value, s])).values(),
    );

    return uniqueSuggestions
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 6); // Reduced from 8 to 6 for less clutter
  }

  /**
   * Perform advanced fuzzy search on restaurants with tiered matching
   */
  search(
    query: string,
    restaurants: Restaurant[],
    userLocation?: UserLocation | null,
    limit: number = 50,
  ): AdvancedSearchResult {
    const startTime = Date.now();

    // Return all restaurants if no query
    if (!query.trim()) {
      return {
        restaurants: restaurants.slice(0, limit),
        suggestions: [],
        totalResults: restaurants.length,
        searchTime: Date.now() - startTime,
        hasMore: restaurants.length > limit,
      };
    }

    // Update index if needed
    if (!this.restaurantIndex || this.shouldRefreshIndex()) {
      this.updateRestaurantIndex(restaurants);
    }

    if (!this.restaurantIndex) {
      return {
        restaurants: [],
        suggestions: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        hasMore: false,
      };
    }

    const normalizedQuery = query.toLowerCase().trim();

    // Tier-based search collection
    const tier1Results: (Restaurant & { searchScore: number })[] = [];
    const tier2Results: (Restaurant & { searchScore: number })[] = [];
    const tier3Results: (Restaurant & { searchScore: number })[] = [];
    const tier4Map = new Map<string, Restaurant & { searchScore: number }>();

    // Process deterministic tiers (1-3) for all restaurants
    restaurants.forEach((restaurant) => {
      // Tier 1: Exact matches
      const exactScore = this.exactMatch(restaurant, normalizedQuery);
      if (exactScore !== null) {
        tier1Results.push({ ...restaurant, searchScore: exactScore });
        return; // Found exact match, skip lower tiers
      }

      // Tier 2: Prefix matches
      const prefixScore = this.prefixMatch(restaurant, normalizedQuery);
      if (prefixScore !== null) {
        tier2Results.push({ ...restaurant, searchScore: prefixScore });
        return; // Found prefix match, skip lower tiers
      }

      // Tier 3: All words present matches
      const wordsScore = this.allWordsMatch(restaurant, normalizedQuery);
      if (wordsScore !== null) {
        tier3Results.push({ ...restaurant, searchScore: wordsScore });
      }
    });

    // Process Tier 4: Fuzzy matching (only if we don't have enough exact results)
    if (tier1Results.length + tier2Results.length + tier3Results.length < 10) {
      // Only preprocess query for fuzzy search if it doesn't look like a specific name
      const searchQueries = this.isLikelyRestaurantName(query)
        ? [normalizedQuery]
        : this.preprocessQuery(query);

      const fuzzyResults: {
        item: Restaurant;
        score: number;
        matches: any[];
      }[] = [];

      searchQueries.forEach((searchQuery) => {
        const results = this.restaurantIndex!.search(searchQuery);
        results.forEach((result) => {
          if (result.score !== undefined && result.score < 0.4) {
            // Only admit results where the match is in a primary field (name, cuisine, tags).
            // This prevents description-only hits (e.g. "meat" matching a restaurant
            // just because its description mentions "meat dishes") from polluting results.
            const hasPrimaryFieldMatch = result.matches?.some(
              (m) =>
                m.key === "name" ||
                m.key === "cuisine_type" ||
                m.key === "tags",
            );
            if (!hasPrimaryFieldMatch) return;

            fuzzyResults.push({
              item: result.item,
              score: result.score,
              matches: result.matches ? [...result.matches] : [],
            });
          }
        });
      });

      // Add fuzzy results to tier 4, avoiding duplicates from tier 1-3
      fuzzyResults.forEach((result) => {
        const id = result.item.id;
        const alreadyFound =
          tier1Results.some((r) => r.id === id) ||
          tier2Results.some((r) => r.id === id) ||
          tier3Results.some((r) => r.id === id);

        if (!alreadyFound) {
          const existing = tier4Map.get(id);
          // Keep best score for duplicates
          if (!existing || result.score < existing.searchScore) {
            tier4Map.set(id, {
              ...result.item,
              searchScore: SearchTier.FUZZY_MATCH_BASE + result.score * 0.3,
            });
          }
        }
      });
    }

    // Combine all tiers
    let allResults = [
      ...tier1Results,
      ...tier2Results,
      ...tier3Results,
      ...Array.from(tier4Map.values()),
    ];

    // Apply enhanced scoring while preserving tier structure
    allResults = allResults.map((result) => {
      const enhancedScore = this.calculateEnhancedScore(
        result,
        result.searchScore,
        query,
        userLocation,
        true, // preserveTier flag
      );

      return {
        ...result,
        searchScore: enhancedScore,
      };
    });

    // Sort by enhanced score (lower is better)
    allResults.sort((a, b) => a.searchScore - b.searchScore);

    // Apply diversity filter to ensure variety in results
    const diverseResults = this.applyDiversityFilter(allResults, limit);

    // Generate suggestions
    const suggestions = this.generateSuggestions(query, restaurants);

    const searchTime = Date.now() - startTime;

    return {
      restaurants: diverseResults,
      suggestions,
      totalResults: allResults.length,
      searchTime,
      hasMore: allResults.length > limit,
    };
  }

  /**
   * Apply diversity filter to prevent result monotony
   */
  private applyDiversityFilter(
    results: Restaurant[],
    limit: number,
  ): Restaurant[] {
    const diverseResults: Restaurant[] = [];
    const cuisineCounts = new Map<string, number>();
    const MAX_PER_CUISINE = 7; // Max restaurants per cuisine in top results

    for (const restaurant of results) {
      if (diverseResults.length >= limit) break;

      const cuisineCount = cuisineCounts.get(restaurant.cuisine_type) || 0;

      // Allow more of same cuisine if it's a top match, fewer as we go down
      const maxAllowed =
        diverseResults.length < 10 ? MAX_PER_CUISINE : MAX_PER_CUISINE - 2;

      if (cuisineCount < maxAllowed) {
        diverseResults.push(restaurant);
        cuisineCounts.set(restaurant.cuisine_type, cuisineCount + 1);
      }
    }

    // If we didn't reach limit due to diversity filtering, add remaining
    if (diverseResults.length < limit) {
      const remaining = results.filter((r) => !diverseResults.includes(r));
      diverseResults.push(...remaining.slice(0, limit - diverseResults.length));
    }

    return diverseResults;
  }

  /**
   * Calculate enhanced relevance score combining fuzzy score with other factors
   * @param preserveTier - If true, apply smaller adjustments to preserve tier structure
   */
  private calculateEnhancedScore(
    restaurant: Restaurant,
    baseScore: number,
    query: string,
    userLocation?: UserLocation | null,
    preserveTier: boolean = false,
  ): number {
    let enhancedScore = baseScore;

    // Use smaller multipliers when preserving tier structure
    const multiplier = preserveTier ? 0.5 : 1.0;

    // Boost exact name matches (but less aggressively if preserving tiers)
    if (restaurant.name.toLowerCase().includes(query.toLowerCase())) {
      enhancedScore *= 1 - 0.15 * multiplier; // Lower score = better match
    }

    // Boost exact cuisine matches
    if (restaurant.cuisine_type.toLowerCase().includes(query.toLowerCase())) {
      enhancedScore *= 1 - 0.1 * multiplier;
    }

    // Boost highly rated restaurants (small adjustment)
    const ratingBoost = (restaurant.average_rating || 0) / 5;
    enhancedScore *= 1 - ratingBoost * 0.05 * multiplier;

    // Boost restaurants with more reviews (very small adjustment)
    const reviewBoost = Math.min((restaurant.total_reviews || 0) / 100, 1);
    enhancedScore *= 1 - reviewBoost * 0.03 * multiplier;

    // Distance boost if location is available (small adjustment)
    if (
      userLocation &&
      restaurant.distance !== null &&
      restaurant.distance !== undefined
    ) {
      const distanceBoost = Math.max(0, 1 - restaurant.distance / 20); // Within 20km
      enhancedScore *= 1 - distanceBoost * 0.05 * multiplier;
    }

    // Boost featured restaurants slightly (very small adjustment)
    if (restaurant.featured || restaurant.ai_featured) {
      enhancedScore *= 1 - 0.02 * multiplier;
    }

    return enhancedScore;
  }

  /**
   * Get cuisine suggestions for autocomplete
   */
  getCuisineSuggestions(query: string): string[] {
    if (query.length < 2) return [];

    const results = this.cuisineIndex.search(query);
    return results
      .filter((result) => result.score && result.score < 0.4)
      .map((result) => result.item.name)
      .slice(0, 5);
  }

  /**
   * Normalize cuisine input to standard cuisine types
   */
  normalizeCuisineInput(input: string): string[] {
    const normalized = input.toLowerCase().trim();
    const matches: string[] = [];

    Object.entries(NORMALIZED_CUISINES).forEach(([variation, cuisine]) => {
      if (normalized.includes(variation)) {
        matches.push(cuisine);
      }
    });

    return [...new Set(matches)];
  }
}

// Singleton instance for better performance
export const advancedSearchEngine = new AdvancedSearchEngine();

// Utility functions for enhanced search features
export const searchUtils = {
  highlightMatches: (text: string, query: string): string => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.split("").join(".*?")})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  },

  calculateRelevanceScore: (restaurant: Restaurant, query: string): number => {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    const lowerName = restaurant.name.toLowerCase();
    const lowerCuisine = restaurant.cuisine_type.toLowerCase();

    // Exact matches get highest score
    if (lowerName === lowerQuery) score += 100;
    else if (lowerName.startsWith(lowerQuery)) score += 80;
    else if (lowerName.includes(lowerQuery)) score += 60;

    // Cuisine matches
    if (lowerCuisine === lowerQuery) score += 70;
    else if (lowerCuisine.includes(lowerQuery)) score += 40;

    // Tag matches
    const tags = restaurant.tags || [];
    tags.forEach((tag) => {
      if (tag.toLowerCase().includes(lowerQuery)) score += 30;
    });

    // Rating bonus
    score += (restaurant.average_rating || 0) * 5;

    return score;
  },

  filterBySearchCriteria: (
    restaurants: Restaurant[],
    criteria: {
      minRating?: number;
      maxDistance?: number;
      priceRange?: number[];
      features?: string[];
    },
  ): Restaurant[] => {
    return restaurants.filter((restaurant) => {
      if (
        criteria.minRating &&
        (restaurant.average_rating || 0) < criteria.minRating
      ) {
        return false;
      }

      if (
        criteria.maxDistance &&
        restaurant.distance &&
        restaurant.distance > criteria.maxDistance
      ) {
        return false;
      }

      if (criteria.priceRange && criteria.priceRange.length > 0) {
        if (!criteria.priceRange.includes(restaurant.price_range || 0)) {
          return false;
        }
      }

      if (criteria.features && criteria.features.length > 0) {
        const hasAllFeatures = criteria.features.every((feature) => {
          switch (feature) {
            case "parking":
              return restaurant.parking_available;
            case "valet":
              return restaurant.valet_parking;
            case "outdoor":
              return restaurant.outdoor_seating;
            case "shisha":
              return restaurant.shisha_available;
            default:
              return true;
          }
        });
        if (!hasAllFeatures) return false;
      }

      return true;
    });
  },
};
