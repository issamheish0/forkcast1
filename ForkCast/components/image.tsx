import React, { useMemo, useState } from "react";
import { Image as ExpoImage, ImageProps } from "expo-image";
import { ImageSourcePropType } from "react-native";
import { cssInterop } from "nativewind";
import { useSharedImage } from "@/hooks/useSharedImage";
import type {
  ImagePreset,
  ImageOptimizationOptions,
} from "@/utils/imageOptimization";
import { optimizeSupabaseImageUrl } from "@/utils/imageOptimization";
import { FEATURE_FLAGS } from "@/config/features";

interface CachedImageProps extends Omit<ImageProps, "source"> {
  source: ImageSourcePropType | { uri: string | null } | string | null;
  /**
   * Image optimization preset for Supabase Storage images
   * - thumbnail: 150px, 70% quality (lists, avatars)
   * - card: 400px, 75% quality (restaurant cards)
   * - medium: 800px, 80% quality (detail views)
   * - large: 1200px, 85% quality (hero images)
   * - full: Original size with WebP conversion
   * @default 'card'
   */
  optimizationPreset?: ImagePreset;
  /**
   * Custom optimization options (overrides preset)
   */
  optimizationOptions?: ImageOptimizationOptions;
}

const CachedImage: React.FC<CachedImageProps> = ({
  source,
  optimizationPreset = "card",
  optimizationOptions,
  ...props
}) => {
  // Extract URI from source prop
  const remoteUri = useMemo(() => {
    if (!source) return null;
    if (typeof source === "string") return source;
    if (typeof source === "object" && "uri" in source) return source.uri;
    return null;
  }, [source]);

  // Build optimization options from preset and overrides
  const optimizedRemoteUri = useMemo(() => {
    if (!remoteUri) return null;
    if (!FEATURE_FLAGS.IMAGE_OPTIMIZATION_ENABLED) return remoteUri;
    // Apply preset unless custom options explicitly request skipOptimization
    const options: ImageOptimizationOptions = {
      ...(optimizationOptions || {}),
      ...(optimizationPreset ? { preset: optimizationPreset } : {}),
    };
    return optimizeSupabaseImageUrl(remoteUri, options);
  }, [remoteUri, optimizationPreset, optimizationOptions]);

  // If optimized fails, fall back to original URL by toggling this flag
  const [useOriginal, setUseOriginal] = useState(false);

  // Choose which remote URL to actually fetch/cache
  const chosenRemoteUri = useMemo(() => {
    if (!remoteUri) return null;
    if (useOriginal) return remoteUri;
    return optimizedRemoteUri || remoteUri;
  }, [remoteUri, optimizedRemoteUri, useOriginal]);

  // Use shared image cache hook on the chosen URL so all components share the same cached download
  const sharedUri = useSharedImage(chosenRemoteUri);

  // Memoize the final source to avoid recalculating
  const finalSource = useMemo(() => {
    // Handle null/undefined source
    if (!source) {
      return undefined;
    }

    // Handle local assets (require() returns a number)
    if (typeof source === "number") {
      return source;
    }

    // Handle string sources
    if (typeof source === "string") {
      // Local asset path (non-HTTP)
      if (!source.startsWith("http")) {
        return source;
      }
      // HTTP URL - use shared cached URI (fallback to optimized or original)
      const base = (useOriginal ? remoteUri : optimizedRemoteUri) || source;
      const effectiveUri = sharedUri || base;
      return { uri: effectiveUri };
    }

    // Handle object sources with uri property
    if (typeof source === "object" && "uri" in source) {
      const uri = source.uri;

      // No URI or empty URI - return undefined
      if (!uri || typeof uri !== "string") {
        return undefined;
      }

      // Local asset path (non-HTTP)
      if (!uri.startsWith("http")) {
        return { ...source, uri }; // Reconstruct to ensure type is string, not string | null
      }

      // HTTP URL - use shared cached URI (fallback to optimized or original)
      const base = (useOriginal ? remoteUri : optimizedRemoteUri) || uri;
      const effectiveUri = sharedUri || base;
      return { ...source, uri: effectiveUri };
    }

    // For any other type (arrays, etc.), return as-is
    return source as any;
  }, [source, sharedUri]);

  return (
    <ExpoImage
      source={finalSource}
      onError={() => {
        // Retry once with the original un-optimized URL.
        // Defer setState off the Glide RequestListener callback to avoid
        // "can't start or clear loads in RequestListener callbacks" on Android.
        if (!useOriginal) {
          setTimeout(() => setUseOriginal(true), 0);
        }
      }}
      {...props}
    />
  );
};

// Preserve prop types when wrapping with cssInterop so callers can pass
// `optimizationPreset` and `optimizationOptions` without TypeScript errors.
const StyledImage = cssInterop(CachedImage as React.ComponentType<any>, {
  className: "style",
});

// Explicitly type the exported Image component so JSX recognizes our extra props
type ImageComponentProps = React.ComponentProps<typeof CachedImage>;
const ExportedImage: React.FC<ImageComponentProps> =
  StyledImage as unknown as React.FC<ImageComponentProps>;

export { ExportedImage as Image };
