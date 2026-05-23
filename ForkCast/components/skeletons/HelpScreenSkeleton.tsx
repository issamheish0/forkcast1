import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const FAQItemSkeleton = () => (
  <View
    style={{
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      backgroundColor: "#FFFFFF",
    }}
  >
    <SkeletonPlaceholder width="80%" height={20} borderRadius={4} />
    <SkeletonPlaceholder
      width="50%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 8 }}
    />
  </View>
);

const HelpScreenSkeleton = () => {
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

        {/* Search Bar */}
        <SkeletonPlaceholder
          width="100%"
          height={40}
          borderRadius={8}
          style={{ marginBottom: 16 }}
        />

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <FAQItemSkeleton />
        <FAQItemSkeleton />
        <FAQItemSkeleton />
        <FAQItemSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpScreenSkeleton;
