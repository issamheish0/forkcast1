import React from "react";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { View } from "react-native";

const ProfileHeaderSkeleton = () => {
  return (
    <View
      style={{
        padding: 24,
        alignItems: "center",
        backgroundColor: "transparent",
      }}
    >
      <View style={{ alignItems: "center" }}>
        <SkeletonPlaceholder
          width={100}
          height={100}
          borderRadius={50}
          style={{ marginBottom: 16 }}
        />
        <SkeletonPlaceholder
          width={150}
          height={24}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder
          width={120}
          height={18}
          style={{ marginBottom: 24 }}
        />
        <SkeletonPlaceholder width="100%" height={60} />
      </View>
    </View>
  );
};

export default ProfileHeaderSkeleton;
