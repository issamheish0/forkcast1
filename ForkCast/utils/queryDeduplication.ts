/**
 * Query Deduplication Utility
 *
 * Prevents duplicate API requests when the same query is triggered multiple times
 * in quick succession (e.g., from React strict mode, rapid re-renders, or concurrent requests).
 *
 * Example problem this solves:
 * - Component renders twice in React strict mode → 2 identical API calls
 * - User navigates to screen → query starts, then user refreshes → 2 queries
 * - Multiple components request same data → N queries instead of 1
 *
 * Usage:
 * ```typescript
 * const data = await deduplicateQuery(
 *   'restaurants-featured',
 *   () => supabase.from('restaurants').select('*').eq('featured', true)
 * );
 * ```
 */

// Global map to store pending queries
const pendingQueries = new Map<string, Promise<any>>();

// Statistics for monitoring
const stats = {
  totalQueries: 0,
  deduplicatedQueries: 0,
  uniqueQueries: 0,
};

/**
 * Execute a query with deduplication
 *
 * If the same query (identified by key) is already in progress, this will return
 * the existing promise instead of executing a new query.
 *
 * @param key - Unique identifier for this query (e.g., 'restaurants-featured')
 * @param queryFn - Function that returns a Promise (the actual query to execute)
 * @param options - Optional configuration
 * @returns Promise with the query result
 *
 * @example
 * ```typescript
 * // Multiple components calling this will share the same query
 * const restaurants = await deduplicateQuery(
 *   'restaurants-list',
 *   async () => {
 *     const { data } = await supabase.from('restaurants').select('*');
 *     return data;
 *   }
 * );
 * ```
 */
export async function deduplicateQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: {
    /**
     * Time in milliseconds to consider queries as "the same"
     * After this time, a new query will be allowed even with the same key
     * Default: 1000ms (1 second)
     */
    timeWindow?: number;
  } = {},
): Promise<T> {
  const { timeWindow = 1000 } = options;

  stats.totalQueries++;

  // Check if query is already pending
  const existingQuery = pendingQueries.get(key);
  if (existingQuery) {
    stats.deduplicatedQueries++;
    return existingQuery;
  }

  stats.uniqueQueries++;

  // Execute the query
  const queryPromise = queryFn().finally(() => {
    // Clean up after a short delay to allow for query deduplication
    setTimeout(() => {
      pendingQueries.delete(key);
    }, timeWindow);
  });

  // Store the pending query
  pendingQueries.set(key, queryPromise);

  return queryPromise;
}

/**
 * Clear all pending queries
 * Useful for testing or when user logs out
 */
export function clearPendingQueries(): void {
  pendingQueries.clear();
}

/**
 * Get deduplication statistics
 * Useful for monitoring and debugging
 */
export function getDeduplicationStats() {
  const deduplicationRate =
    stats.totalQueries > 0
      ? ((stats.deduplicatedQueries / stats.totalQueries) * 100).toFixed(1)
      : "0.0";

  return {
    // Current state
    pendingQueries: pendingQueries.size,

    // Lifetime stats
    totalQueries: stats.totalQueries,
    uniqueQueries: stats.uniqueQueries,
    deduplicatedQueries: stats.deduplicatedQueries,
    deduplicationRate: `${deduplicationRate}%`,

    // Estimated savings
    queriesSaved: stats.deduplicatedQueries,
    message:
      stats.deduplicatedQueries > 0
        ? `Saved ${stats.deduplicatedQueries} duplicate queries!`
        : "No duplicate queries detected yet",
  };
}

/**
 * Reset statistics (useful for testing)
 */
export function resetDeduplicationStats(): void {
  stats.totalQueries = 0;
  stats.deduplicatedQueries = 0;
  stats.uniqueQueries = 0;
}

/**
 * Create a debounced query key
 * Useful when you want to deduplicate queries with slightly different parameters
 *
 * @example
 * ```typescript
 * // These will be treated as the same query
 * createQueryKey('restaurants', { page: 1, limit: 10 })
 * createQueryKey('restaurants', { limit: 10, page: 1 }) // Same result
 * ```
 */
export function createQueryKey(
  base: string,
  params: Record<string, any>,
): string {
  // Sort keys to ensure consistent key generation regardless of parameter order
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join("&");

  return `${base}?${paramString}`;
}
