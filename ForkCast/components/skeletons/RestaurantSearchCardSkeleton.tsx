import React from "react";
import { View } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const RestaurantSearchCardSkeleton = () => {
  return (
    <View className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4">
      {/* Image Placeholder */}
      <SkeletonPlaceholder width="100%" height={192} />

      <View className="p-4">
        {/* Title and Address */}
        <SkeletonPlaceholder
          width="70%"
          height={20}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder
          width="50%"
          height={16}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder
          width="40%"
          height={16}
          style={{ marginBottom: 12 }}
        />

        {/* Info Row */}
        <View className="flex-row items-center gap-4 mb-3">
          <SkeletonPlaceholder width={60} height={16} />
          <SkeletonPlaceholder width={60} height={16} />
          <SkeletonPlaceholder width={60} height={16} />
        </View>

        {/* Availability Tag */}
        <SkeletonPlaceholder
          width={100}
          height={24}
          style={{ borderRadius: 999 }}
        />
      </View>
    </View>
  );
};

export default RestaurantSearchCardSkeleton;
