import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const SettingItemSkeleton = () => (
  <View
    style={{
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <SkeletonPlaceholder width={40} height={40} borderRadius={20} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <SkeletonPlaceholder width="60%" height={20} borderRadius={4} />
        <SkeletonPlaceholder
          width="90%"
          height={14}
          borderRadius={4}
          style={{ marginTop: 8 }}
        />
        <SkeletonPlaceholder
          width={50}
          height={30}
          borderRadius={4}
          style={{ marginTop: 12 }}
        />
      </View>
    </View>
  </View>
);

const PrivacyScreenSkeleton = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#E0E0E0",
        }}
      >
        <SkeletonPlaceholder width={24} height={24} borderRadius={4} />
        <SkeletonPlaceholder width={180} height={28} borderRadius={4} />
        <View style={{ width: 40 }} />
      </View>

      {/* Privacy Settings Section */}
      <View style={{ paddingTop: 24 }}>
        <SkeletonPlaceholder
          width="40%"
          height={16}
          borderRadius={4}
          style={{ marginHorizontal: 16, marginBottom: 12 }}
        />
        <SettingItemSkeleton />
        <SettingItemSkeleton />
        <SettingItemSkeleton />
      </View>

      {/* Data Settings Section */}
      <View style={{ paddingTop: 24 }}>
        <SkeletonPlaceholder
          width="40%"
          height={16}
          borderRadius={4}
          style={{ marginHorizontal: 16, marginBottom: 12 }}
        />
        <SettingItemSkeleton />
        <SettingItemSkeleton />
      </View>

      {/* Account Settings Section */}
      <View style={{ paddingTop: 24 }}>
        <SkeletonPlaceholder
          width="40%"
          height={16}
          borderRadius={4}
          style={{ marginHorizontal: 16, marginBottom: 12 }}
        />
        <SettingItemSkeleton />
        <SettingItemSkeleton />
      </View>
    </SafeAreaView>
  );
};

export default PrivacyScreenSkeleton;
