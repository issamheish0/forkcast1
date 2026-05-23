import React from "react";
import { View, Pressable, Alert } from "react-native";
import { Shield, ShieldOff } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useBlockUser } from "@/hooks/useBlockUser";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface BlockButtonProps {
  userId: string;
  userName?: string;
  variant?: "default" | "outline" | "destructive" | "icon";
  size?: "default" | "sm" | "lg";
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
  onBlockStateChange?: (isBlocked: boolean) => void;
}

export function BlockButton({
  userId,
  userName,
  variant = "outline",
  size = "sm",
  showIcon = true,
  showText = true,
  className,
  onBlockStateChange,
}: BlockButtonProps) {
  const { colorScheme } = useColorScheme();
  const {
    isUserBlocked,
    blockingUser,
    blockUserWithConfirmation,
    unblockUserWithConfirmation,
  } = useBlockUser({
    onBlockSuccess: () => onBlockStateChange?.(true),
    onUnblockSuccess: () => onBlockStateChange?.(false),
  });

  const isBlocked = isUserBlocked(userId);
  const isProcessing = blockingUser === userId;

  const handlePress = () => {
    if (isBlocked) {
      unblockUserWithConfirmation(userId, userName);
    } else {
      blockUserWithConfirmation(userId, userName);
    }
  };

  const getButtonVariant = () => {
    if (variant === "icon") return "ghost";
    if (isBlocked) return "outline";
    return variant === "destructive" ? "destructive" : "outline";
  };

  const getIcon = () => {
    const iconColor = colorScheme === "dark" ? "#fff" : "#000";
    const size = variant === "icon" ? 20 : 16;

    return isBlocked ? (
      <ShieldOff size={size} color={iconColor} />
    ) : (
      <Shield size={size} color="#dc2626" />
    );
  };

  const getText = () => {
    return isBlocked ? "Unblock" : "Block";
  };

  if (variant === "icon") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isProcessing}
        className={`p-2 rounded-full ${className}`}
        style={{ opacity: isProcessing ? 0.6 : 1 }}
      >
        {getIcon()}
      </Pressable>
    );
  }

  return (
    <Button
      variant={getButtonVariant()}
      size={size}
      onPress={handlePress}
      disabled={isProcessing}
      className={className}
    >
      <View className="flex-row items-center gap-2">
        {showIcon && getIcon()}
        {showText && (
          <Text className={isBlocked ? "text-foreground" : "text-white"}>
            {getText()}
          </Text>
        )}
      </View>
    </Button>
  );
}

interface BlockStatusIndicatorProps {
  userId: string;
  className?: string;
}

export function BlockStatusIndicator({
  userId,
  className,
}: BlockStatusIndicatorProps) {
  const { colorScheme } = useColorScheme();
  const { isUserBlocked } = useBlockUser();

  if (!isUserBlocked(userId)) return null;

  return (
    <View className={`flex-row items-center gap-1 ${className}`}>
      <ShieldOff size={14} color={colorScheme === "dark" ? "#666" : "#999"} />
      <Muted className="text-xs">Blocked</Muted>
    </View>
  );
}

interface BlockedUserCardProps {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  blockedAt: string;
  reason?: string | null;
  onUnblock?: () => void;
}

export function BlockedUserCard({
  userId,
  userName,
  userAvatar,
  blockedAt,
  reason,
  onUnblock,
}: BlockedUserCardProps) {
  const { colorScheme } = useColorScheme();
  const { unblockUserWithConfirmation } = useBlockUser({
    onUnblockSuccess: onUnblock,
  });

  return (
    <View className="bg-card border border-border rounded-lg p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
            <Shield
              size={16}
              color={colorScheme === "dark" ? "#666" : "#999"}
            />
          </View>

          <View className="flex-1">
            <Text className="font-medium">{userName}</Text>
            <Muted className="text-xs">
              Blocked {formatDateToDDMMYYYY(new Date(blockedAt))}
            </Muted>
            {reason && <Muted className="text-xs mt-1">Reason: {reason}</Muted>}
          </View>
        </View>

        <Button
          variant="outline"
          size="sm"
          onPress={() => unblockUserWithConfirmation(userId, userName)}
        >
          <Text>Unblock</Text>
        </Button>
      </View>
    </View>
  );
}
