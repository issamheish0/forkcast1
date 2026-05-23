import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const RewardCardSkeleton = () => (
  <View
    style={{
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      backgroundColor: "#FFFFFF",
    }}
  >
    {/* Header */}
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <SkeletonPlaceholder width={120} height={20} borderRadius={4} />
      <SkeletonPlaceholder width={80} height={20} borderRadius={4} />
    </View>

    {/* Description */}
    <SkeletonPlaceholder
      width="80%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 12 }}
    />
    <SkeletonPlaceholder
      width="60%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 8 }}
    />

    {/* Action Buttons */}
    <View style={{ flexDirection: "row", marginTop: 16 }}>
      <SkeletonPlaceholder
        width={100}
        height={40}
        borderRadius={8}
        style={{ flex: 1 }}
      />
      <SkeletonPlaceholder
        width={40}
        height={40}
        borderRadius={8}
        style={{ marginLeft: 12 }}
      />
    </View>
  </View>
);

const MyRewardsScreenSkeleton = () => {
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
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
          <SkeletonPlaceholder
            width={150}
            height={24}
            borderRadius={4}
            style={{ marginLeft: 12 }}
          />
        </View>

        {/* Tab Bar */}
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <RewardCardSkeleton />
        <RewardCardSkeleton />
        <RewardCardSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
};

export default MyRewardsScreenSkeleton;
