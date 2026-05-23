import { useEffect, useRef } from "react";
import { imageCache } from "@/utils/imageCache";

interface UseImagePreloaderOptions {
  enabled?: boolean;
  delay?: number;
}

export const useImagePreloader = (
  imageUrls: string[],
  options: UseImagePreloaderOptions = {},
) => {
  const { enabled = true, delay = 100 } = options;
  const preloadedRef = useRef(new Set<string>());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !imageUrls.length) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce preloading to avoid overwhelming the system
    timeoutRef.current = setTimeout(async () => {
      try {
        // Filter out already preloaded images
        const newImages = imageUrls.filter(
          (url) => !preloadedRef.current.has(url),
        );

        if (newImages.length > 0) {
          // Preload images in batches to avoid overwhelming the system
          const batchSize = 5;
          for (let i = 0; i < newImages.length; i += batchSize) {
            const batch = newImages.slice(i, i + batchSize);
            await Promise.allSettled(
              batch.map(async (url) => {
                try {
                  await imageCache.getCachedImage(url);
                  preloadedRef.current.add(url);
                } catch (error) {
                  console.warn(`Failed to preload image: ${url}`, error);
                }
              }),
            );

            // Small delay between batches to prevent blocking the UI
            if (i + batchSize < newImages.length) {
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          }
        }
      } catch (error) {
        console.warn("Error preloading images:", error);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [imageUrls, enabled, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    preloadedCount: preloadedRef.current.size,
    totalCount: imageUrls.length,
    isPreloading: preloadedRef.current.size < imageUrls.length,
  };
};
