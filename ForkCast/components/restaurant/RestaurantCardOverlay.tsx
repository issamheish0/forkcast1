// components/restaurant/RestaurantCardOverlay.tsx
import React, { useState, useCallback } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { Heart } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { OfferBadge } from "@/components/restaurant/OfferBadge";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

interface RestaurantCardOverlayProps {
  /** Whether to show the favorite/like button */
  showFavorite?: boolean;
  /** Whether the restaurant is favorited */
  isFavorite?: boolean;
  /** Handler for favorite button press */
  onFavoritePress?: () => void;
  /** Whether restaurant is featured */
  isFeatured?: boolean;
  /** Whether restaurant has an active offer */
  hasActiveOffer?: boolean;
  /** Discount percentage for offer badge */
  offerDiscount?: number;
  /** Container inset padding (default: 12px) */
  inset?: number;
}

/**
 * RestaurantCardOverlay - Unified overlay component for all restaurant card variants
 *
 * Layout:
 * - Top-left: Badges (Featured above Offer, stacked vertically)
 * - Top-right: Action button (Like)
 *
 * Styling:
 * - Consistent padding: 12px inset
 * - Buttons: 40-44px circular, semi-transparent dark background, white icons
 * - Badges: Pill shape, solid colors, white outline, consistent sizing
 */
const RestaurantCardOverlayComponent: React.FC<RestaurantCardOverlayProps> = ({
  showFavorite = true,
  isFavorite = false,
  onFavoritePress,
  isFeatured = false,
  hasActiveOffer = false,
  offerDiscount,
  inset = 12,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const overlayBg = isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)";
  const overlayIconColor = isDark ? "white" : primaryColor;

  // Animation state for floating hearts
  const [animatedHearts, setAnimatedHearts] = useState<
    {
      id: number;
      left: number;
      top: number;
    }[]
  >([]);

  // Always provide a handler - even if it's a no-op
  const handleFavoritePress = useCallback(
    (e: any) => {
      e.stopPropagation();

      // Only show animation when liking (not when unliking)
      const wasFavorite = isFavorite;

      // Call the actual handler if provided
      onFavoritePress?.();

      // Only create animated heart if we're liking (transitioning from not favorite to favorite)
      // Note: isFavorite will update after handler, so we check the previous state
      if (!wasFavorite) {
        // Create animated heart at random position
        const heartId = Date.now();

        // Random position on the image (avoid edges)
        const left = Math.random() * 60 + 20; // 20-80% of width
        const top = Math.random() * 60 + 20; // 20-80% of height

        setAnimatedHearts((prev) => [...prev, { id: heartId, left, top }]);

        // Animation will be handled in AnimatedHeart component
        // Remove heart after animation (1 second)
        setTimeout(() => {
          setAnimatedHearts((prev) => prev.filter((h) => h.id !== heartId));
        }, 1000);
      }
    },
    [onFavoritePress, isFavorite],
  );

  // Always render overlay - buttons are always shown
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
      }}
      pointerEvents="box-none"
    >
      {/* Top-left: Badge stack (Featured) */}
      {isFeatured && (
        <View
          style={{
            position: "absolute",
            top: inset,
            left: inset,
            zIndex: 20,
            gap: 4,
          }}
        >
          {isFeatured && (
            <View
              style={{
                backgroundColor: "hsl(345, 55%, 31%)", // primary color
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 8,
                height: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="text-[8px] font-bold text-white uppercase tracking-wide">
                Featured
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Bottom-right: Discount badge aligned with heart button, half-in/half-out */}
      {hasActiveOffer && offerDiscount && (
        <View
          style={{
            position: "absolute",
            bottom: -15, // Half outside (radius is 20)
            right: inset, // Aligned with buttons on the right
            zIndex: 20,
            width: 36,
            height: 36,
            borderRadius: 20,
            backgroundColor: "hsl(345, 55%, 31%)", // primary color
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 4,
            elevation: 6,
            borderWidth: 1,
            borderColor: "white",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 12,
              fontWeight: "800",
              textAlign: "center",
              letterSpacing: -0.3,
            }}
          >
            {offerDiscount}%
          </Text>
        </View>
      )}

      {/* Top-right: Action buttons - ALWAYS RENDER, Playlist left, Like right */}
      {/* Center-align with Featured badge: badge is 18px tall (center at 9px), buttons are 32px tall (center at 16px) */}
      {/* So buttons need to be offset by: 9px - 16px = -7px from badge top */}
      <View
        style={{
          position: "absolute",
          top: inset + 18 / 2 - 32 / 2, // Center-align: badge center (9px) - button center (16px) = -7px offset
          right: inset,
          zIndex: 20,
          flexDirection: "row",
          gap: 6, // Horizontal spacing between buttons
          alignItems: "center",
        }}
      >
        {/* Like button - right side, red when favorited */}
        <Pressable
          onPress={handleFavoritePress}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: overlayBg,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 5,
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Heart
            size={14}
            color={isFavorite ? "#ef4444" : overlayIconColor}
            fill={isFavorite ? "#ef4444" : "transparent"}
            strokeWidth={isFavorite ? 2 : 1.5}
          />
        </Pressable>
      </View>

      {/* Animated floating hearts */}
      {animatedHearts.map((heart) => (
        <AnimatedHeart key={heart.id} left={heart.left} top={heart.top} />
      ))}
    </View>
  );
};

// Animated heart component with reanimated
const AnimatedHeart: React.FC<{ left: number; top: number }> = ({
  left,
  top,
}) => {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(0, { duration: 1000 });
    translateY.value = withTiming(-50, { duration: 1000 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          zIndex: 30,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Heart size={24} color="#ef4444" fill="#ef4444" />
    </Animated.View>
  );
};

// Memoize component to prevent unnecessary re-renders
export const RestaurantCardOverlay = React.memo(RestaurantCardOverlayComponent);
