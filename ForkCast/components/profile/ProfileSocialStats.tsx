// components/profile/ProfileSocialStats.tsx
import React, { useState, useEffect } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Users, Camera, Heart, MessageCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface SocialStats {
  totalPosts: number;
  totalFriends: number;
  totalLikes: number;
  totalComments: number;
}

export function ProfileSocialStats() {
  const router = useRouter();
  const { profile } = useAuth();
  const [stats, setStats] = useState<SocialStats>({
    totalPosts: 0,
    totalFriends: 0,
    totalLikes: 0,
    totalComments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchSocialStats();
    }
  }, [profile?.id]);

  const fetchSocialStats = async () => {
    if (!profile?.id) return;

    try {
      // Fetch total posts
      const { count: postsCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);

      // Fetch total friends
      const { count: friendsCount } = await supabase
        .from("friends")
        .select("*", { count: "exact", head: true })
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

      // Fetch total likes received
      const { data: userPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", profile.id);

      const postIds = userPosts?.map((p) => p.id) || [];
      const { count: likesCount } = await supabase
        .from("post_likes")
        .select("*", { count: "exact", head: true })
        .in("post_id", postIds);

      // Fetch total comments received
      const { count: commentsCount } = await supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .in("post_id", postIds);

      setStats({
        totalPosts: postsCount || 0,
        totalFriends: friendsCount || 0,
        totalLikes: likesCount || 0,
        totalComments: commentsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching social stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatPress = (stat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (stat) {
      case "posts":
        router.push("/profile/posts");
        break;
      case "friends":
        router.push("/friends");
        break;
      case "likes":
      case "comments":
        router.push("/profile/posts");
        break;
    }
  };

  if (loading) {
    return (
      <View className="bg-card rounded-xl p-4 mb-4">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <View className="bg-card rounded-xl p-4 mb-4">
      <H3 className="mb-4">Social Activity</H3>

      <View className="flex-row justify-around">
        <Pressable
          onPress={() => handleStatPress("posts")}
          className="items-center"
        >
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-2">
            <Camera size={24} color="#666" />
          </View>
          <Text className="font-semibold text-lg">{stats.totalPosts}</Text>
          <Muted className="text-xs">Posts</Muted>
        </Pressable>

        <Pressable
          onPress={() => handleStatPress("friends")}
          className="items-center"
        >
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-2">
            <Users size={24} color="#666" />
          </View>
          <Text className="font-semibold text-lg">{stats.totalFriends}</Text>
          <Muted className="text-xs">Friends</Muted>
        </Pressable>

        <Pressable
          onPress={() => handleStatPress("likes")}
          className="items-center"
        >
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-2">
            <Heart size={24} color="#666" />
          </View>
          <Text className="font-semibold text-lg">{stats.totalLikes}</Text>
          <Muted className="text-xs">Likes</Muted>
        </Pressable>

        <Pressable
          onPress={() => handleStatPress("comments")}
          className="items-center"
        >
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-2">
            <MessageCircle size={24} color="#666" />
          </View>
          <Text className="font-semibold text-lg">{stats.totalComments}</Text>
          <Muted className="text-xs">Comments</Muted>
        </Pressable>
      </View>
    </View>
  );
}
