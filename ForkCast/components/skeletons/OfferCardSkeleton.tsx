import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const OfferCardSkeleton = () => {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        backgroundColor: "transparent",
      }}
    >
      <View style={{ width: "100%" }}>
        <SkeletonPlaceholder
          width="80%"
          height={20}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder
          width="100%"
          height={16}
          style={{ marginBottom: 16 }}
        />
        <SkeletonPlaceholder width="50%" height={14} />
      </View>
    </View>
  );
};

export default OfferCardSkeleton;
