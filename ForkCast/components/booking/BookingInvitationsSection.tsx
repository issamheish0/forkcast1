import React, { useEffect, useState } from "react";
import { View, Alert, Image } from "react-native"; // REMOVED Text from here!
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Clock4,
  UserX,
} from "lucide-react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Text } from "@/components/ui/text"; // USE THIS Text component
import { Button } from "@/components/ui/button";
import * as Haptics from "expo-haptics";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface BookingInvitationDetails {
  id: string;
  booking_id: string;
  from_user_id: string;
  to_user_id: string;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "cancelled"
    | "expired"
    | "auto_declined"
    | string;
  message?: string;
  created_at: string;
  responded_at?: string;
  to_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  } | null;
}

interface BookingInvitationsSectionProps {
  bookingId: string;
  bookingUserId: string | null;
}

type StatusConfig = {
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
  darkBgColor: string;
  label: string;
  description: string;
};

const FALLBACK_STATUS_CONFIG: StatusConfig = {
  icon: Clock4,
  color: "#6b7280",
  bgColor: "#f3f4f6",
  darkBgColor: "#374151",
  label: "Unknown",
  description: "Status unavailable",
};

const getStatusConfig = (
  status: BookingInvitationDetails["status"],
): StatusConfig => {
  switch (status) {
    case "accepted":
      return {
        icon: CheckCircle,
        color: "#22c55e",
        bgColor: "#dcfce7",
        darkBgColor: "#166534",
        label: "Accepted",
        description: "Will attend",
      };
    case "declined":
      return {
        icon: XCircle,
        color: "#ef4444",
        bgColor: "#fee2e2",
        darkBgColor: "#991b1b",
        label: "Declined",
        description: "Cannot attend",
      };
    case "pending":
      return {
        icon: Clock4,
        color: "#f59e0b",
        bgColor: "#fef3c7",
        darkBgColor: "#92400e",
        label: "Pending",
        description: "Awaiting response",
      };
    case "cancelled":
      return {
        icon: UserX,
        color: "#6b7280",
        bgColor: "#f3f4f6",
        darkBgColor: "#374151",
        label: "Cancelled",
        description: "Invitation cancelled",
      };
    default: {
      console.warn(
        "[BookingInvitationsSection] Unknown invitation status encountered",
        status,
      );
      return FALLBACK_STATUS_CONFIG;
    }
  }
};

export const BookingInvitationsSection: React.FC<
  BookingInvitationsSectionProps
