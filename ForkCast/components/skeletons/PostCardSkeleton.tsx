import React from "react";
import { View } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const PostCardSkeleton = () => {
  return (
    <View className="bg-card mb-2 border-b border-border">
      {/* Header */}
      <View className="flex-row items-center p-4">
        <SkeletonPlaceholder
          width={40}
          height={40}
          style={{ borderRadius: 20 }}
        />
        <View className="flex-1 ml-3">
          <SkeletonPlaceholder
            width="50%"
            height={20}
            style={{ borderRadius: 4 }}
          />
          <SkeletonPlaceholder
            width="30%"
            height={14}
            style={{ marginTop: 6, borderRadius: 4 }}
          />
        </View>
      </View>

      {/* Image */}
      <SkeletonPlaceholder width="100%" height={300} />

      {/* Content */}
      <View className="p-4">
        <SkeletonPlaceholder
          width="90%"
          height={20}
          style={{ borderRadius: 4, marginBottom: 8 }}
        />
        <SkeletonPlaceholder
          width="70%"
          height={20}
          style={{ borderRadius: 4 }}
        />
      </View>

      {/* Actions */}
      <View className="flex-row items-center justify-between px-4 py-3 border-t border-border">
        <View className="flex-row items-center gap-6">
          <SkeletonPlaceholder
            width={50}
            height={24}
            style={{ borderRadius: 4 }}
          />
          <SkeletonPlaceholder
            width={50}
            height={24}
            style={{ borderRadius: 4 }}
          />
          <SkeletonPlaceholder
            width={24}
            height={24}
            style={{ borderRadius: 4 }}
          />
        </View>
      </View>
    </View>
  );
};

export default PostCardSkeleton;
