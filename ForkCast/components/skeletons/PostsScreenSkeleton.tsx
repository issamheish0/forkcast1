import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const PostCardSkeleton = () => (
  <View
    style={{
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      backgroundColor: "#FFFFFF",
    }}
  >
    {/* User Info */}
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <SkeletonPlaceholder width={40} height={40} borderRadius={20} />
      <View style={{ marginLeft: 12 }}>
        <SkeletonPlaceholder width={120} height={16} borderRadius={4} />
        <SkeletonPlaceholder
          width={80}
          height={12}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>

    {/* Post Image */}
    <SkeletonPlaceholder
      width="100%"
      height={200}
      borderRadius={8}
      style={{ marginTop: 12 }}
    />

    {/* Post Content */}
    <SkeletonPlaceholder
      width="90%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 12 }}
    />
    <SkeletonPlaceholder
      width="70%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 6 }}
    />
  </View>
);

const PostsScreenSkeleton = () => {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#F5F5F5" }}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#E0E0E0",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <SkeletonPlaceholder width={120} height={24} borderRadius={4} />
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
};

export default PostsScreenSkeleton;