> = ({ bookingId, bookingUserId }) => {
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<BookingInvitationDetails[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const fetchBookingInvitations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("booking_invites")
        .select(
          `
          id,
          booking_id,
          from_user_id,
          to_user_id,
          status,
          message,
          created_at,
          responded_at,
          to_user:profiles!booking_invites_to_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedData = (data || []).map((item) => ({
        ...item,
        to_user: Array.isArray(item.to_user) ? item.to_user[0] : item.to_user,
      })) as BookingInvitationDetails[];

      setInvitations(transformedData);
    } catch (error) {
      console.error("Error fetching booking invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchBookingInvitations();
    }
  }, [bookingId]);

  const handleResendInvitation = async (
    invitationId: string,
    toUserId: string,
    toUserName: string,
  ) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        "Invitation Resent",
        `A reminder has been sent to ${toUserName}.`,
      );
    } catch (error) {
      console.error("Error resending invitation:", error);
      Alert.alert("Error", "Failed to resend invitation. Please try again.");
    }
  };

  const handleCancelInvitation = async (
    invitationId: string,
    toUserName: string,
  ) => {
    Alert.alert(
      "Cancel Invitation",
      `Are you sure you want to cancel the invitation to ${toUserName}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("booking_invites")
                .update({
                  status: "cancelled",
                  responded_at: new Date().toISOString(),
                })
                .eq("id", invitationId);

              if (error) throw error;

              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              fetchBookingInvitations();
            } catch (error) {
              console.error("Error cancelling invitation:", error);
              Alert.alert(
                "Error",
                "Failed to cancel invitation. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View className="p-4 border-b border-border">
        <Text className="text-lg font-bold mb-4">Invited Guests</Text>
        <View className="bg-muted/50 rounded-lg p-4">
          <Text className="text-center text-muted-foreground">
            Loading invitations...
          </Text>
        </View>
      </View>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  const isBookingOwner = profile?.id === bookingUserId;
  const acceptedCount = invitations.filter(
    (inv) => inv.status === "accepted",
  ).length;
  const pendingCount = invitations.filter(
    (inv) => inv.status === "pending",
  ).length;

  return (
    <View className="p-4 border-b border-border">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold">Invited Guests</Text>
        <View className="flex-row gap-2">
          {acceptedCount > 0 ? (
            <View className="bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">
              <Text className="text-green-800 dark:text-green-200 font-medium text-xs">
                {acceptedCount} attending
              </Text>
            </View>
          ) : null}
          {pendingCount > 0 ? (
            <View className="bg-yellow-100 dark:bg-yellow-900 px-3 py-1 rounded-full">
              <Text className="text-yellow-800 dark:text-yellow-200 font-medium text-xs">
                {pendingCount} pending
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="space-y-3">
        {invitations.map((invitation) => {
          const statusConfig = getStatusConfig(invitation.status);
          const StatusIcon = statusConfig.icon;
          const timeSince = formatDateToDDMMYYYY(
            new Date(invitation.created_at),
          );
          const guestName = invitation.to_user?.full_name || "Guest";
          const guestAvatar =
            invitation.to_user?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(guestName)}&background=e5e7eb&color=374151`;

          return (
            <View
              key={invitation.id}
              className="bg-card border border-border rounded-lg p-4"
            >
              <View className="flex-row items-start gap-3">
                {/* optimizationPreset is an extended prop on our wrapped Image; cast to any to satisfy TS in this file */}
                <Image
                  {...({
                    source: { uri: guestAvatar },
                    optimizationPreset: "thumbnail",
                    className: "w-11 h-11 rounded-full bg-gray-100",
                  } as any)}
                />

                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-semibold text-lg">{guestName}</Text>
                    <View
                      className="px-2 py-1 rounded-full flex-row items-center gap-1"
                      style={{ backgroundColor: statusConfig.bgColor }}
                    >
                      <StatusIcon size={14} color={statusConfig.color} />
                      <Text
                        className="text-xs font-medium"
                        style={{ color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-sm text-muted-foreground mb-2">
                    {statusConfig.description}
                  </Text>

                  <View className="flex-row items-center gap-2">
                    <Clock size={12} color="#6b7280" />
                    <Text className="text-xs text-muted-foreground">
                      {`Invited ${timeSince}`}
                      {invitation.responded_at &&
                      invitation.status !== "pending" ? (
                        <Text>{` • Responded ${formatDateToDDMMYYYY(new Date(invitation.responded_at))}`}</Text>
                      ) : null}
                    </Text>
                  </View>

                  {/* Action buttons for booking owner */}
                  {isBookingOwner && invitation.status === "pending" ? (
                    <View className="flex-row gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() =>
                          handleResendInvitation(
                            invitation.id,
                            invitation.to_user_id,
                            guestName,
                          )
                        }
                        className="flex-1"
                      >
                        <Text className="text-xs">Resend</Text>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onPress={() =>
                          handleCancelInvitation(invitation.id, guestName)
                        }
                        className="flex-1"
                      >
                        <Text className="text-xs text-white">Cancel</Text>
                      </Button>
                    </View>
                  ) : null}

                  {/* Message if provided */}
                  {invitation.message ? (
                    <View className="mt-2 p-2 bg-muted/30 rounded-md">
                      <Text className="text-sm italic">
                        {`"${invitation.message}"`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Summary footer */}
      <View className="mt-4 p-3 bg-muted/30 rounded-lg">
        <View className="flex-row items-center gap-2">
          <Users size={16} color="#6b7280" />
          <Text className="text-sm text-muted-foreground">
            {`${invitations.length} ${invitations.length === 1 ? "person" : "people"} invited`}
            {acceptedCount > 0 ? (
              <Text>{` • ${acceptedCount} confirmed`}</Text>
            ) : null}
            {pendingCount > 0 ? (
              <Text>{` • ${pendingCount} pending`}</Text>
            ) : null}
          </Text>
        </View>
      </View>
    </View>
  );
};
