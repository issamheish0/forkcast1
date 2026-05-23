// components/restaurant/RestaurantPosts.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Heart,
  MessageCircle,
  Share2,
  Camera,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { OptimizedList } from "../ui/optimized-list";

interface RestaurantPost {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  content: string;
  images: {
    id: string;
    image_url: string;
    image_order: number;
  }[];
  tagged_friends: {
    id: string;
    full_name: string;
  }[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_user?: boolean;
}

interface RestaurantPostsProps {
  restaurantId: string;
  restaurantName: string;
}

const PostCard: React.FC<{
  post: RestaurantPost;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
}> = ({ post, onLike, onComment }) => {
  const router = useRouter();
  const [imageIndex, setImageIndex] = useState(0);

  return (
    <View className="bg-card mb-4 rounded-xl overflow-hidden border border-border">
      {/* Header */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/social/profile/[userId]",
            params: { userId: post.user_id },
          })
        }
        className="flex-row items-center p-3"
      >
        <Image
          source={{ uri: post.user_avatar || "https://via.placeholder.com/40" }}
          className="w-10 h-10 rounded-full mr-3"
          contentFit="cover"
          optimizationPreset="thumbnail"
        />
        <View className="flex-1">
          <Text className="font-semibold">{post.user_name}</Text>
          <Muted className="text-xs">
            {format(new Date(post.created_at), "MMM d, yyyy")}
          </Muted>
        </View>
      </Pressable>

      {/* Images */}
      {post.images.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x /
                  e.nativeEvent.layoutMeasurement.width,
              );
              setImageIndex(index);
            }}
          >
            {post.images.map((image) => (
              <Image
                key={image.id}
                source={{ uri: image.image_url }}
                className="w-screen h-60"
                contentFit="cover"
                optimizationPreset="large"
              />
            ))}
          </ScrollView>
          {post.images.length > 1 && (
            <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded">
              <Text className="text-white text-xs">
                {imageIndex + 1}/{post.images.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      {post.content && (
        <View className="px-3 py-2">
          <P className="text-sm">{post.content}</P>
        </View>
      )}

      {/* Tagged Friends */}
      {post.tagged_friends.length > 0 && (
        <View className="px-3 pb-2">
          <View className="flex-row items-center flex-wrap">
            <Users size={14} color="#666" />
            <Muted className="text-xs ml-1">with </Muted>
            {post.tagged_friends.map((friend, index) => (
              <React.Fragment key={friend.id}>
                <Text className="text-xs text-primary">{friend.full_name}</Text>
                {index < post.tagged_friends.length - 1 && (
                  <Muted className="text-xs">, </Muted>
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row items-center justify-around p-3 border-t border-border">
        <Pressable
          onPress={() => onLike(post.id)}
          className="flex-row items-center"
        >
          <Heart
            size={20}
            color={post.liked_by_user ? "#ef4444" : "#666"}
            fill={post.liked_by_user ? "#ef4444" : "none"}
          />
          {post.likes_count > 0 && (
            <Text className="ml-1.5 text-sm">{post.likes_count}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => onComment(post.id)}
          className="flex-row items-center"
        >
          <MessageCircle size={20} color="#666" />
          {post.comments_count > 0 && (
            <Text className="ml-1.5 text-sm">{post.comments_count}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

export function RestaurantPosts({
  restaurantId,
  restaurantName,
}: RestaurantPostsProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  const [posts, setPosts] = useState<RestaurantPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!restaurantId) return;

    try {
      // Fetch posts for this restaurant
      const { data: postsData, error: postsError } = await supabase
        .from("posts_with_details")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (postsError) throw postsError;

      // Check which posts the user has liked
      if (profile?.id) {
        const postIds = postsData?.map((p) => p.id) || [];
        const { data: userLikes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", profile.id)
          .in("post_id", postIds);

        const likedPostIds = new Set(userLikes?.map((l) => l.post_id) || []);

        // Format posts with liked status
        const formattedPosts =
          postsData?.map((post) => ({
            ...post,
            liked_by_user: likedPostIds.has(post.id),
          })) || [];

        setPosts(formattedPosts);
      } else {
        setPosts(postsData || []);
      }
    } catch (error) {
      console.error("Error fetching restaurant posts:", error);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, profile?.id]);

  const handleLike = async (postId: string) => {
    if (!profile?.id) {
      Alert.alert("Sign in required", "Please sign in to like posts");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.liked_by_user) {
        // Unlike
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", profile.id);

        setPosts(
          posts.map((p) =>
            p.id === postId
              ? { ...p, liked_by_user: false, likes_count: p.likes_count - 1 }
              : p,
          ),
        );
      } else {
        // Like
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: profile.id });

        setPosts(
          posts.map((p) =>
            p.id === postId
              ? { ...p, liked_by_user: true, likes_count: p.likes_count + 1 }
              : p,
          ),
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleComment = (postId: string) => {
    if (!profile?.id) {
      Alert.alert("Sign in required", "Please sign in to comment");
      return;
    }
    router.push(`/social/post/${postId}`);
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (loading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="bg-background">
      <View className="px-4 py-4">
        <H3>Guest Photos & Reviews</H3>
        <Muted className="mt-1">
          See what others are saying about {restaurantName}
        </Muted>
      </View>

      {posts.length === 0 ? (
        <View className="items-center py-12 px-8 mb-40">
          <Camera size={48} color="#666" />
          <Text className="mt-4 text-center">
            No posts yet. Be the first to share your experience!
          </Text>
        </View>
      ) : (
        <View className="mb-40">
          <OptimizedList
            data={posts}
            renderItem={({ item }) => (
              <View className="px-4">
                <PostCard
                  post={item}
                  onLike={handleLike}
                  onComment={handleComment}
                />
              </View>
            )}
            keyExtractor={(item) => item.id}
            listProps={{ scrollEnabled: false }}
          />
        </View>
      )}
    </View>
  );
}
