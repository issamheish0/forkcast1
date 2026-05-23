// components/waiting-list/WaitingListCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  Users,
  Calendar,
  X,
  Eye,
  ChevronRight,
} from "lucide-react-native";
import { format, parseISO } from "date-fns";

import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";

type WaitlistRow = {
  id: string;
  user_id?: string;
  restaurant_id: string;
  desired_date: string;
  desired_time_range: string;
  party_size: number;
  table_type: string;
  status: "active" | "notified" | "booked" | "expired" | "cancelled";
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  special_requests?: string;
  notified_at?: string;
  notification_expires_at?: string;
  expires_at?: string;
  converted_booking_id?: string;
  created_at?: string;
  updated_at?: string;
  is_scheduled_entry?: boolean;
  restaurant?: {
    id: string;
    name: string;
    address?: string;
    main_image_url?: string;
  };
};

interface Props {
  entry: WaitlistRow;
  onNavigateToRestaurant?: (restaurantId: string) => void;
}

// Simple badge component
const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <View className={`px-2 py-1 rounded-full ${className}`}>{children}</View>;

export function WaitingListCard({ entry, onNavigateToRestaurant }: Props) {
  const router = useRouter();
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "notified":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "expired":
        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
      case "cancelled":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      case "booked":
        return "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Waiting";
      case "notified":
        return "Table Ready!";
      case "expired":
        return "Expired";
      case "cancelled":
        return "Cancelled";
      case "booked":
        return "Booked";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeRange: string) => {
    // Handle time range formats like "18:00-20:00" or "[18:00,20:00)"
    if (timeRange.includes("-")) {
      return timeRange;
    }
    if (timeRange.startsWith("[") && timeRange.endsWith(")")) {
      const rangeContent = timeRange.slice(1, -1);
      const [startTime, endTime] = rangeContent.split(",");
      return `${startTime.trim()}-${endTime.trim()}`;
    }
    return timeRange;
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <Pressable
        onPress={() => router.push(`/(protected)/waitlist/${entry.id}` as any)}
        className="active:opacity-70"
      >
        <View className="p-4">
          {/* Header with restaurant info and status */}
          <View className="flex-row items-start justify-between mb-3">
            <Pressable
              onPress={() => {
                if (entry.restaurant?.id) {
                  if (onNavigateToRestaurant) {
                    onNavigateToRestaurant(entry.restaurant.id);
                  } else {
                    router.push(`/restaurant/${entry.restaurant.id}`);
                  }
                }
              }}
              className="flex-1 flex-row items-start"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {entry.restaurant?.main_image_url && (
                <Image
                  source={{ uri: entry.restaurant.main_image_url }}
                  className="w-12 h-12 rounded-lg mr-3"
                  optimizationPreset="thumbnail"
                />
              )}

              <View className="flex-1">
                <Text className="font-semibold text-base mb-1">
                  {entry.restaurant?.name || "Unknown Restaurant"}
                </Text>

                {entry.restaurant?.address && (
                  <View className="flex-row items-center mb-2">
                    <MapPin size={14} color="#6b7280" />
                    <Text className="text-muted-foreground text-sm ml-1 flex-1">
                      {entry.restaurant.address}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>

            <Badge className={getStatusColor(entry.status)}>
              <Text className="font-medium text-xs">
                {getStatusText(entry.status)}
              </Text>
            </Badge>
          </View>

          {/* Booking Details */}
          <View className="space-y-2 mb-4">
            <View className="flex-row items-center">
              <Calendar size={16} color="#6b7280" />
              <Text className="text-muted-foreground ml-2">
                {formatDate(entry.desired_date)}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Clock size={16} color="#6b7280" />
              <Text className="text-muted-foreground ml-2">
                {formatTime(entry.desired_time_range)}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Users size={16} color="#6b7280" />
              <Text className="text-muted-foreground ml-2">
                {entry.party_size}{" "}
                {entry.party_size === 1 ? "person" : "people"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
