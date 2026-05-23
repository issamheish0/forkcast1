import React from "react";
import { View } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const SignInScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-1 gap-4">
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder
            width="60%"
            height={30}
            style={{ marginBottom: 24 }}
          />
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
            style={{ marginBottom: 24 }}
          />
        </View>
      </View>
      <SkeletonPlaceholder width="100%" height={50} borderRadius={8} />
    </SafeAreaView>
  );
};

export default SignInScreenSkeleton;
