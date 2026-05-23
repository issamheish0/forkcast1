import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Filter, Heart } from "lucide-react-native";
import FavoritesGridCardSkeleton from "./FavoritesGridCardSkeleton";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { H2, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

const FavoritesScreenSkeleton = () => {
  const { colorScheme } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Real Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <H2 className="text-2xl font-bold tracking-tight">My Collection</H2>
            <Muted className="text-sm mt-0.5">Loading restaurants...</Muted>
          </View>
          <View className="ml-4">
            <Pressable className="p-2 relative">
              <Filter
                size={24}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Real Tabs */}
      <View className="px-4">
        <View className="flex-row bg-muted dark:bg-card rounded-xl p-1">
          <View className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-background dark:bg-secondary">
            <Heart size={18} color="#dc2626" fill="#dc2626" />
            <View className="ml-2 font-medium text-primary">
              <Muted className="text-primary font-medium">Favorites</Muted>
            </View>
          </View>

        </View>
      </View>

      {/* Grid */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8 }}>
        {[...Array(3)].map((_, rowIndex) => (
          <View key={rowIndex} className="flex-row">
            <FavoritesGridCardSkeleton />
            <FavoritesGridCardSkeleton />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FavoritesScreenSkeleton;
