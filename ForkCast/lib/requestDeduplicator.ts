/**
 * Request Deduplication Utility
 *
 * Prevents duplicate in-flight requests by caching promises for a short TTL.
 * Safe fallback - if anything fails, requests proceed normally.
 *
 * @example
 * ```typescript
 * const data = await requestDeduplicator.deduplicate(
 *   'restaurant:123',
 *   () => supabase.from('restaurants').select('*').eq('id', '123').single()
 * );
 * ```
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  subscribers: number;
}

class RequestDeduplicator {
  private pending = new Map<string, PendingRequest<any>>();
  private defaultTTL = 1000; // 1s deduplication window for expensive requests
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup of stale entries
    this.startCleanup();
  }

  /**
   * Deduplicate a request by key
   * If a request with the same key is in-flight, returns the existing promise
   * Otherwise, executes the fetcher and caches the promise
   */
  async deduplicate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL,
  ): Promise<T> {
    try {
      const now = Date.now();
      const existing = this.pending.get(key);

      // Check if request is in-flight and not expired
      if (existing && now - existing.timestamp < ttl) {
        existing.subscribers++;

        return existing.promise;
      }

      const promise = fetcher().finally(() => {
        // Clean up after TTL
        setTimeout(() => {
          const current = this.pending.get(key);
          if (current?.promise === promise) {
            this.pending.delete(key);
          }
        }, ttl);
      });

      this.pending.set(key, {
        promise,
        timestamp: now,
        subscribers: 1,
      });

      return promise;
    } catch (error) {
      // Safety fallback - if deduplication fails, just execute the request
      console.warn(
        "[Dedup] Deduplication failed, executing request normally:",
        error,
      );
      return fetcher();
    }
  }

  /**
   * Clear all pending requests (useful for logout or testing)
   */
  clear(): void {
    this.pending.clear();
  }

  /**
   * Get statistics about current pending requests
   */
  getStats(): {
    totalPending: number;
    keys: string[];
    totalSubscribers: number;
  } {
    const keys = Array.from(this.pending.keys());
    const totalSubscribers = Array.from(this.pending.values()).reduce(
      (sum, req) => sum + req.subscribers,
      0,
    );

    return {
      totalPending: this.pending.size,
      keys,
      totalSubscribers,
    };
  }

  /**
   * Start periodic cleanup of expired requests
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 5000; // Clean up requests older than 5 seconds

      for (const [key, request] of this.pending.entries()) {
        if (now - request.timestamp > maxAge) {
          this.pending.delete(key);
        }
      }
    }, 10000); // Run cleanup every 10 seconds
  }

  /**
   * Stop cleanup (useful for testing or cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();

// Helper function for common use case
export const deduplicateRequest = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number,
): Promise<T> => {
  return requestDeduplicator.deduplicate(key, fetcher, ttl);
};
