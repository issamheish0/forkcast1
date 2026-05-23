import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Pressable, LayoutRectangle } from "react-native";
import { Heart, Share2, Phone, Navigation } from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Database } from "@/types/supabase";
import * as Haptics from "expo-haptics";
import CuisineBurst from "@/components/animations/CuisineBurst";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface QuickActionsBarProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  colorScheme: "light" | "dark";
  onToggleFavorite: () => void;
  onShare: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onDirections: () => void;
}

const QuickActionsBarComponent = ({
  restaurant,
  isFavorite,
  colorScheme,
  onToggleFavorite,
  onShare,
  onCall,
  onWhatsApp,
  onDirections,
}: QuickActionsBarProps) => {
  const [tapCount, setTapCount] = useState(0);
  const lastTapTsRef = useRef<number>(0);
  const [showBurst, setShowBurst] = useState(false);
  const [favButtonLayout, setFavButtonLayout] =
    useState<LayoutRectangle | null>(null);

  const handleFavoritePress = useCallback(() => {
    onToggleFavorite();

    const now = Date.now();
    const withinWindow = now - lastTapTsRef.current < 2500;
    const nextCount = withinWindow ? tapCount + 1 : 1;
    lastTapTsRef.current = now;
    setTapCount(nextCount);

    if (nextCount >= 5) {
      setTapCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBurst(true);
    }
  }, [onToggleFavorite, tapCount]);

  const burstOrigin = useMemo(() => {
    if (!favButtonLayout) return { x: 28, y: 20 };
    return {
      x: favButtonLayout.x + favButtonLayout.width / 2,
      y: favButtonLayout.y + favButtonLayout.height / 2,
    };
  }, [favButtonLayout]);

  return (
    <View className="bg-background border-b border-border">
      <View className="flex-row justify-between items-center px-4 py-3">
        <Pressable
          onPress={handleFavoritePress}
          className="flex-row items-center gap-2"
          onLayout={(e) => setFavButtonLayout(e.nativeEvent.layout)}
        >
          <Heart
            size={24}
            color={
              isFavorite ? "#ef4444" : colorScheme === "dark" ? "#fff" : "#000"
            }
            fill={isFavorite ? "#ef4444" : "transparent"}
          />
          <Text className="font-medium">{isFavorite ? "Saved" : "Save"}</Text>
        </Pressable>

        <View className="flex-row gap-4">
          <Pressable onPress={onShare}>
            <Share2 size={24} color={colorScheme === 'dark' ? '#fff' : '#374151'} />
          </Pressable>
          {restaurant.phone_number && (
            <Pressable onPress={onCall}>
              <Phone size={24} color={colorScheme === 'dark' ? '#fff' : '#374151'} />
            </Pressable>
          )}
          {restaurant.whatsapp_number && (
            <Pressable onPress={onWhatsApp}>
              <FontAwesome name="whatsapp" size={24} color="#25D366" />
            </Pressable>
          )}
          <Pressable onPress={onDirections}>
            <Navigation size={24} color="#3b82f6" />
          </Pressable>
        </View>
        {
          <CuisineBurst
            visible={showBurst}
            originX={burstOrigin.x}
            originY={burstOrigin.y}
            onComplete={() => setShowBurst(false)}
          />
        }
      </View>
    </View>
  );
};

export const QuickActionsBar = React.memo(QuickActionsBarComponent);
