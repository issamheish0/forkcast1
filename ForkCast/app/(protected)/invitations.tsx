import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  Users,
  MapPin,
  Check,
  X,
  ArrowLeft,
  Clock,
  UserCheck,
  Trash2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  useBookingInvitations,
  BookingInvitation,
} from "@/hooks/useBookingInvitations";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import { supabase } from "@/config/supabase";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { formatTimeFromDate } from "@/utils/timeFormat";

type TabType = "received" | "sent";

const InvitationCard = React.memo<{
  invitation: BookingInvitation;
  type: "received" | "sent";
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  onLeave?: (id: string, bookingId: string) => void;
  onCancelEntire?: (bookingId: string) => void;
  canCancelEntireBooking?: boolean;
}>(function InvitationCard({
  invitation,
  type,
  onAccept,
  onDecline,
  onCancel,
  onLeave,
  onCancelEntire,
  canCancelEntireBooking = false,
}) {
  const { colorScheme } = useColorScheme();
  const [processing, setProcessing] = useState(false);

  const booking = invitation.booking;
  const restaurant = booking?.restaurant;
  const otherUser =
    type === "received" ? invitation.from_user : invitation.to_user;

  // Check if booking time has passed
  const isBookingExpired = useCallback(() => {
    if (!booking?.booking_time) return false;
    return new Date(booking.booking_time) <= new Date();
  }, [booking?.booking_time]);

  const bookingExpired = isBookingExpired();

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

    // Format as DD/MM/YYYY with day name and time
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getDay()];
    const dateFormatted = formatDateToDDMMYYYY(date);
    return `${dayName}, ${dateFormatted} at ${timeString}`;
  };

  const handleAction = async (action: string) => {
    if (processing) return;

    setProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      switch (action) {
        case "accept":
          await onAccept?.(invitation.id);
          break;
        case "decline":
          await onDecline?.(invitation.id);
          break;
        case "cancel":
          await onCancel?.(invitation.id);
          break;
        case "leave":
          await onLeave?.(invitation.id, invitation.booking_id);
          break;
        case "cancelEntire":
          await onCancelEntire?.(invitation.booking_id);
          break;
      }
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "text-green-600 dark:text-green-400";
      case "declined":
        return "text-red-600 dark:text-red-400";
      case "cancelled":
        return "text-gray-600 dark:text-gray-400";
      default:
        return "text-orange-600 dark:text-orange-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "accepted":
        return "Accepted";
      case "declined":
        return "Declined";
      case "cancelled":
        return "Cancelled";
      default:
        return "Pending";
    }
  };

  return (
    <View
      className="mb-4 p-4 bg-card rounded-xl border border-border shadow-sm"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3 flex-1">
          <Image
            source={{
              uri:
                otherUser?.avatar_url ||
                `https://ui-avatars.com/api/?name=${otherUser?.full_name || "User"}`,
            }}
            className="w-10 h-10 rounded-full bg-gray-100"
            optimizationPreset="thumbnail"
          />
          <View className="flex-1">
            <Text className="font-semibold">
              {type === "received"
                ? `${otherUser?.full_name || "Someone"} invited you`
                : `Invited ${otherUser?.full_name || "someone"}`}
            </Text>
            <Text
              className={`text-sm font-medium ${bookingExpired ? "text-gray-500" : getStatusColor(invitation.status)}`}
            >
              {bookingExpired ? "Expired" : getStatusText(invitation.status)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          <Clock size={14} color="#666" />
          <Muted className="text-xs">
            {formatDateToDDMMYYYY(new Date(invitation.created_at))}
          </Muted>
        </View>
      </View>

      {/* Restaurant Info */}
      <View className="flex-row gap-3 mb-3 p-3 bg-muted/30 rounded-lg">
        <Image
          source={{
            uri:
              restaurant?.main_image_url || "https://via.placeholder.com/150",
          }}
          className="w-12 h-12 rounded-lg bg-gray-100"
          contentFit="cover"
          placeholder="Restaurant"
          optimizationPreset="thumbnail"
        />
        <View className="flex-1">
          <Text className="font-semibold">
            {restaurant?.name || "Restaurant"}
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <MapPin size={12} color="#666" />
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {restaurant?.address || "Address"}
            </Text>
          </View>
        </View>
      </View>

      {/* Booking Details */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-2">
            <Calendar size={16} color="#3b82f6" />
            <Text className="text-sm font-medium">
              {booking ? formatBookingTime(booking.booking_time) : "Time TBD"}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Users size={16} color="#3b82f6" />
            <Text className="text-sm font-medium">
              Party of {booking?.party_size || "?"}
            </Text>
          </View>
        </View>
      </View>

      {/* Message */}
      {invitation.message && (
        <View className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Text className="text-sm text-blue-800 dark:text-blue-200">
            &ldquo;{invitation.message}&rdquo;
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {type === "received" && invitation.status === "pending" && (
          <>
            <Button
              onPress={() => handleAction("accept")}
              disabled={processing || bookingExpired}
              className="flex-1"
            >
              {processing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <Check size={16} color="white" />
                  <Text className="text-white font-medium">
                    {bookingExpired ? "Expired" : "Accept"}
                  </Text>
                </View>
              )}
            </Button>

            <Button
              variant="outline"
              onPress={() => handleAction("decline")}
              disabled={processing || bookingExpired}
              className="flex-1"
            >
              <View className="flex-row items-center justify-center gap-2">
                <X
                  size={16}
                  color={colorScheme === "dark" ? "white" : "black"}
                />
                <Text className="font-medium">
                  {bookingExpired ? "Expired" : "Decline"}
                </Text>
              </View>
            </Button>
          </>
        )}

        {type === "received" && invitation.status === "accepted" && (
          <>
            <Button
              variant="outline"
              onPress={() => handleAction("leave")}
              disabled={processing || bookingExpired}
              className="flex-1"
            >
              {processing ? (
                <ActivityIndicator size="small" color="currentColor" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <Trash2
                    size={16}
                    color={bookingExpired ? "#9ca3af" : "#ef4444"}
                  />
                  <Text
                    className={`font-medium ${bookingExpired ? "text-gray-400" : "text-red-500"}`}
                  >
                    {bookingExpired ? "Expired" : "Leave"}
                  </Text>
                </View>
              )}
            </Button>

            {canCancelEntireBooking && (
              <Button
                variant="destructive"
                onPress={() => onCancelEntire?.(invitation.booking_id)}
                disabled={processing || bookingExpired}
                className="flex-1 ml-2"
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center justify-center gap-2">
                    <X size={16} color="white" />
                    <Text className="font-medium text-white">
                      {bookingExpired ? "Expired" : "Cancel Booking"}
                    </Text>
                  </View>
                )}
              </Button>
            )}
          </>
        )}

        {type === "sent" && invitation.status === "pending" && (
          <>
            <Button
              variant="outline"
              onPress={() => handleAction("cancel")}
              disabled={processing || bookingExpired}
              className="flex-1"
            >
              {processing ? (
                <ActivityIndicator size="small" color="currentColor" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <X
                    size={16}
                    color={colorScheme === "dark" ? "white" : "black"}
                  />
                  <Text className="font-medium">
                    {bookingExpired ? "Expired" : "Cancel Invitation"}
                  </Text>
                </View>
              )}
            </Button>

            {canCancelEntireBooking && (
              <Button
                variant="destructive"
                onPress={() => onCancelEntire?.(invitation.booking_id)}
                disabled={processing || bookingExpired}
                className="flex-1 ml-2"
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center justify-center gap-2">
                    <Trash2 size={16} color="white" />
                    <Text className="font-medium text-white">
                      {bookingExpired ? "Expired" : "Cancel Booking"}
                    </Text>
                  </View>
                )}
              </Button>
            )}
          </>
        )}

        {invitation.status === "accepted" && (
          <View className="flex-1 flex-row items-center justify-center gap-2 p-3">
            <UserCheck size={16} color="#10b981" />
            <Text className="font-medium text-green-600 dark:text-green-400">
              {type === "received" ? "You're going!" : "They're coming!"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

export default function InvitationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { cancelBooking } = useBookingConfirmation();

  const {
    invitations,
    loading,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
    leaveBooking,
    cancelEntireBooking,
    loadReceivedInvitations,
    loadSentInvitations,
    canCancelEntireBooking,
  } = useBookingInvitations();

  const [activeTab, setActiveTab] = useState<TabType>("received");
  const [sentInvitations, setSentInvitations] = useState<BookingInvitation[]>(
    [],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [userRoles, setUserRoles] = useState<Record<string, boolean>>({});

  // Check user roles for each booking when invitations change
  useEffect(() => {
    const checkRoles = async () => {
      const currentInvitations =
        activeTab === "received" ? invitations : sentInvitations;
      const newRoles: Record<string, boolean> = {};

      for (const invitation of currentInvitations) {
        if (invitation.booking?.id) {
          const canCancel = await canCancelEntireBooking(invitation.booking.id);
          newRoles[invitation.booking.id] = canCancel;
        }
      }

      setUserRoles(newRoles);
    };

    checkRoles();
  }, [invitations, sentInvitations, activeTab, canCancelEntireBooking]);

  // Handle cancelling entire booking
  const handleCancelEntireBooking = useCallback(
    async (bookingId: string) => {
      await cancelEntireBooking(bookingId, async () => {
        return await cancelBooking(bookingId);
      });
      // Refresh data after cancellation
      if (activeTab === "received") {
        await loadReceivedInvitations();
      } else {
        const sent = await loadSentInvitations();
        setSentInvitations(sent || []);
      }
    },
    [
      cancelEntireBooking,
      cancelBooking,
      activeTab,
      loadReceivedInvitations,
      loadSentInvitations,
    ],
  );

  // Load sent invitations when switching to sent tab
  const handleTabChange = useCallback(
    async (tab: TabType) => {
      setActiveTab(tab);
      if (tab === "sent") {
        const sent = await loadSentInvitations();
        setSentInvitations(sent || []);
      }
    },
    [loadSentInvitations],
  );

  // Refresh data
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "received") {
        await loadReceivedInvitations();
      } else {
        const sent = await loadSentInvitations();
        setSentInvitations(sent || []);
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, loadReceivedInvitations, loadSentInvitations]);

  // Set up real-time subscriptions for the invitations screen
  useEffect(() => {
    const channel = supabase
      .channel("invitations_screen_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_invites",
        },
        async (payload: any) => {
          // Refresh current tab data
          if (activeTab === "received") {
            await loadReceivedInvitations();
          } else {
            const sent = await loadSentInvitations();
            setSentInvitations(sent || []);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        async (payload: any) => {
          // Refresh data since booking details might have changed
          await onRefresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, loadReceivedInvitations, loadSentInvitations, onRefresh]);

  const currentInvitations =
    activeTab === "received" ? invitations : sentInvitations;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-3 bg-background border-b border-border">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="p-2">
            <ArrowLeft
              size={24}
              color={colorScheme === "dark" ? "white" : "black"}
            />
          </Pressable>

          <H2>Invitations</H2>

          <View className="p-2">{/* Placeholder */}</View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-background px-4 py-2 border-b border-border">
        {[
          { id: "received", label: "Received", icon: UserCheck },
          { id: "sent", label: "Sent", icon: Users },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => handleTabChange(tab.id as TabType)}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              activeTab === tab.id ? "bg-secondary" : ""
            }`}
          >
            <tab.icon
              size={18}
              color={
                activeTab === tab.id
                  ? "#dc2626"
                  : colorScheme === "dark"
                    ? "#9ca3af"
                    : "#6b7280"
              }
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === tab.id ? "text-red-600" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="py-4">
          {loading && currentInvitations.length === 0 ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#dc2626" />
              <Text className="text-muted-foreground mt-4">
                Loading invitations...
              </Text>
            </View>
          ) : currentInvitations.length === 0 ? (
            <View className="items-center justify-center py-12">
              <UserCheck size={48} color="#9ca3af" />
              <Text className="text-muted-foreground mt-4 text-center">
                {activeTab === "received"
                  ? "No invitations received yet"
                  : "No invitations sent yet"}
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-2">
                {activeTab === "received"
                  ? "When friends invite you to bookings, they'll appear here"
                  : "Invitations you send to friends will appear here"}
              </Text>
            </View>
          ) : (
            currentInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                type={activeTab}
                onAccept={acceptInvitation}
                onDecline={declineInvitation}
                onCancel={cancelInvitation}
                onLeave={leaveBooking}
                onCancelEntire={handleCancelEntireBooking}
                canCancelEntireBooking={
                  invitation.booking?.id
                    ? userRoles[invitation.booking.id] || false
                    : false
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
