import { imageCache } from "./imageCache";

/**
 * Performance test to simulate real app usage
 */
export const runPerformanceTest = async () => {
  // Use the most requested image from your logs
  const highTrafficImageUrl =
    "https://xsovqvbigdettnpeisjs.supabase.co/storage/v1/object/public/images/578fe3cc-a260-43bd-8005-b43b5db8083f/gallery_1760025618270_e9t2g.jpg";

  const results = {
    totalRequests: 10,
    cacheHits: 0,
    cacheMisses: 0,
    totalTime: 0,
    cachedTime: 0,
    uncachedTime: 0,
  };

  for (let i = 0; i < results.totalRequests; i++) {
    const start = Date.now();

    try {
      const result = await imageCache.getCachedImage(highTrafficImageUrl);
      const duration = Date.now() - start;

      results.totalTime += duration;

      // Check if result is a local file (cached) or original URL
      if (
        result.startsWith("file://") ||
        result.includes("FileSystem.cacheDirectory")
      ) {
        results.cacheHits++;
        results.cachedTime += duration;
      } else {
        results.cacheMisses++;
        results.uncachedTime += duration;
      }
    } catch (error) {
      results.cacheMisses++;
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Calculate performance metrics
  const hitRate = (results.cacheHits / results.totalRequests) * 100;
  const avgCachedTime =
    results.cacheHits > 0 ? results.cachedTime / results.cacheHits : 0;
  const avgUncachedTime =
    results.cacheMisses > 0 ? results.uncachedTime / results.cacheMisses : 0;
  const avgTotalTime = results.totalTime / results.totalRequests;

  if (results.cacheHits > 0) {
    const speedImprovement =
      ((avgUncachedTime - avgCachedTime) / avgUncachedTime) * 100;
  }

  return results;
};
