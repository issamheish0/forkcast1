import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const SpecialOfferCardSkeleton = () => {
  return (
    <View style={{ width: 280, marginRight: 16 }}>
      <View style={{ width: "100%" }}>
        <SkeletonPlaceholder
          width="100%"
          height={140}
          borderRadius={8}
          style={{ marginBottom: 12 }}
        />
        <SkeletonPlaceholder
          width="80%"
          height={18}
          style={{ marginBottom: 6 }}
        />
        <SkeletonPlaceholder width="60%" height={14} />
      </View>
    </View>
  );
};

export default SpecialOfferCardSkeleton;
