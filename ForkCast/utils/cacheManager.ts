import { imageCache } from "./imageCache";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_STATS_KEY = "image_cache_stats";
const LAST_CLEANUP_KEY = "last_cache_cleanup";

export class CacheManager {
  private static instance: CacheManager;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const stats = imageCache.getCacheStats();
    const lastCleanup = await AsyncStorage.getItem(LAST_CLEANUP_KEY);

    return {
      ...stats,
      lastCleanup: lastCleanup ? new Date(lastCleanup) : null,
      formattedSize: this.formatBytes(stats.totalSize),
      formattedMaxSize: this.formatBytes(stats.maxSize),
    };
  }

  /**
   * Clear all cached images
   */
  async clearAllCache() {
    try {
      await imageCache.clearCache();
      await AsyncStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString());

      return true;
    } catch (error) {
      console.error("❌ Failed to clear image cache:", error);
      return false;
    }
  }

  /**
   * Perform automatic cache cleanup if needed
   */
  async performCleanupIfNeeded() {
    const stats = imageCache.getCacheStats();

    // Cleanup if cache usage is above 80%
    if (stats.usagePercent > 80) {
      await this.clearAllCache();
      return true;
    }

    return false;
  }

  /**
   * Preload critical images for the app
   */
  async preloadCriticalImages(imageUrls: string[]) {
    try {
      await imageCache.preloadImages(imageUrls);
    } catch (error) {
      console.error("❌ Failed to preload critical images:", error);
    }
  }

  /**
   * Monitor cache performance and log stats
   */
  async logCacheStats() {}

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

export const cacheManager = CacheManager.getInstance();
