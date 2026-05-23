import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { UserPlus, Search, X, Users, UserCheck } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface Friend {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface InviteFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (friendIds: string[], friendDetails: Friend[]) => void;
  restaurantName?: string;
  bookingTime?: string;
  currentlyInvited?: string[];
  partySize?: number;
}

export const InviteFriendsModal = React.memo(
  ({
    visible,
    onClose,
    onInvite,
    restaurantName = "",
    bookingTime = "",
    currentlyInvited = [],
    partySize = 2,
  }: InviteFriendsModalProps) => {
    const { profile } = useAuth();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // Load friends when modal opens
    useEffect(() => {
      if (visible) {
        loadFriends();
        setSelectedFriends(currentlyInvited);
        setSearchQuery("");
      }
    }, [visible, currentlyInvited]);

    // Filter friends based on search query
    useEffect(() => {
      if (searchQuery.trim() === "") {
        setFilteredFriends(friends);
      } else {
        const loweredQuery = searchQuery.toLowerCase();
        setFilteredFriends(
          friends.filter((friend) =>
            friend.full_name.toLowerCase().includes(loweredQuery),
          ),
        );
      }
    }, [friends, searchQuery]);

    const loadFriends = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("friends")
          .select(
            `
          *,
          friend:friend_id(id, full_name, avatar_url)
        `,
          )
          .eq("user_id", profile?.id)
          .order("friendship_date", { ascending: false });

        if (!error && data) {
          const formattedFriends = data.map((item) => ({
            id: item.friend.id,
            full_name: item.friend.full_name,
            avatar_url: item.friend.avatar_url,
          }));
          setFriends(formattedFriends);
        }
      } catch (error) {
        console.error("Error loading friends:", error);
      } finally {
        setLoading(false);
      }
    };

    const toggleFriendSelection = useCallback(
      (friendId: string) => {
        setSelectedFriends((prev) => {
          const isSelected = prev.includes(friendId);
          if (isSelected) {
            return prev.filter((id) => id !== friendId);
          } else {
            // Check if adding this friend would exceed the party size
            if (prev.length >= partySize) {
              Alert.alert(
                "Party Size Limit",
                `You can only invite up to ${partySize} friends for a party of ${partySize}.`,
              );
              return prev;
            }
            return [...prev, friendId];
          }
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      [partySize],
    );

    const handleInvite = useCallback(() => {
      if (selectedFriends.length === 0) {
        Alert.alert(
          "No Friends Selected",
          "Please select at least one friend to invite.",
        );
        return;
      }

      // Get friend details for selected friends
      const selectedFriendDetails = friends.filter((friend) =>
        selectedFriends.includes(friend.id),
      );

      onInvite(selectedFriends, selectedFriendDetails);
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [selectedFriends, friends, onInvite, onClose]);

    const renderFriend = ({ item }: { item: Friend }) => {
      const isSelected = selectedFriends.includes(item.id);

      return (
        <Pressable
          onPress={() => toggleFriendSelection(item.id)}
          className={`flex-row items-center p-3 mx-4 my-1 rounded-xl border ${
            isSelected
              ? "bg-primary/10 border-primary/20"
              : "bg-transparent border-transparent hover:bg-muted"
          }`}
        >
          <Image
            {...({
              source: {
                uri:
                  item.avatar_url ||
                  `https://ui-avatars.com/api/?name=${item.full_name}`,
              },
              optimizationPreset: "thumbnail",
              className: "w-12 h-12 rounded-full bg-gray-100",
            } as any)}
          />
          <View className="ml-3 flex-1">
            <Text
              className={`font-medium ${
                isSelected ? "text-primary" : "text-foreground"
              }`}
            >
              {item.full_name}
            </Text>
          </View>
          {isSelected && (
            <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
              <UserCheck size={14} color="white" />
            </View>
          )}
        </Pressable>
      );
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent={false}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={onClose}
        >
          <Pressable
            className="bg-background rounded-2xl w-80 max-h-[70%] shadow-xl mx-4"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center gap-2">
                <UserPlus size={20} color="#dc2626" />
                <Text className="font-semibold text-lg">Invite Friends</Text>
              </View>
              <Pressable onPress={onClose} className="p-1">
                <X size={20} color="#666" />
              </Pressable>
            </View>

            {/* Restaurant info */}
            {restaurantName && (
              <View className="px-4 py-3 border-b border-border bg-muted/30">
                <Text className="text-sm text-muted-foreground">
                  Booking for
                </Text>
                <Text className="font-medium">{restaurantName}</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Party of {partySize} • You can invite up to {partySize}{" "}
                  friends
                </Text>
                {bookingTime && (
                  <Text className="text-sm text-muted-foreground mt-1">
                    {bookingTime}
                  </Text>
                )}
              </View>
            )}

            {/* Search Bar */}
            <View className="px-4 py-3 border-b border-border">
              <View className="flex-row items-center bg-input rounded-xl px-3 py-2">
                <Search size={16} color="#6b7280" />
                <TextInput
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            {/* Selected Count */}
            {selectedFriends.length > 0 && (
              <View className="px-4 py-2 bg-secondary/30">
                <Text className="text-sm text-primary font-medium">
                  {selectedFriends.length} friend
                  {selectedFriends.length !== 1 ? "s" : ""} selected
                </Text>
              </View>
            )}

            {/* Content */}
            <ScrollView className="max-h-64">
              {loading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="large" color="#dc2626" />
                  <Text className="text-muted-foreground mt-2">
                    Loading friends...
                  </Text>
                </View>
              ) : filteredFriends.length === 0 ? (
                <View className="py-8 items-center">
                  <Users size={32} color="#9ca3af" />
                  <Text className="text-muted-foreground mt-2 text-center px-4">
                    {searchQuery
                      ? `No friends found for "${searchQuery}"`
                      : "No friends to invite"}
                  </Text>
                </View>
              ) : (
                filteredFriends.map((friend) => (
                  <View key={friend.id}>{renderFriend({ item: friend })}</View>
                ))
              )}
            </ScrollView>

            {/* Footer */}
            <View className="p-4 border-t border-border">
              <View className="flex-row gap-2">
                <Button variant="outline" onPress={onClose} className="flex-1">
                  <Text>Cancel</Text>
                </Button>
                <Button
                  onPress={handleInvite}
                  disabled={selectedFriends.length === 0}
                  className="flex-1"
                >
                  <Text className="text-white">
                    Invite{" "}
                    {selectedFriends.length > 0
                      ? `(${selectedFriends.length})`
                      : ""}
                  </Text>
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
