import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const RestaurantCardSkeleton = () => {
  return (
    <View
      style={{
        width: 260,
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        marginRight: 16,
        backgroundColor: "transparent",
      }}
    >
      <View style={{ width: "100%" }}>
        <SkeletonPlaceholder
          width="100%"
          height={150}
          style={{ marginBottom: 16 }}
        />
        <SkeletonPlaceholder
          width="80%"
          height={20}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder width="60%" height={16} />
      </View>
    </View>
  );
};

export default RestaurantCardSkeleton;
