import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  X,
  Check,
  Users,
  Calendar,
  Clock,
  UserPlus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import type { BookingInvitation } from "@/hooks/useBookingInvitations";
import { formatTimeFromDate } from "@/utils/timeFormat";

interface PendingInvitationPopupProps {
  invitations: BookingInvitation[];
  visible: boolean;
  onClose: () => void;
  onAccept: (invitationId: string) => Promise<boolean>;
  onDecline: (invitationId: string) => Promise<boolean>;
  onViewAll: () => void;
}

export function PendingInvitationPopup({
  invitations,
  visible,
  onClose,
  onAccept,
  onDecline,
  onViewAll,
}: PendingInvitationPopupProps) {
  const { colorScheme } = useColorScheme();
  const [processingInvitation, setProcessingInvitation] = useState<
    string | null
  >(null);

  if (!visible || invitations.length === 0) return null;

  const handleAccept = async (invitationId: string) => {
    if (processingInvitation) return;

    setProcessingInvitation(invitationId);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const success = await onAccept(invitationId);
      if (success) {
        // Close popup after successful accept
        setTimeout(onClose, 1000);
      }
    } finally {
      setProcessingInvitation(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    if (processingInvitation) return;

    setProcessingInvitation(invitationId);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onDecline(invitationId);
    } finally {
      setProcessingInvitation(null);
    }
  };

  const formatBookingTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeString = formatTimeFromDate(date);

    if (isToday) return `Today at ${timeString}`;
    if (isTomorrow) return `Tomorrow at ${timeString}`;

    return (
      date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) + ` at ${timeString}`
    );
  };

  const primaryInvitation = invitations[0];
  const remainingCount = invitations.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-background rounded-2xl shadow-2xl w-full max-w-sm border border-border">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <UserPlus size={20} color="#3b82f6" />
              <H3 className="text-base">
                {invitations.length === 1
                  ? "New Invitation"
                  : "New Invitations"}
              </H3>
            </View>
            <Pressable
              onPress={onClose}
              className="p-1 rounded-full bg-muted/50"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={colorScheme === "dark" ? "white" : "black"} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView className="max-h-96">
            <View className="p-4">
              {/* Primary Invitation */}
              <View className="mb-4">
                {/* Inviter Info */}
                <View className="flex-row items-center gap-3 mb-3">
                  {/* Inviter avatar - request a small thumbnail variant and cast to any for the extended prop */}
                  <Image
                    {...({
                      source: {
                        uri:
                          primaryInvitation.from_user?.avatar_url ||
                          `https://ui-avatars.com/api/?name=${primaryInvitation.from_user?.full_name || "User"}`,
                      },
                      optimizationPreset: "thumbnail",
                      className: "w-10 h-10 rounded-full bg-gray-100",
                    } as any)}
                  />
                  <View className="flex-1">
                    <Text className="font-semibold">
                      {primaryInvitation.from_user?.full_name || "Someone"}{" "}
                      invited you
                    </Text>
                    <Muted className="text-xs">
                      {formatDateToDDMMYYYY(
                        new Date(primaryInvitation.created_at),
                      )}
                    </Muted>
                  </View>
                </View>

                {/* Restaurant Info */}
                <View className="flex-row gap-3 mb-3 p-3 bg-muted/30 rounded-lg">
                  {/* Restaurant image - medium preset for small card image */}
                  <Image
                    {...({
                      source: {
                        uri:
                          primaryInvitation.booking?.restaurant
                            ?.main_image_url ||
                          "https://via.placeholder.com/150",
                      },
                      optimizationPreset: "medium",
                      className: "w-12 h-12 rounded-lg bg-gray-100",
                      contentFit: "cover",
                    } as any)}
                  />
                  <View className="flex-1">
                    <Text className="font-semibold">
                      {primaryInvitation.booking?.restaurant?.name ||
                        "Restaurant"}
                    </Text>
                    <Text
                      className="text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      {primaryInvitation.booking?.restaurant?.address ||
                        "Address"}
                    </Text>
                  </View>
                </View>

                {/* Booking Details */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Calendar size={16} color="#3b82f6" />
                    <Text className="text-sm font-medium">
                      {primaryInvitation.booking
                        ? formatBookingTime(
                            primaryInvitation.booking.booking_time,
                          )
                        : "Time TBD"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Users size={16} color="#3b82f6" />
                    <Text className="text-sm font-medium">
                      Party of {primaryInvitation.booking?.party_size || "?"}
                    </Text>
                  </View>
                </View>

                {/* Message */}
                {primaryInvitation.message && (
                  <View className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Text className="text-sm text-blue-800 dark:text-blue-200">
                      &ldquo;{primaryInvitation.message}&rdquo;
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-2">
                  <Button
                    onPress={() => handleAccept(primaryInvitation.id)}
                    disabled={processingInvitation === primaryInvitation.id}
                    className="flex-1"
                  >
                    {processingInvitation === primaryInvitation.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <View className="flex-row items-center justify-center gap-2">
                        <Check size={16} color="white" />
                        <Text className="text-white font-medium">Accept</Text>
                      </View>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onPress={() => handleDecline(primaryInvitation.id)}
                    disabled={processingInvitation === primaryInvitation.id}
                    className="flex-1"
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <X
                        size={16}
                        color={colorScheme === "dark" ? "white" : "black"}
                      />
                      <Text className="font-medium">Decline</Text>
                    </View>
                  </Button>
                </View>
              </View>

              {/* Additional Invitations Indicator */}
              {remainingCount > 0 && (
                <View className="border-t border-border pt-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted-foreground">
                      + {remainingCount} more invitation
                      {remainingCount !== 1 ? "s" : ""}
                    </Text>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={onViewAll}
                      className="px-3"
                    >
                      <Text className="text-primary font-medium">View All</Text>
                    </Button>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
