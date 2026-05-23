import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const SectionSkeleton = ({ titleWidth = 150, items = 4, itemWidth = 100 }) => (
  <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
    <SkeletonPlaceholder
      width={titleWidth}
      height={24}
      borderRadius={4}
      style={{ marginBottom: 12 }}
    />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonPlaceholder
          key={index}
          width={itemWidth}
          height={36}
          borderRadius={18}
        />
      ))}
    </View>
  </View>
);

const PreferencesScreenSkeleton = () => {
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
          justifyContent: "space-between",
        }}
      >
        <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
        <SkeletonPlaceholder width={200} height={28} borderRadius={4} />
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        <SectionSkeleton titleWidth={200} items={6} itemWidth={120} />
        <SectionSkeleton titleWidth={180} items={5} itemWidth={90} />
        <SectionSkeleton titleWidth={160} items={8} itemWidth={110} />
        <SectionSkeleton titleWidth={220} items={7} itemWidth={100} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default PreferencesScreenSkeleton;
