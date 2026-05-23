import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import RestaurantSearchCardSkeleton from "./RestaurantSearchCardSkeleton";

const CuisineScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="p-4 flex-row items-center">
        <SkeletonPlaceholder
          width={32}
          height={32}
          style={{ borderRadius: 16 }}
        />
        <View className="ml-4">
          <SkeletonPlaceholder
            width={150}
            height={28}
            style={{ marginBottom: 4 }}
          />
          <SkeletonPlaceholder width={100} height={20} />
        </View>
      </View>

      {/* Filter Bar */}
      <View className="px-4 pb-4 border-b border-border">
        <SkeletonPlaceholder width="100%" height={40} />
      </View>

      {/* Restaurant List */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {[...Array(4)].map((_, index) => (
          <RestaurantSearchCardSkeleton key={index} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CuisineScreenSkeleton;
