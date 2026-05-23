import { imageCache } from "./imageCache";

/**
 * Monitor network requests to verify caching is working
 * This helps verify that images are being served from cache instead of network
 */
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private requestCount = 0;
  private cachedRequests = 0;
  private cacheMisses = 0;

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  /**
   * Start monitoring - call this when app starts
   */
  startMonitoring() {
    // Override the original getCachedImage to track requests
    const originalGetCachedImage = imageCache.getCachedImage.bind(imageCache);

    imageCache.getCachedImage = async (uri: string) => {
      this.requestCount++;

      try {
        const result = await originalGetCachedImage(uri);

        // Check if result is a local file path (cached) or original URL (not cached)
        if (
          result.startsWith("file://") ||
          result.includes("FileSystem.cacheDirectory")
        ) {
          this.cachedRequests++;
        } else {
          this.cacheMisses++;
        }

        return result;
      } catch (error) {
        this.cacheMisses++;

        throw error;
      }
    };
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const hitRate =
      this.requestCount > 0
        ? (this.cachedRequests / this.requestCount) * 100
        : 0;

    return {
      totalRequests: this.requestCount,
      cachedRequests: this.cachedRequests,
      cacheMisses: this.cacheMisses,
      hitRate: hitRate.toFixed(1) + "%",
    };
  }

  /**
   * Log current stats
   */

  /**
   * Reset monitoring stats
   */
  reset() {
    this.requestCount = 0;
    this.cachedRequests = 0;
    this.cacheMisses = 0;
  }
}

export const networkMonitor = NetworkMonitor.getInstance();
