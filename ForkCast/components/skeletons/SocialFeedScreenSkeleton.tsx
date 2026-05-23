import React from "react";
import { View, ScrollView } from "react-native";
import PostCardSkeleton from "./PostCardSkeleton";
import { SafeAreaView } from "../safe-area-view";
import { PageHeader } from "../ui/page-header";

const SocialFeedScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <PageHeader title="Social Feed" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SocialFeedScreenSkeleton;
