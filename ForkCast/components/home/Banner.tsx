// components/home/Banner.tsx
import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { Image } from "@/components/image";
import { Card } from "@/components/ui/card";
import { EnrichedBanner } from "@/types/banners";

interface BannerProps {
  banner: EnrichedBanner;
  onPress?: (banner: EnrichedBanner) => void;
}

const { width: screenWidth } = Dimensions.get("window");
const bannerWidth = screenWidth - 32; // Account for container padding
const bannerHeight = 200; // Fixed height for consistency

export function Banner({ banner, onPress }: BannerProps) {
  // Common banner content
  const BannerContent = (
    <Card
      variant="elevated"
      noPadding={true}
      style={{
        width: bannerWidth,
        height: bannerHeight,
        overflow: "hidden",
      }}
    >
      {/* Banner Image - Fill entire card space */}
      <Image
        {...({
          source: { uri: banner.image_url || "" },
          optimizationPreset: "large",
          style: { width: "100%", height: "100%", borderRadius: 12 },
          contentFit: "cover",
        } as any)}
      />
    </Card>
  );

  // Return clickable or non-clickable version based on isClickable
  if (banner.isClickable && onPress) {
    return (
      <Pressable
        onPress={() => onPress(banner)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        {BannerContent}
      </Pressable>
    );
  }

  // Non-clickable version - just return the banner content directly
  return <View>{BannerContent}</View>;
}
