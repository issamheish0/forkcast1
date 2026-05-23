// utils/imageCache.ts
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

/**
 * Image Cache Manager
 *
 * Caches optimized images locally to reduce network requests.
 * Works in conjunction with imageOptimization utility to cache
 * transformed Supabase Storage URLs.
 *
 * Features:
 * - LRU (Least Recently Used) cache eviction
 * - 100MB cache limit
 * - Automatic cleanup when cache is full
 * - SHA-256 hashing for cache keys
 */
class ImageCache {
  private cacheDir = `${FileSystem.cacheDirectory}images/`;
  private maxCacheSize = 100 * 1024 * 1024; // 100MB
  private cacheIndex: Map<
    string,
    { path: string; size: number; lastAccessed: number }
  > = new Map();
  private isIndexLoaded = false;
  private loadIndexPromise: Promise<void> | null = null;
  private pendingDownloads: Map<string, Promise<string>> = new Map();

  async getCachedImage(uri: string): Promise<string> {
    try {
      await this.ensureIndexLoaded();

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uri,
      );
      const cachedPath = `${this.cacheDir}${hash}`;

      try {
        const info = await FileSystem.getInfoAsync(cachedPath);
        if (info.exists && !info.isDirectory) {
          this.addOrUpdateCacheEntry(hash, cachedPath, info);
          this.updateAccessTime(hash);
          try {
            const { networkMeter } = await import("@/utils/networkMeter");
            networkMeter.record({ url: uri, bytes: 0, fromCache: true });
          } catch {}
          return cachedPath;
        }
      } catch (error) {
        // Cache metadata read failed, continue to download
      }

      if (this.pendingDownloads.has(hash)) {
        return this.pendingDownloads.get(hash)!;
      }

      const downloadPromise = this.downloadAndCache(uri, hash)
        .catch((error) => {
          // Download failed, return original URI so image can still load
          return uri;
        })
        .finally(() => {
          this.pendingDownloads.delete(hash);
        });

      this.pendingDownloads.set(hash, downloadPromise);
      return downloadPromise;
    } catch (error) {
      // Critical error in cache system, return original URI
      return uri;
    }
  }

  private async downloadAndCache(uri: string, hash: string): Promise<string> {
    const path = `${this.cacheDir}${hash}`;
    try {
      await this.ensureCacheDirExists();

      // Download with timeout to prevent hanging
      const downloadResult = await FileSystem.downloadAsync(uri, path);

      // Verify download succeeded
      if (downloadResult.status !== 200) {
        throw new Error(
          `ImageCache: download failed with status ${downloadResult.status}`,
        );
      }

      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists || info.isDirectory) {
        throw new Error("ImageCache: downloaded file is not accessible");
      }

      this.addOrUpdateCacheEntry(hash, path, info);
      await this.cleanupIfNeeded();

      // Record network bytes (file size) for storage egress metering
      try {
        const { networkMeter } = await import("@/utils/networkMeter");
        const size = this.getFileSize(info);
        networkMeter.record({ url: uri, bytes: size, fromCache: false });
      } catch {}

      return path;
    } catch (error) {
      // Clean up partial downloads silently
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }

      // Fallback to remote URI so the image can still load
      return uri;
    }
  }

  private async cleanupIfNeeded() {
    const totalSize = Array.from(this.cacheIndex.values()).reduce(
      (sum, item) => sum + item.size,
      0,
    );

    if (totalSize > this.maxCacheSize) {
      const sortedEntries = Array.from(this.cacheIndex.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed,
      );

      let currentSize = totalSize;
      for (const [hash, info] of sortedEntries) {
        if (currentSize <= this.maxCacheSize * 0.8) break;

        try {
          await FileSystem.deleteAsync(info.path, { idempotent: true });
          this.cacheIndex.delete(hash);
          currentSize -= info.size;
        } catch {
          // Ignore cleanup errors, they don't affect functionality
        }
      }
    }
  }

  private updateAccessTime(hash: string) {
    const entry = this.cacheIndex.get(hash);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  private async ensureCacheDirExists() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, {
          intermediates: true,
        });
      } else if (!dirInfo.isDirectory) {
        throw new Error("ImageCache: cache path exists and is not a directory");
      }
    } catch (error) {
      // Critical error, but throw so caller can handle
      throw error;
    }
  }

  private async ensureIndexLoaded() {
    if (this.isIndexLoaded) {
      return;
    }

    if (!this.loadIndexPromise) {
      this.loadIndexPromise = this.loadExistingCacheEntries();
    }

    try {
      await this.loadIndexPromise;
    } finally {
      this.isIndexLoaded = true;
    }
  }

  private async loadExistingCacheEntries() {
    try {
      await this.ensureCacheDirExists();
    } catch {
      // Cache directory creation failed, cache will be disabled
      return;
    }

    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      const now = Date.now();

      await Promise.all(
        files.map(async (fileName) => {
          const path = `${this.cacheDir}${fileName}`;
          try {
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists && !info.isDirectory) {
              this.cacheIndex.set(fileName, {
                path,
                size: this.getFileSize(info),
                lastAccessed: now,
              });
            }
          } catch {
            // Skip files that can't be accessed
          }
        }),
      );
    } catch {
      // Failed to read cache directory, start with empty cache
    }
  }

  private addOrUpdateCacheEntry(
    hash: string,
    path: string,
    info: FileSystem.FileInfo,
  ) {
    if (!info.exists || info.isDirectory) {
      return;
    }

    const size = this.getFileSize(info);

    this.cacheIndex.set(hash, {
      path,
      size,
      lastAccessed: Date.now(),
    });
  }

  private getFileSize(info: FileSystem.FileInfo): number {
    if (!info.exists || info.isDirectory) {
      return 0;
    }

    if ("size" in info && typeof info.size === "number") {
      return info.size;
    }

    return 0;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const totalSize = Array.from(this.cacheIndex.values()).reduce(
      (sum, item) => sum + item.size,
      0,
    );

    return {
      totalSize,
      maxSize: this.maxCacheSize,
      itemCount: this.cacheIndex.size,
      totalFiles: this.cacheIndex.size,
      usagePercent: totalSize > 0 ? (totalSize / this.maxCacheSize) * 100 : 0,
      hitRate: 0, // Not tracked in simplified version
    };
  }

  /**
   * Clear all cached images
   */
  async clearCache() {
    try {
      await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
      this.cacheIndex.clear();
      this.isIndexLoaded = false;
      await this.ensureCacheDirExists();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Preload images for better UX
   */
  async preloadImages(uris: string[]) {
    try {
      await Promise.all(
        uris.map((uri) => this.getCachedImage(uri).catch(() => uri)),
      );
    } catch (error) {
      // Silently fail preloading
    }
  }
}

export const imageCache = new ImageCache();
