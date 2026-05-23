import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const FavoritesGridCardSkeleton = () => {
  return (
    <View style={{ flex: 1, margin: 8 }}>
      <View>
        <SkeletonPlaceholder
          width="100%"
          height={120}
          style={{ borderRadius: 8, marginBottom: 8 }}
        />
        <SkeletonPlaceholder
          width="90%"
          height={18}
          style={{ marginBottom: 4 }}
        />
        <SkeletonPlaceholder width="70%" height={14} />
      </View>
    </View>
  );
};

export default FavoritesGridCardSkeleton;
