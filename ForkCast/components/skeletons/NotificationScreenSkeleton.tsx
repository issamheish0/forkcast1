import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const NotificationItemSkeleton = () => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#E0E0E0",
    }}
  >
    <SkeletonPlaceholder width={40} height={40} borderRadius={20} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <SkeletonPlaceholder width="75%" height={16} borderRadius={4} />
      <SkeletonPlaceholder
        width="100%"
        height={12}
        borderRadius={4}
        style={{ marginTop: 8 }}
      />
      <SkeletonPlaceholder
        width="50%"
        height={12}
        borderRadius={4}
        style={{ marginTop: 4 }}
      />
    </View>
  </View>
);

export function NotificationsScreenSkeleton() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#F5F5F5" }}
      edges={["top"]}
    >
      {/* Header Skeleton */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <SkeletonPlaceholder
            width={40}
            height={40}
            borderRadius={20}
            style={{ marginRight: 12 }}
          />
          <SkeletonPlaceholder width={120} height={32} borderRadius={4} />
        </View>
      </View>

      {/* List Skeleton */}
      <View style={{ marginTop: 16 }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <NotificationItemSkeleton key={index} />
        ))}
      </View>
    </SafeAreaView>
  );
}
