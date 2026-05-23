import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { CUISINE_TYPES } from "@/constants/searchConstants";
import { Check, ChefHat } from "lucide-react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";

export default function PreferredCuisinesScreen() {
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const themed = getThemedColors(colorScheme);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine],
    );
  };

  const handleSave = async () => {
    if (selectedCuisines.length === 0) {
      handleSkip();
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ favorite_cuisines: selectedCuisines })
        .eq("id", profile?.id);

      if (error) throw error;

      await updateProfile({ favorite_cuisines: selectedCuisines });

      // Small delay to ensure state is propagated
      await new Promise((resolve) => setTimeout(resolve, 300));

      router.replace("/(protected)/(tabs)");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      Alert.alert("Error", "Failed to save preferences. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.replace("/(protected)/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 py-8">
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          className="mb-8"
        >
          <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-6 self-center">
            <ChefHat size={40} color="#792339" />
          </View>
          <H1 className="text-center mb-3">Favorite Cuisines</H1>
          <P className="text-center text-muted-foreground">
            Select the cuisines you enjoy the most to get personalized
            recommendations.
          </P>
        </Animated.View>

        {/* Cuisine List */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Animated.View
            entering={FadeInDown.duration(500).delay(200)}
            className="flex-row flex-wrap gap-3 justify-center"
          >
            {CUISINE_TYPES.map((cuisine) => {
              const isSelected = selectedCuisines.includes(cuisine);
              return (
                <TouchableOpacity
                  key={cuisine}
                  onPress={() => toggleCuisine(cuisine)}
                  className={`px-4 py-3 rounded-full border flex-row items-center gap-2 ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  {isSelected && <Check size={16} color="white" />}
                  <Text
                    className={`font-medium ${
                      isSelected ? "text-white" : "text-foreground"
                    }`}
                  >
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </ScrollView>

        {/* Actions */}
        <Animated.View
          entering={FadeInUp.duration(500).delay(300)}
          className="pt-4 gap-3"
        >
          <Button
            onPress={handleSave}
            disabled={isSubmitting}
            className="w-full"
            size="lg"
          >
            <Text className="text-white font-semibold text-base">
              {isSubmitting
                ? "Saving..."
                : selectedCuisines.length > 0
                  ? "Save Preferences"
                  : "Skip for Now"}
            </Text>
          </Button>

          {selectedCuisines.length > 0 && (
            <Button
              onPress={handleSkip}
              variant="ghost"
              disabled={isSubmitting}
              className="w-full"
            >
              <Text className="text-muted-foreground">Skip</Text>
            </Button>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
