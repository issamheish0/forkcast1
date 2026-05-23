import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const CuisineCategorySkeleton = () => {
  return (
    <View style={{ marginRight: 12 }}>
      <View style={{ width: 80, alignItems: "center" }}>
        <SkeletonPlaceholder
          width={60}
          height={60}
          borderRadius={30}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder width={70} height={16} />
      </View>
    </View>
  );
};

export default CuisineCategorySkeleton;
