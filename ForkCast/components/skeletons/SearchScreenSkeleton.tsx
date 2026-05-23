import React from "react";
import { View, ScrollView } from "react-native";
import RestaurantSearchCardSkeleton from "./RestaurantSearchCardSkeleton";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const SearchScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header Skeleton */}
      <View className="p-4 border-b border-border">
        <SkeletonPlaceholder
          width="100%"
          height={40}
          style={{ marginBottom: 12 }}
        />
        <View className="flex-row justify-between items-center">
          <SkeletonPlaceholder width={100} height={36} />
          <SkeletonPlaceholder width={100} height={36} />
          <SkeletonPlaceholder width={100} height={36} />
        </View>
      </View>

      {/* Results Header Skeleton */}
      <View className="p-4">
        <SkeletonPlaceholder width="40%" height={20} />
      </View>

      {/* Search Results Skeleton */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {[...Array(3)].map((_, index) => (
          <RestaurantSearchCardSkeleton key={index} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SearchScreenSkeleton;
