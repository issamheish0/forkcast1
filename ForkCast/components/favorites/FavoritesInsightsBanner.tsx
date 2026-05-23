import React from "react";
import { View, Pressable } from "react-native";
import { Sparkles, ChevronRight, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/text";

interface FavoritesInsightsBannerProps {
  isVisible: boolean;
  onInsightsPress: () => void;
  onDismiss: () => void;
}

export const FavoritesInsightsBanner: React.FC<
  FavoritesInsightsBannerProps
> = ({ isVisible, onInsightsPress, onDismiss }) => {
  if (!isVisible) return null;

  const handleDismiss = async () => {
    onDismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-16 left-4 right-4"
    >
      <View className="bg-primary rounded-xl p-4 border border-primary-foreground/20">
        <View className="flex-row items-center">
          <Sparkles size={24} color="#fff" />
          <Pressable onPress={onInsightsPress} className="flex-1 ml-3">
            <Text className="text-primary-foreground font-semibold">
              Discover Your Dining Patterns
            </Text>
            <Text className="text-primary-foreground/80 text-sm">
              View insights about your favorite cuisines and dining habits
            </Text>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <Pressable onPress={onInsightsPress} className="p-2">
              <ChevronRight size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleDismiss}
              className="p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};
