// components/booking/invite-friends.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import {
  Users,
  Search,
  UserPlus,
  X,
  Check,
  MessageCircle,
  Send,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { InputValidator } from "@/lib/security";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

interface Friend {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface InviteFriendsProps {
  bookingId?: string;
  restaurantName: string;
  bookingTime: string;
  partySize: number;
  onInvitesSent?: (invitedFriends: string[]) => void;
  existingInvites?: string[];
}

interface FriendsInvitationSectionProps {
  invitedFriends: string[];
  restaurantName: string;
  bookingTime: string;
  partySize: number;
  onInvitesSent: (friendIds: string[]) => void;
}

export function InviteFriends({
  bookingId,
  restaurantName,
  bookingTime,
  partySize,
  onInvitesSent,
  existingInvites = [],
}: InviteFriendsProps) {
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (modalVisible) {
      loadFriends();
    }
  }, [modalVisible]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = friends.filter((friend) =>
        friend.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredFriends(filtered);
    } else {
      setFilteredFriends(friends);
    }
  }, [searchQuery, friends]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("friends")
        .select(
          `
          *,
          friend:friend_id(id, full_name, avatar_url)
        `,
        )
        .eq("user_id", profile?.id);

      if (!error && data) {
        const friendsList = data
          .map((item) => item.friend)
          .filter((friend) => !existingInvites.includes(friend.id));
        setFriends(friendsList);
        setFilteredFriends(friendsList);
      }
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        // Check party size limit
        if (newSet.size + existingInvites.length + 1 >= partySize) {
          Alert.alert(
            "Party Size Limit",
            `You can only invite up to ${partySize - 1 - existingInvites.length} more friends for this booking.`,
          );
          return prev;
        }
        newSet.add(friendId);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const sendInvites = async () => {
    if (selectedFriends.size === 0) {
      Alert.alert(
        "No Friends Selected",
        "Please select at least one friend to invite.",
      );
      return;
    }

    // Validate invite message for profanity if provided
    if (inviteMessage && inviteMessage.trim()) {
      const validation = InputValidator.validateContent(inviteMessage.trim());

      if (!validation.valid) {
        Alert.alert("Content Issue", validation.errors.join("\n"));
        return;
      }
    }

    setSending(true);
    try {
      if (bookingId) {
        // Send invites for existing booking
        const invites = Array.from(selectedFriends).map((friendId) => ({
          booking_id: bookingId,
          from_user_id: profile?.id,
          to_user_id: friendId,
          message: inviteMessage || `Join me at ${restaurantName}!`,
        }));

        const { error } = await supabase
          .from("booking_invites")
          .insert(invites);

        if (error) throw error;

        // Update booking as group booking
        await supabase
          .from("bookings")
          .update({
            is_group_booking: true,
            organizer_id: profile?.id,
          })
          .eq("id", bookingId);
      } else {
        // For new bookings, just return selected friends
        onInvitesSent?.(Array.from(selectedFriends));
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Invites Sent!",
        `Successfully invited ${selectedFriends.size} friend${selectedFriends.size > 1 ? "s" : ""}.`,
      );

      setModalVisible(false);
      setSelectedFriends(new Set());
      setInviteMessage("");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send invites");
    } finally {
      setSending(false);
    }
  };

  const renderFriend = (friend: Friend) => {
    const isSelected = selectedFriends.has(friend.id);

    return (
      <Pressable
        key={friend.id}
        onPress={() => toggleFriendSelection(friend.id)}
        className={`flex-row items-center p-3 mb-2 rounded-xl ${
          isSelected
            ? "bg-red-50 dark:bg-red-900/20 border-2 border-red-500"
            : "bg-gray-50 dark:bg-gray-800 border-2 border-transparent"
        }`}
      >
        <Image
          {...({
            source: {
              uri:
                friend.avatar_url ||
                `https://ui-avatars.com/api/?name=${friend.full_name}`,
            },
            optimizationPreset: "thumbnail",
            className: "w-12 h-12 rounded-full bg-gray-200",
          } as any)}
        />

        <Text className="flex-1 ml-3 font-medium">{friend.full_name}</Text>

        <View
          className={`w-6 h-6 rounded-full items-center justify-center ${
            isSelected ? "bg-red-600" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          {isSelected && <Check size={16} color="white" />}
        </View>
      </Pressable>
    );
  };

  const handleInviteFriends = () => {
    // Navigate to friends selection screen
    router.push({
      pathname: "/friends",
      params: {
        mode: "invite",
        restaurantName,
        bookingTime,
        partySize: partySize.toString(),
        currentInvites: JSON.stringify(Array.from(selectedFriends)),
      },
    });
  };

  const totalGuests = partySize + selectedFriends.size + existingInvites.length;

  return (
    <>
      {/* Invite Button */}
      <Pressable
        onPress={() => setModalVisible(true)}
        className="flex-row items-center justify-center py-3 px-4 bg-red-600 rounded-xl"
      >
        <UserPlus size={20} color="white" />
        <Text className="ml-2 text-white font-semibold">Invite Friends</Text>
        {existingInvites.length > 0 && (
          <View className="ml-2 bg-white/20 rounded-full px-2 py-0.5">
            <Text className="text-white text-xs font-semibold">
              {existingInvites.length}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Invite Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-white dark:bg-gray-900">
          {/* Header */}
          <View className="px-4 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setSelectedFriends(new Set());
                  setInviteMessage("");
                }}
                className="p-2"
              >
                <X
                  size={24}
                  color={colorScheme === "dark" ? "white" : "black"}
                />
              </Pressable>

              <H3>Invite Friends</H3>

              <View className="w-10" />
            </View>

            {/* Booking Info */}
            <View className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <Text className="font-semibold text-base">{restaurantName}</Text>
              <Muted className="text-sm mt-1">
                {new Date(bookingTime).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Muted>
              <View className="flex-row items-center mt-2">
                <Users size={16} color="#6b7280" />
                <Muted className="ml-1 text-sm">
                  {selectedFriends.size + existingInvites.length + 1} /{" "}
                  {partySize} guests
                </Muted>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2">
              <Search size={20} color="#6b7280" />
              <TextInput
                placeholder="Search friends..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>

          {/* Friends List */}
          <ScrollView className="flex-1 px-4 py-4">
            {loading ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" />
              </View>
            ) : filteredFriends.length === 0 ? (
              <View className="items-center justify-center py-8">
                <Users size={48} color="#9ca3af" />
                <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                  {friends.length === 0
                    ? "No friends to invite yet"
                    : "No friends found matching your search"}
                </Text>
              </View>
            ) : (
              filteredFriends.map(renderFriend)
            )}
          </ScrollView>

          {/* Message Input */}
          {selectedFriends.size > 0 && (
            <View className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2 mb-3">
                <MessageCircle size={20} color="#6b7280" />
                <TextInput
                  placeholder="Add a message (optional)..."
                  value={inviteMessage}
                  onChangeText={setInviteMessage}
                  className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
                  placeholderTextColor="#6b7280"
                  multiline
                />
              </View>

              <Button
                onPress={sendInvites}
                disabled={sending}
                className="w-full"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center justify-center gap-2">
                    <Send size={20} color="white" />
                    <Text className="text-white font-semibold">
                      Send {selectedFriends.size} Invite
                      {selectedFriends.size > 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
              </Button>
            </View>
          )}

          {/* Friends Invitation Section */}
          <View className="mb-6">
            <View className="mb-3">
              <Text
                className={`text-lg font-semibold ${colorScheme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                Invite Friends
              </Text>
              <Text
                className={`text-sm ${colorScheme === "dark" ? "text-gray-400" : "text-gray-600"}`}
              >
                Make it a group experience! (Optional)
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleInviteFriends}
              className={`p-4 rounded-xl border-2 border-dashed flex-row items-center justify-center ${
                colorScheme === "dark"
                  ? "border-gray-600 bg-gray-800/50"
                  : "border-gray-300 bg-gray-50"
              }`}
            >
              <Ionicons
                name="person-add-outline"
                size={24}
                color={colorScheme === "dark" ? "#9CA3AF" : "#6B7280"}
              />
              <Text
                className={`ml-2 font-medium ${colorScheme === "dark" ? "text-gray-300" : "text-gray-700"}`}
              >
                {selectedFriends.size > 0
                  ? "Manage Invitations"
                  : "Invite Friends"}
              </Text>
            </TouchableOpacity>

            {selectedFriends.size > 0 && (
              <View className="mt-3">
                <Text
                  className={`text-sm font-medium ${colorScheme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                >
                  {selectedFriends.size} friend
                  {selectedFriends.size > 1 ? "s" : ""} invited
                </Text>
                <Text
                  className={`text-sm ${colorScheme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                >
                  Total party size: {totalGuests} people
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

export const FriendsInvitationSection: React.FC<
  FriendsInvitationSectionProps
> = ({
  invitedFriends = [],
  restaurantName = "",
  bookingTime = "",
  partySize = 2,
  onInvitesSent,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Early return if required props are missing
  if (!restaurantName || !onInvitesSent) {
    console.warn("FriendsInvitationSection: Missing required props");
    return null;
  }

  const handleInviteFriends = () => {
    try {
      // Navigate to friends selection screen
      router.push({
        pathname: "/(protected)/friends",
        params: {
          mode: "invite",
          restaurantName,
          bookingTime,
          partySize: partySize.toString(),
          currentInvites: JSON.stringify(invitedFriends),
        },
      });
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert(
        "Error",
        "Unable to open friends selection. Please try again.",
      );
    }
  };

  const totalGuests = partySize + invitedFriends.length;

  return (
    <View className="mb-6">
      <View className="mb-3">
        <Text
          className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
        >
          Invite Friends
        </Text>
        <Text
          className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
        >
          Make it a group experience! (Optional)
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleInviteFriends}
        className={`p-4 rounded-xl border-2 border-dashed flex-row items-center justify-center ${
          isDark
            ? "border-gray-600 bg-gray-800/50"
            : "border-gray-300 bg-gray-50"
        }`}
      >
        <Ionicons
          name="person-add-outline"
          size={24}
          color={isDark ? "#9CA3AF" : "#6B7280"}
        />
        <Text
          className={`ml-2 font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}
        >
          {invitedFriends.length > 0 ? "Manage Invitations" : "Invite Friends"}
        </Text>
      </TouchableOpacity>

      {invitedFriends.length > 0 && (
        <View className="mt-3">
          <Text
            className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}
          >
            {invitedFriends.length} friend{invitedFriends.length > 1 ? "s" : ""}{" "}
            invited
          </Text>
          <Text
            className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            Total party size: {totalGuests} people
          </Text>
        </View>
      )}
    </View>
  );
};
