// utils/queryDeduper.ts
// Prevents duplicate concurrent queries to the same endpoint

type PendingQuery = {
  promise: Promise<any>;
  timestamp: number;
};

class QueryDeduper {
  private pendingQueries = new Map<string, PendingQuery>();
  private readonly DEDUPE_WINDOW_MS = 2000; // 2 second window

  /**
   * Deduplicate concurrent queries to the same endpoint
   * Returns existing promise if same query is in flight
   */
  async dedupe<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    const existing = this.pendingQueries.get(key);

    // Reuse if exists and is recent
    if (existing && Date.now() - existing.timestamp < this.DEDUPE_WINDOW_MS) {
      return existing.promise as Promise<T>;
    }

    // Create new query
    const promise = queryFn().finally(() => {
      // Clean up after a delay to allow brief reuse
      setTimeout(() => {
        this.pendingQueries.delete(key);
      }, this.DEDUPE_WINDOW_MS);
    });

    this.pendingQueries.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Generate a cache key from query parameters
   */
  static getCacheKey(
    table: string,
    select?: string,
    filters?: Record<string, any>,
  ): string {
    const parts = [table];
    if (select) parts.push(`select:${select}`);
    if (filters) {
      const sorted = Object.keys(filters)
        .sort()
        .map((k) => `${k}:${JSON.stringify(filters[k])}`)
        .join(",");
      if (sorted) parts.push(sorted);
    }
    return parts.join("|");
  }

  /**
   * Clear all pending queries (useful for cleanup)
   */
  clear() {
    this.pendingQueries.clear();
  }
}

export const queryDeduper = new QueryDeduper();
