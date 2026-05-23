import React from "react";
import { View, ScrollView } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const SignUpScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder
            width="70%"
            height={30}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder width="90%" height={18} />
        </View>
        <View style={{ width: "100%" }}>
          <SkeletonPlaceholder
            width="100%"
            height={50}
            borderRadius={8}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            borderRadius={8}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            borderRadius={8}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            borderRadius={8}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            borderRadius={8}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={20}
            style={{ marginBottom: 24 }}
          />
        </View>
      </ScrollView>
      <SkeletonPlaceholder width="100%" height={50} borderRadius={8} />
    </SafeAreaView>
  );
};

export default SignUpScreenSkeleton;
