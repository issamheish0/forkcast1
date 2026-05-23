import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const ReviewCardSkeleton = () => {
  return (
    <View
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        backgroundColor: "transparent",
      }}
    >
      <View style={{ width: "100%" }}>
        <SkeletonPlaceholder
          width="100%"
          height={40}
          style={{ marginBottom: 12 }}
        />
        <SkeletonPlaceholder
          width={100}
          height={18}
          style={{ marginBottom: 12 }}
        />
        <SkeletonPlaceholder width="100%" height={50} />
      </View>
    </View>
  );
};

export default ReviewCardSkeleton;
