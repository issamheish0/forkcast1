import React from "react";
import { View, ScrollView } from "react-native";
import ProfileHeaderSkeleton from "./ProfileHeaderSkeleton";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const ProfileScreenSkeleton = () => {
  const MenuItemSkeleton = () => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", width: "100%" }}
      >
        <SkeletonPlaceholder
          width={40}
          height={40}
          borderRadius={20}
          style={{ marginRight: 16 }}
        />
        <View>
          <SkeletonPlaceholder
            width="60%"
            height={18}
            style={{ marginBottom: 6 }}
          />
          <SkeletonPlaceholder width="80%" height={14} />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeaderSkeleton />
        <View style={{ marginTop: 24 }}>
          {[...Array(3)].map((_, sectionIndex) => (
            <View key={sectionIndex} style={{ marginBottom: 24 }}>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <SkeletonPlaceholder width={120} height={20} />
              </View>
              <View style={{ backgroundColor: "transparent" }}>
                {[...Array(3)].map((_, itemIndex) => (
                  <MenuItemSkeleton key={itemIndex} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreenSkeleton;
