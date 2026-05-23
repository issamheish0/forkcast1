import React, { useState } from "react";
import { View, Pressable, Modal, ActivityIndicator } from "react-native";
import { Users, Check, X, Calendar, MapPin, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import {
  useBookingInvitations,
  BookingInvitation,
} from "@/hooks/useBookingInvitations";
import { formatDateShort } from "@/utils/birthday";

interface InvitationNotificationProps {
  visible: boolean;
  invitation: BookingInvitation | null;
  onClose: () => void;
  onResponse?: () => void;
}

export const InvitationNotification = React.memo<InvitationNotificationProps>(
  ({ visible, invitation, onClose, onResponse }) => {
    const { acceptInvitation, declineInvitation } = useBookingInvitations();
    const [responding, setResponding] = useState(false);

    if (!invitation) return null;

    const booking = invitation.booking;
    const restaurant = booking?.restaurant;
    const fromUser = invitation.from_user;

    const formatBookingTime = (timeStr: string) => {
      const date = new Date(timeStr);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const isToday = date.toDateString() === today.toDateString();
      const isTomorrow = date.toDateString() === tomorrow.toDateString();

      const timeString = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      if (isToday) return `Today at ${timeString}`;
      if (isTomorrow) return `Tomorrow at ${timeString}`;

      return `${formatDateShort(date)} at ${timeString}`;
    };

    const handleResponse = async (action: "accept" | "decline") => {
      if (responding) return;

      setResponding(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const success =
          action === "accept"
            ? await acceptInvitation(invitation.id)
            : await declineInvitation(invitation.id);

        if (success) {
          onResponse?.();
          onClose();
        }
      } finally {
        setResponding(false);
      }
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
          className="flex-1 bg-black/60 justify-center items-center px-4"
          onPress={onClose}
        >
          <Pressable
            className="bg-background rounded-2xl w-full max-w-sm shadow-xl border border-border"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="p-6 border-b border-border">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center">
                  <Users size={24} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg">Booking Invitation</Text>
                  <Text className="text-sm text-muted-foreground">
                    You've been invited to join a dinner
                  </Text>
                </View>
              </View>

              {/* From User */}
              <View className="flex-row gap-2">
                <Image
                  source={{
                    uri:
                      fromUser?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${
                        fromUser?.first_name && fromUser?.last_name
                          ? `${fromUser.first_name} ${fromUser.last_name}`
                          : fromUser?.full_name || "User"
                      }`,
                  }}
                  className="w-10 h-10 rounded-full bg-gray-100"
                  optimizationPreset="thumbnail"
                />
                <Text className="font-semibold">
                  {fromUser?.first_name && fromUser?.last_name
                    ? `${fromUser.first_name} ${fromUser.last_name}`
                    : fromUser?.full_name || "Someone"}{" "}
                  invited you
                </Text>
              </View>
            </View>

            {/* Booking Details */}
            <View className="p-6">
              {/* Restaurant */}
              <View className="flex-row gap-3 mb-4 p-3 bg-muted/20 rounded-xl">
                <Image
                  source={{ uri: restaurant?.main_image_url }}
                  className="w-16 h-16 rounded-lg bg-gray-100"
                  contentFit="cover"
                  placeholder="Restaurant"
                  optimizationPreset="thumbnail"
                />
                <View className="flex-1 justify-center">
                  <Text className="font-bold text-lg mb-1">
                    {restaurant?.name || "Restaurant"}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <MapPin size={12} color="#666" />
                    <Text
                      className="text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      {restaurant?.address || "Address"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Booking Info */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Calendar size={16} color="#3b82f6" />
                  <Text className="font-medium">
                    {booking
                      ? formatBookingTime(booking.booking_time)
                      : "Time TBD"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Users size={16} color="#3b82f6" />
                  <Text className="font-medium">
                    Party of {booking?.party_size || "?"}
                  </Text>
                </View>
              </View>

              {/* Message */}
              {invitation.message && (
                <View className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Text className="text-sm text-blue-800 dark:text-blue-200">
                    "{invitation.message}"
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View className="p-6 border-t border-border">
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => handleResponse("decline")}
                  disabled={responding}
                  className="flex-1"
                >
                  {responding ? (
                    <ActivityIndicator size="small" color="currentColor" />
                  ) : (
                    <View className="flex-row items-center justify-center gap-2">
                      <X size={16} color="currentColor" />
                      <Text className="font-medium">Decline</Text>
                    </View>
                  )}
                </Button>

                <Button
                  onPress={() => handleResponse("accept")}
                  disabled={responding}
                  className="flex-1"
                >
                  {responding ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <View className="flex-row items-center justify-center gap-2">
                      <Check size={16} color="white" />
                      <Text className="text-white font-medium">Accept</Text>
                    </View>
                  )}
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
