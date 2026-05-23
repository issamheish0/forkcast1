import React, { useState, useEffect } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { FolderOpen, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface PlaylistInfo {
  id: string;
  name: string;
  emoji: string;
  isOwner: boolean;
}

interface RestaurantPlaylistIndicatorProps {
  restaurantId: string;
}

export const RestaurantPlaylistIndicator: any = ({ restaurantId }: any) => {
  const router = useRouter();
  const { profile } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaylists();
  }, [restaurantId, profile?.id]);

  const fetchPlaylists = async () => {
    if (!profile?.id) return;

    try {
      // Use a single RPC call or a more efficient query structure
      // First, get user's own playlists containing this restaurant
      const { data: ownPlaylists, error: ownError } = await supabase
        .from("playlist_items")
        .select(
          `
          playlist_id,
          restaurant_playlists!inner (
            id,
            name,
            emoji,
            user_id
          )
        `,
        )
        .eq("restaurant_id", restaurantId)
        .eq("restaurant_playlists.user_id", profile.id);

      if (ownError) throw ownError;

      // Then get playlists where user is a collaborator
      const { data: collabPlaylists, error: collabError } = await supabase
        .from("playlist_items")
        .select(
          `
          playlist_id,
          restaurant_playlists!inner (
            id,
            name,
            emoji,
            user_id
          )
        `,
        )
        .eq("restaurant_id", restaurantId)
        .neq("restaurant_playlists.user_id", profile.id)
        .in(
          "playlist_id",
          // Get playlist IDs where user is a collaborator
          await supabase
            .from("playlist_collaborators")
            .select("playlist_id")
            .eq("user_id", profile.id)
            .not("accepted_at", "is", null)
            .then((res) => res.data?.map((c) => c.playlist_id) || []),
        );

      if (collabError && collabError.code !== "PGRST116") throw collabError;

      // Combine and deduplicate
      const allPlaylistItems = [
        ...(ownPlaylists || []),
        ...(collabPlaylists || []),
      ];
      const uniquePlaylists = new Map<string, PlaylistInfo>();

      allPlaylistItems.forEach((item: any) => {
        const playlist = item.restaurant_playlists;
        if (playlist && !uniquePlaylists.has(playlist.id)) {
          uniquePlaylists.set(playlist.id, {
            id: playlist.id,
            name: playlist.name,
            emoji: playlist.emoji,
            isOwner: playlist.user_id === profile.id,
          });
        }
      });

      setPlaylists(Array.from(uniquePlaylists.values()));
    } catch (error) {
      console.error("Error fetching playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || playlists.length === 0) return null;

  return (
    <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 ml-3">
      <View className="flex-row items-center mb-3">
        <FolderOpen size={18} color="#6b7280" />
        <Muted className="ml-2 text-sm">In Your Playlists</Muted>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4 px-4"
      >
        <View className="flex-row gap-2">
          {playlists.map((playlist) => (
            <Pressable
              key={playlist.id}
              onPress={() => router.push(`/playlist/${playlist.id}`)}
              className="bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 flex-row items-center"
            >
              <Text className="text-base mr-2">{playlist.emoji}</Text>
              <Text className="text-sm font-medium mr-1">{playlist.name}</Text>
              <ChevronRight size={14} color="#6b7280" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
