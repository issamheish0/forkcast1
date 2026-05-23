/**
 * Image Optimization Utility for Supabase Storage
 *
 * This utility transforms Supabase Storage URLs to use the /render/image/ endpoint
 * with optimization parameters to dramatically reduce egress bandwidth.
 *
 * Original URL:  https://<project>.supabase.co/storage/v1/object/public/bucket/image.jpg
 * Optimized URL: https://<project>.supabase.co/storage/v1/render/image/public/bucket/image.jpg?width=800&quality=75&format=webp
 *
 * Benefits:
 * - Reduces bandwidth by 60-80% through size optimization
 * - WebP format support for modern devices
 * - Automatic resizing for different use cases
 * - Maintains image quality while reducing file size
 */

/**
 * Image size presets for different use cases
 * Each preset includes width, quality, and format settings
 */
export const IMAGE_PRESETS = {
  /** Small thumbnails for lists, avatars (100-150px) */
  thumbnail: {
    width: 150,
    quality: 70,
    format: "webp",
  },
  /** Card images for restaurant cards, grid views (300-400px) */
  card: {
    width: 400,
    quality: 75,
    format: "webp",
  },
  /** Medium images for detail views, modals (600-800px) */
  medium: {
    width: 800,
    quality: 80,
    format: "webp",
  },
  /** Large images for hero sections, full-screen (1200px) */
  large: {
    width: 1200,
    quality: 85,
    format: "webp",
  },
  /** Full resolution with WebP conversion only */
  full: {
    quality: 90,
    format: "webp",
  },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export interface ImageOptimizationOptions {
  /** Preset size configuration */
  preset?: ImagePreset;
  /** Custom width (overrides preset) */
  width?: number;
  /** Custom height (overrides preset) */
  height?: number;
  /** Image quality 1-100 (overrides preset) */
  quality?: number;
  /** Output format (overrides preset) */
  format?: "webp" | "jpeg" | "png";
  /** Skip optimization and return original URL */
  skipOptimization?: boolean;
}

/**
 * Checks if a URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;

  return (
    url.includes("supabase.co/storage/v1/object") ||
    url.includes("supabase.co/storage/v1/render")
  );
}

/**
 * Transforms a Supabase Storage URL to use the optimized render endpoint
 *
 * @param url - Original Supabase Storage URL
 * @param options - Optimization options
 * @returns Optimized URL or original URL if not a Supabase Storage URL
 *
 * @example
 * ```typescript
 * // Using preset
 * const cardUrl = optimizeSupabaseImageUrl(url, { preset: 'card' });
 *
 * // Custom dimensions
 * const customUrl = optimizeSupabaseImageUrl(url, {
 *   width: 500,
 *   quality: 80
 * });
 *
 * // Skip optimization
 * const originalUrl = optimizeSupabaseImageUrl(url, {
 *   skipOptimization: true
 * });
 * ```
 */
export function optimizeSupabaseImageUrl(
  url: string | null | undefined,
  options: ImageOptimizationOptions = {},
): string | null {
  // Handle null/undefined URLs
  if (!url) return null;

  // Skip optimization if requested
  if (options.skipOptimization) return url;

  // Only optimize Supabase Storage URLs
  if (!isSupabaseStorageUrl(url)) return url;

  try {
    // If already using render endpoint, update parameters
    const isAlreadyOptimized = url.includes("/render/image/");

    let baseUrl: string;
    let pathPart: string;

    if (isAlreadyOptimized) {
      // Split existing render URL (ignore existing params)
      const [base] = url.split("?");
      baseUrl = base;
      // Extract path after /render/image/
      const renderIndex = base.indexOf("/render/image/");
      pathPart = base.substring(renderIndex + "/render/image/".length);
    } else {
      // Transform /object/ to /render/image/
      const objectIndex = url.indexOf("/storage/v1/object/");
      if (objectIndex === -1) return url; // Invalid format

      const beforeObject = url.substring(0, objectIndex);
      const afterObject = url.substring(
        objectIndex + "/storage/v1/object/".length,
      );

      // Remove query params from original URL
      pathPart = afterObject.split("?")[0];
      baseUrl = `${beforeObject}/storage/v1/render/image/${pathPart}`;
    }

    // Build optimization parameters
    const params = new URLSearchParams();

    // Apply preset or custom settings
    const preset = options.preset ? IMAGE_PRESETS[options.preset] : null;

    // Width (custom takes precedence over preset)
    const width =
      options.width ??
      ("width" in (preset ?? {}) ? (preset as any).width : undefined);
    if (width) {
      params.append("width", width.toString());
    }

    // Height (custom only, presets don't specify height to maintain aspect ratio)
    if (options.height) {
      params.append("height", options.height.toString());
    }

    // When only width is specified, Supabase's default resize mode crops the
    // image horizontally instead of scaling proportionally (returns width × original_height).
    // Use resize=contain to force proportional scaling and preserve aspect ratio.
    if (width && !options.height) {
      params.append("resize", "contain");
    }

    // Quality (custom takes precedence over preset)
    const quality = options.quality ?? preset?.quality ?? 75;
    params.append("quality", quality.toString());

    // Format (custom takes precedence over preset)
    const format = options.format ?? preset?.format ?? "webp";
    params.append("format", format);

    // Combine base URL with parameters
    const optimizedUrl = `${baseUrl}?${params.toString()}`;

    return optimizedUrl;
  } catch (error) {
    console.error("Error optimizing Supabase image URL:", error);
    // Return original URL on error to prevent breaking images
    return url;
  }
}

/**
 * Optimizes an array of image URLs
 * Useful for gallery images or restaurant image arrays
 */
export function optimizeSupabaseImageUrls(
  urls: (string | null | undefined)[] | null | undefined,
  options: ImageOptimizationOptions = {},
): (string | null)[] {
  if (!urls || !Array.isArray(urls)) return [];

  return urls.map((url) => optimizeSupabaseImageUrl(url, options));
}

/**
 * Gets the appropriate preset based on image dimensions/use case
 * This is a helper for automatic preset selection
 */
export function getPresetForDimensions(
  width: number,
  height: number,
): ImagePreset {
  const maxDimension = Math.max(width, height);

  if (maxDimension <= 150) return "thumbnail";
  if (maxDimension <= 400) return "card";
  if (maxDimension <= 800) return "medium";
  if (maxDimension <= 1200) return "large";
  return "full";
}

/**
 * Estimates bandwidth savings from optimization
 * Based on typical compression rates for WebP vs original formats
 */
export function estimateBandwidthSavings(preset: ImagePreset = "card"): {
  percentage: number;
  description: string;
} {
  const savings = {
    thumbnail: { percentage: 85, description: "~85% reduction" },
    card: { percentage: 75, description: "~75% reduction" },
    medium: { percentage: 65, description: "~65% reduction" },
    large: { percentage: 50, description: "~50% reduction" },
    full: {
      percentage: 30,
      description: "~30% reduction (WebP conversion only)",
    },
  };

  return savings[preset];
}
