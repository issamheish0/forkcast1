import React from "react";
import { View } from "react-native";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Calendar,
  Users,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import {
  BOOKING_STATUS_CONFIG,
  BookingStatus,
  formatBookingDate,
  formatBookingTime,
} from "@/lib/bookingUtils";

const STATUS_ICONS = {
  pending: AlertCircle,
  confirmed: CheckCircle,
  cancelled_by_user: XCircle,
  declined_by_restaurant: XCircle,
  auto_declined: XCircle,
  completed: CheckCircle,
  no_show: AlertCircle,
} as const;

interface BookingStatusCardProps {
  status: BookingStatus;
  date: string;
  time: string;
  partySize: number;
  confirmationCode?: string;
  variant?: "default" | "compact" | "detailed";
  showDescription?: boolean;
  className?: string;
}

export const BookingStatusCard: React.FC<BookingStatusCardProps> = ({
  status,
  date,
  time,
  partySize,
  confirmationCode,
  variant = "default",
  showDescription = true,
  className = "",
}) => {
  const statusConfig = BOOKING_STATUS_CONFIG[status];
  const StatusIcon = STATUS_ICONS[status];

  if (variant === "compact") {
    return (
      <View
        className={`border rounded-lg p-3 ${className}`}
        style={{
          borderColor: statusConfig.color,
          backgroundColor: statusConfig.bgColor,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <StatusIcon size={16} color={statusConfig.color} />
            <Text className="font-medium" style={{ color: statusConfig.color }}>
              {statusConfig.label}
            </Text>
          </View>
          {confirmationCode && (
            <Text
              className="text-xs font-mono"
              style={{ color: statusConfig.color }}
            >
              #{confirmationCode.slice(-6).toUpperCase()}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (variant === "detailed") {
    return (
      <View
        className={`border-2 rounded-xl p-6 ${className}`}
        style={{
          borderColor: statusConfig.color,
          backgroundColor: statusConfig.bgColor,
        }}
      >
        {/* Status Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <View
              className="rounded-full p-2"
              style={{ backgroundColor: statusConfig.color }}
            >
              <StatusIcon size={24} color="white" />
            </View>
            <View>
              <Text
                className="font-bold text-xl"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </Text>
              {confirmationCode && (
                <Text
                  className="text-sm font-mono mt-1"
                  style={{ color: statusConfig.color }}
                >
                  Confirmation: #{confirmationCode.toUpperCase()}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Booking Details */}
        <View className="space-y-3 mb-4">
          <View className="flex-row items-center gap-3">
            <Calendar size={18} color={statusConfig.color} />
            <Text
              className="font-medium text-base"
              style={{ color: statusConfig.color }}
            >
              {formatBookingDate(new Date(date))}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Clock size={18} color={statusConfig.color} />
            <Text
              className="font-medium text-base"
              style={{ color: statusConfig.color }}
            >
              {formatBookingTime(time)}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Users size={18} color={statusConfig.color} />
            <Text
              className="font-medium text-base"
              style={{ color: statusConfig.color }}
            >
              {partySize} {partySize === 1 ? "Guest" : "Guests"}
            </Text>
          </View>
        </View>

        {/* Description */}
        {showDescription && (
          <View className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
            <Text
              className="text-sm leading-relaxed"
              style={{ color: statusConfig.color }}
            >
              {statusConfig.description}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Default variant
  return (
    <View
      className={`border-2 rounded-xl p-4 ${className}`}
      style={{
        borderColor: statusConfig.color,
        backgroundColor: statusConfig.bgColor,
      }}
    >
      {/* Status Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <StatusIcon size={20} color={statusConfig.color} />
          <Text
            className="font-bold text-lg"
            style={{ color: statusConfig.color }}
          >
            {statusConfig.label}
          </Text>
        </View>
        {confirmationCode && (
          <View className="bg-white/70 dark:bg-black/30 rounded px-2 py-1">
            <Text
              className="text-xs font-mono"
              style={{ color: statusConfig.color }}
            >
              #{confirmationCode.slice(-6).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Booking Details */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-medium" style={{ color: statusConfig.color }}>
          {formatBookingDate(new Date(date))} at {formatBookingTime(time)}
        </Text>
        <Text className="font-medium" style={{ color: statusConfig.color }}>
          {partySize} {partySize === 1 ? "Guest" : "Guests"}
        </Text>
      </View>

      {/* Description */}
      {showDescription && (
        <Text className="text-sm" style={{ color: statusConfig.color }}>
          {statusConfig.description}
        </Text>
      )}
    </View>
  );
};
