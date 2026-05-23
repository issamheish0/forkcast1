// lib/searchHistory.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "recent_searches";
const MAX_HISTORY_ITEMS = 10;

const normalizeQuery = (value: string): string => value.trim().toLowerCase();

const sanitizeFilters = (
  filters?: SearchHistoryItem["filters"],
): SearchHistoryItem["filters"] => {
  if (!filters) return undefined;

  const features =
    filters.features && filters.features.length > 0
      ? filters.features.filter(Boolean)
      : undefined;

  const sanitized: SearchHistoryItem["filters"] = {
    cuisine: filters.cuisine?.trim() || undefined,
    priceRange: filters.priceRange || undefined,
    rating: filters.rating || undefined,
    features,
  };

  if (
    !sanitized.cuisine &&
    !sanitized.priceRange &&
    !sanitized.rating &&
    (!sanitized.features || sanitized.features.length === 0)
  ) {
    return undefined;
  }

  return sanitized;
};

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters?: {
    cuisine?: string;
    priceRange?: string;
    rating?: string;
    features?: string[];
  };
  timestamp: number;
}

/**
 * Add a search to history
 */
export async function addToSearchHistory(
  query: string,
  filters?: SearchHistoryItem["filters"],
): Promise<void> {
  try {
    const history = await getSearchHistory();
    const normalizedQuery = normalizeQuery(query);

    // Check if this query already exists (case-insensitive)
    const existingIndex = history.findIndex(
      (item) => normalizeQuery(item.query) === normalizedQuery,
    );

    let mergedFilters = filters;

    // If exists, remove it (we'll add it to the top) and merge filters
    if (existingIndex !== -1) {
      const existing = history.splice(existingIndex, 1)[0];
      mergedFilters = filters ?? existing.filters;
    }

    const cleanedFilters = sanitizeFilters(mergedFilters);

    // Create new search item
    const newItem: SearchHistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      filters: cleanedFilters,
      timestamp: Date.now(),
    };

    // Add to beginning of array
    history.unshift(newItem);

    // Keep only max items
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

    // Save to storage
    await AsyncStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify(trimmedHistory),
    );
  } catch (error) {
    console.error("Error adding to search history:", error);
  }
}

/**
 * Get search history
 */
export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  try {
    const historyString = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!historyString) return [];

    const history: SearchHistoryItem[] = JSON.parse(historyString);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error("Error getting search history:", error);
    return [];
  }
}

/**
 * Remove a specific search from history
 */
export async function removeFromSearchHistory(id: string): Promise<void> {
  try {
    const history = await getSearchHistory();
    const filtered = history.filter((item) => item.id !== id);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing from search history:", error);
  }
}

/**
 * Clear all search history
 */
export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error("Error clearing search history:", error);
  }
}

/**
 * Format search history item for display
 */
export function formatSearchHistoryItem(item: SearchHistoryItem): string {
  const parts: string[] = [];

  if (item.query) {
    parts.push(item.query);
  }

  if (item.filters) {
    if (item.filters.cuisine) {
      parts.push(item.filters.cuisine);
    }
    if (item.filters.priceRange) {
      const priceSymbols = "$".repeat(parseInt(item.filters.priceRange));
      parts.push(priceSymbols);
    }
    if (item.filters.rating) {
      parts.push(`${item.filters.rating}+ ⭐`);
    }
  }

  return parts.join(" • ");
}
