// app/(protected)/waitlist.tsx
// Mobile app waitlist screen for React Native

import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { TabButton } from "@/components/ui/tab-button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWaitlist, getWaitlistEntryMessage } from "@/hooks/useWaitlist";
import { useRouter } from "expo-router";
import {
  Clock,
  Calendar,
  Users,
  MapPin,
  AlertCircle,
  XCircle,
  Info,
  History,
  ArrowLeft,
} from "lucide-react-native";
import { BackHeader } from "@/components/ui/back-header";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import type { WaitingStatus } from "@/types/waitlist";

// Define tab types for waitlist status filtering
type WaitlistTab = "active" | "history";

// Define tab configuration
const WAITLIST_TABS = [
  {
    id: "active" as WaitlistTab,
    title: "Active",
    statuses: ["active", "notified"] as WaitingStatus[],
  },
  {
    id: "history" as WaitlistTab,
    title: "History",
    statuses: ["booked", "expired", "cancelled"] as WaitingStatus[],
  },
];

export default function WaitlistScreen() {
  const router = useRouter();
  const { myWaitlist, loading, getMyWaitlist, leaveWaitlist, isAuthenticated } =
    useWaitlist();

  // Tab state for filtering waitlist entries
  const [activeTab, setActiveTab] = useState<WaitlistTab>("active");

  // Filter waitlist entries based on active tab
  const filteredWaitlist = useMemo(() => {
    const currentTab = WAITLIST_TABS.find((tab) => tab.id === activeTab);
    if (!currentTab) return [];

    return myWaitlist.filter((entry) =>
      currentTab.statuses.includes(entry.status),
    );
  }, [myWaitlist, activeTab]);

  // Count entries for each tab
  const tabCounts = useMemo(() => {
    const counts: Record<WaitlistTab, number> = {
      active: 0,
      history: 0,
    };

    myWaitlist.forEach((entry) => {
      WAITLIST_TABS.forEach((tab) => {
        if (tab.statuses.includes(entry.status)) {
          counts[tab.id]++;
        }
      });
    });

    return counts;
  }, [myWaitlist]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [isAuthenticated]);

  const formatDate = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEE, MMM d");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#3b82f6"; // blue
      case "notified":
        return "#f59e0b"; // yellow
      case "booked":
        return "#10b981"; // green
      case "expired":
        return "#6b7280"; // gray
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return Clock;
      case "notified":
        return AlertCircle;
      case "booked":
        return Calendar; // Using Calendar instead of CheckCircle
      case "expired":
        return XCircle;
      default:
        return Clock;
    }
  };

  /**
   * Formats waitlist status for display
   * Converts raw status to user-friendly text
   */
  const formatWaitlistStatus = (status: string): string => {
    switch (status) {
      case "active":
        return "Active";
      case "notified":
        return "Notified";
      case "booked":
        return "Booked";
      case "expired":
        return "Expired";
      case "cancelled":
        return "Cancelled";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const handleLeaveWaitlist = (entry: any) => {
    Alert.alert(
      "Leave Waitlist?",
      `Are you sure you want to leave the waitlist for ${entry.restaurant?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => leaveWaitlist(entry.id),
        },
      ],
    );
  };

  // Helper function to get empty state for each tab
  const getEmptyState = () => {
    switch (activeTab) {
      case "active":
        return {
          icon: Clock,
          title: "No Active Waitlists",
          subtitle:
            "You're not currently on any restaurant waitlists. Join one when tables aren't available for your preferred time.",
          actionLabel: "Browse Restaurants",
          onAction: () => router.push("/(protected)/(tabs)/search"),
        };
      case "history":
        return {
          icon: History,
          title: "No Waitlist History",
          subtitle:
            "Your completed, expired, and cancelled waitlist entries will appear here.",
        };
      default:
        return {
          icon: Clock,
          title: "No Waitlist Entries",
          subtitle: "You haven't joined any waitlists yet.",
        };
    }
  };

  if (loading && myWaitlist.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">
            Loading waitlist...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <BackHeader title="My Waitlist" />

      <View className="px-4 py-2">
        <Muted>Your restaurant waiting list entries</Muted>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border bg-background">
        {WAITLIST_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            title={tab.title}
            isActive={activeTab === tab.id}
            onPress={() => setActiveTab(tab.id)}
            count={tabCounts[tab.id]}
          />
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={getMyWaitlist} />
        }
      >
        {filteredWaitlist.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <EmptyState {...getEmptyState()} />
          </View>
        ) : (
          <View className="p-4 space-y-4">
            {filteredWaitlist.map((entry) => {
              const StatusIcon = getStatusIcon(entry.status);
              const statusColor = getStatusColor(entry.status);
              const isNotified = entry.status === "notified";
              const waitlistMessage = getWaitlistEntryMessage(entry);

              return (
                <View
                  key={entry.id}
                  className="bg-card rounded-lg p-4 border border-border"
                >
                  {/* Restaurant Info */}
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <H3>{entry.restaurant?.name || "Restaurant"}</H3>
                      {entry.restaurant?.address && (
                        <View className="flex-row items-center mt-1">
                          <MapPin size={12} color="#6b7280" />
                          <Muted className="ml-1 text-xs">
                            {entry.restaurant.address}
                          </Muted>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {/* Scheduled Entry Badge */}
                      {waitlistMessage.badgeText && (
                        <View
                          className="px-2 py-1 rounded-full flex-row items-center"
                          style={{
                            backgroundColor: entry.is_scheduled_entry
                              ? "#f59e0b20"
                              : "#10b98120",
                          }}
                        >
                          <Info
                            size={12}
                            color={
                              entry.is_scheduled_entry ? "#f59e0b" : "#10b981"
                            }
                          />
                          <Text
                            className="ml-1 text-xs font-medium"
                            style={{
                              color: entry.is_scheduled_entry
                                ? "#f59e0b"
                                : "#10b981",
                            }}
                          >
                            {waitlistMessage.badgeText}
                          </Text>
                        </View>
                      )}
                      {/* Status Badge */}
                      <View
                        className="px-2 py-1 rounded-full flex-row items-center"
                        style={{ backgroundColor: `${statusColor}20` }}
                      >
                        <StatusIcon size={14} color={statusColor} />
                        <Text
                          className="ml-1 text-xs font-medium"
                          style={{ color: statusColor }}
                        >
                          {formatWaitlistStatus(entry.status)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Entry Type Explanation */}
                  {entry.is_scheduled_entry === true && (
                    <View className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <View className="flex-row items-start">
                        <Info size={16} color="#f59e0b" className="mt-0.5" />
                        <View className="ml-2 flex-1">
                          <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            {waitlistMessage.title}
                          </Text>
                          <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            {waitlistMessage.description}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Waitlist Details */}
                  <View className="space-y-2">
                    <View className="flex-row items-center">
                      <Calendar size={16} color="#6b7280" />
                      <Text className="ml-2 text-sm">
                        {formatDate(entry.desired_date)}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Clock size={16} color="#6b7280" />
                      <Text className="ml-2 text-sm">
                        {entry.desired_time_range}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Users size={16} color="#6b7280" />
                      <Text className="ml-2 text-sm">
                        {entry.party_size}{" "}
                        {entry.party_size === 1 ? "person" : "people"}
                      </Text>
                    </View>
                  </View>

                  {/* Notification Alert */}
                  {isNotified && (
                    <View className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <View className="flex-row items-center">
                        <AlertCircle size={16} color="#f59e0b" />
                        <Text className="ml-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Table Available!
                        </Text>
                      </View>
                      <Text className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        A table was available for your requested time
                      </Text>
                    </View>
                  )}

                  {/* Expiration Warning */}
                  {entry.expires_at && entry.status === "active" && (
                    <Text className="text-xs text-muted-foreground mt-2">
                      Expires: {format(parseISO(entry.expires_at), "h:mm a")}
                    </Text>
                  )}

                  {/* Actions */}
                  <View className="flex-row gap-2 mt-4">
                    {entry.status === "active" ? (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onPress={() => handleLeaveWaitlist(entry)}
                        >
                          <Text className="font-medium">Leave Waitlist</Text>
                        </Button>
                        <Button
                          className="flex-1"
                          onPress={() =>
                            router.push({
                              pathname: "/(protected)/restaurant/[id]",
                              params: { id: entry.restaurant_id },
                            })
                          }
                        >
                          <Text className="text-primary-foreground font-medium">
                            View Restaurant
                          </Text>
                        </Button>
                      </>
                    ) : (
                      // For all other entries (notified, expired, cancelled, booked) - view only
                      <Button
                        variant="outline"
                        className="flex-1"
                        onPress={() =>
                          router.push({
                            pathname: "/(protected)/restaurant/[id]",
                            params: { id: entry.restaurant_id },
                          })
                        }
                      >
                        <Text className="font-medium">View Restaurant</Text>
                      </Button>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
