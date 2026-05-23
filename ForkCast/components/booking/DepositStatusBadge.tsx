// components/booking/DepositStatusBadge.tsx
// Displays the deposit status on booking cards and detail views

import React from "react";
import { View } from "react-native";
import {
  DollarSign,
  Check,
  Clock,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";

export type DepositStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partial_refund"
  | "forfeited";

interface DepositStatusBadgeProps {
  status: DepositStatus;
  amount?: number;
  currency?: string;
  compact?: boolean; // For smaller badge display
}

const statusConfig: Record<
  DepositStatus,
  {
    label: string;
    bgColor: string;
    bgColorDark: string;
    textColor: string;
    icon: React.ElementType;
    iconColor: string;
  }
> = {
  not_required: {
    label: "No Deposit",
    bgColor: "bg-gray-100",
    bgColorDark: "bg-gray-800",
    textColor: "text-gray-600",
    icon: DollarSign,
    iconColor: "#6B7280",
  },
  pending: {
    label: "Deposit Pending",
    bgColor: "bg-amber-50",
    bgColorDark: "bg-amber-900/30",
    textColor: "text-amber-700",
    icon: Clock,
    iconColor: "#D97706",
  },
  paid: {
    label: "Deposit Paid",
    bgColor: "bg-green-50",
    bgColorDark: "bg-green-900/30",
    textColor: "text-green-700",
    icon: Check,
    iconColor: "#16A34A",
  },
  failed: {
    label: "Payment Failed",
    bgColor: "bg-orange-50",
    bgColorDark: "bg-orange-900/30",
    textColor: "text-orange-700",
    icon: X,
    iconColor: "#EA580C",
  },
  refunded: {
    label: "Deposit Refunded",
    bgColor: "bg-blue-50",
    bgColorDark: "bg-blue-900/30",
    textColor: "text-blue-700",
    icon: RefreshCw,
    iconColor: "#2563EB",
  },
  partial_refund: {
    label: "Partially Refunded",
    bgColor: "bg-indigo-50",
    bgColorDark: "bg-indigo-900/30",
    textColor: "text-indigo-700",
    icon: RefreshCw,
    iconColor: "#4F46E5",
  },
  forfeited: {
    label: "Deposit Forfeited",
    bgColor: "bg-red-50",
    bgColorDark: "bg-red-900/30",
    textColor: "text-red-700",
    icon: AlertCircle,
    iconColor: "#DC2626",
  },
};

export function DepositStatusBadge({
  status,
  amount,
  currency = "USD",
  compact = false,
}: DepositStatusBadgeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const config = statusConfig[status] || statusConfig.not_required;
  const Icon = config.icon;

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amt);
  };

  if (status === "not_required") {
    return null; // Don't show badge if deposit not required
  }

  if (compact) {
    return (
      <View
        className={cn(
          "flex-row items-center gap-1 px-2 py-1 rounded-full",
          isDark ? config.bgColorDark : config.bgColor,
        )}
      >
        <Icon size={12} color={config.iconColor} />
        <Text className={cn("text-xs font-medium", config.textColor)}>
          {amount ? formatCurrency(amount) : config.label}
        </Text>
      </View>
    );
  }

  return (
    <View
      className={cn(
        "flex-row items-center gap-2 px-3 py-2 rounded-lg",
        isDark ? config.bgColorDark : config.bgColor,
      )}
    >
      <View
        className={cn(
          "w-7 h-7 rounded-full items-center justify-center",
          isDark ? "bg-white/10" : "bg-white",
        )}
      >
        <Icon size={14} color={config.iconColor} />
      </View>
      <View className="flex-1">
        <Text className={cn("font-semibold text-sm", config.textColor)}>
          {config.label}
        </Text>
        {amount !== undefined && amount > 0 && (
          <Text className={cn("text-xs", config.textColor, "opacity-80")}>
            {formatCurrency(amount)}
          </Text>
        )}
      </View>
    </View>
  );
}

// Helper function to check if deposit action is needed
export function isDepositActionNeeded(status: DepositStatus): boolean {
  return status === "pending";
}

// Helper function to check if deposit was collected
export function isDepositCollected(status: DepositStatus): boolean {
  return status === "paid" || status === "forfeited";
}
