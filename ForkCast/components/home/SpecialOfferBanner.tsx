import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "@/components/image";
import { Card } from "@/components/ui/card";
import { EnrichedOffer } from "@/hooks/useOffers";

interface SpecialOfferBannerProps {
  offer: EnrichedOffer;
}

const { width: screenWidth } = Dimensions.get("window");
const bannerWidth = screenWidth - 32; // Account for container padding
const bannerHeight = 200; // Fixed height for consistency

export function SpecialOfferBanner({ offer }: SpecialOfferBannerProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push({
      pathname: "/restaurant/[id]",
      params: {
        id: offer.restaurant.id,
        highlightOfferId: offer.id,
      },
    });
  };

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
        source={{ uri: offer.img_url }}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 12,
        }}
        contentFit="cover"
      />
    </Card>
  );

  // Return clickable or non-clickable version based on is_clickable field
  if (offer.is_clickable) {
    return (
      <Pressable
        onPress={handlePress}
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
