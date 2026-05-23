import { imageCache } from "./imageCache";

/**
 * Test function to verify image caching is working properly
 * Run this in development to verify the cache implementation
 */
export const testImageCache = async () => {
  // Use a real, working image URL for testing
  const testImageUrl =
    "https://xsovqvbigdettnpeisjs.supabase.co/storage/v1/object/public/images/93a41902-b1dd-4f69-8a4d-cf910b8317f7/gallery_1760025338800_4u0c3e.jpg";

  try {
    // First request - should be a cache miss

    const start1 = Date.now();
    const result1 = await imageCache.getCachedImage(testImageUrl);
    const time1 = Date.now() - start1;

    // Second request - should be a cache hit
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
};

/**
 * Test with a real Supabase image URL
 */
export const testRealImageCache = async () => {
  // Use one of the URLs from your logs
};

/**
 * Run both tests
 */
export const runAllTests = async () => {
  await testImageCache();
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
  await testRealImageCache();

  // Run performance test
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

  const { runPerformanceTest } = await import("./performanceTest");
  await runPerformanceTest();
};
