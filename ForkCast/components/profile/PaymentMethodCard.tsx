// components/profile/PaymentMethodCard.tsx
// Displays a single saved payment method with card brand icon, masked number, expiry, and actions

import React, { useState } from "react";
import {
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import {
  CreditCard,
  Trash2,
  Check,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { PaymentMethod, CARD_BRANDS } from "@/hooks/usePaymentMethods";

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  isDefault?: boolean;
  isExpiringSoon?: boolean;
  onDelete?: () => Promise<boolean>;
  onSetDefault?: () => Promise<any>;
  onUpdateName?: (id: string, name: string | null) => Promise<boolean>;
  onPress?: () => void;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  showActions?: boolean;
}

// Card brand SVG-like icons (simplified for React Native)
const CardBrandIcon = ({
  brand,
  size = 32,
}: {
  brand: string;
  size?: number;
}) => {
  const brandInfo = CARD_BRANDS[brand.toLowerCase()] || CARD_BRANDS.unknown;

  return (
    <View
      className="items-center justify-center rounded-md"
      style={{
        width: size + 8,
        height: size,
        backgroundColor: `${brandInfo.color}15`,
      }}
    >
      <CreditCard size={size - 8} color={brandInfo.color} strokeWidth={1.5} />
    </View>
  );
};

export function PaymentMethodCard({
  paymentMethod,
  isDefault = false,
  isExpiringSoon = false,
  onDelete,
  onSetDefault,
  onUpdateName,
  onPress,
  selectable = false,
  selected = false,
  disabled = false,
  showActions = true,
}: PaymentMethodCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [loading, setLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(paymentMethod.name || "");

  const brandInfo =
    CARD_BRANDS[paymentMethod.card_brand?.toLowerCase() || "unknown"] ||
    CARD_BRANDS.unknown;

  // Format the masked card number for display
  const formatCardMask = (mask: string): string => {
    // Remove any non-digit and non-asterisk characters
    const cleaned = mask.replace(/[^0-9*]/g, "");
    // Format as **** **** **** XXXX
    if (cleaned.length >= 4) {
      const lastFour = cleaned.slice(-4);
      return `•••• •••• •••• ${lastFour}`;
    }
    return mask;
  };

  // Format expiry date
  const formatExpiry = (): string => {
    const month = paymentMethod.expiry_month.toString().padStart(2, "0");
    const year = paymentMethod.expiry_year.toString().slice(-2);
    return `${month}/${year}`;
  };

  // Handle delete with confirmation
  const handleDelete = async () => {
    Alert.alert(
      "Remove Card",
      `Are you sure you want to remove the card ending in ${paymentMethod.card_mask?.slice(-4) || "****"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (onDelete) {
              setLoading(true);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await onDelete();
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // Handle set default
  const handleSetDefault = async () => {
    if (onSetDefault && !isDefault) {
      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onSetDefault();
      setLoading(false);
    }
  };

  // Handle start editing
  const handleStartEdit = () => {
    setEditedName(paymentMethod.name || "");
    setIsEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (onUpdateName) {
      setLoading(true);
      const success = await onUpdateName(
        paymentMethod.id,
        editedName.trim() || null,
      );
      setLoading(false);
      if (success) {
        setIsEditing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      setIsEditing(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName(paymentMethod.name || "");
  };

  // Handle card press
  const handlePress = () => {
    if (disabled || loading || isEditing) return;

    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  // Inlined content (no nested component) so TextInput doesn't remount on each keystroke and dismiss keyboard
  const cardContent = (
    <>
      {/* Card Brand Icon */}
      <CardBrandIcon brand={paymentMethod.card_brand || "unknown"} size={36} />

      {/* Card Details */}
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          {isEditing ? (
            <TextInput
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Card Name"
              placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
              className={cn(
                "flex-1 px-2 py-0.5 rounded border text-base font-medium mr-2",
                isDark
                  ? "bg-gray-800 border-gray-600 text-white"
                  : "bg-white border-gray-200 text-gray-900",
              )}
              autoFocus
              onSubmitEditing={handleSaveEdit}
              blurOnSubmit={false}
            />
          ) : (
            <Text
              className={cn(
                "text-base font-medium",
                isDark ? "text-white" : "text-gray-900",
              )}
              numberOfLines={1}
            >
              {paymentMethod.name || brandInfo.name}
            </Text>
          )}

          {!isEditing && isDefault && (
            <View className="ml-2 rounded-full bg-primary/10 px-2 py-0.5">
              <Text className="text-xs font-medium text-primary">Default</Text>
            </View>
          )}
          {!isEditing && isExpiringSoon && (
            <View className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 flex-row items-center">
              <AlertTriangle size={10} color="#F59E0B" />
              <Text className="text-xs font-medium text-amber-500 ml-1">
                Expiring
              </Text>
            </View>
          )}
        </View>
        <Text
          className={cn(
            "text-sm font-mono mt-0.5",
            isDark ? "text-gray-400" : "text-gray-600",
          )}
        >
          {paymentMethod.name ? `${brandInfo.name} ` : ""}
          {formatCardMask(paymentMethod.card_mask)}
        </Text>
        <Muted className="text-xs mt-0.5">Expires {formatExpiry()}</Muted>
      </View>

      {/* Selection indicator or actions */}
      {selectable ? (
        <View
          className={cn(
            "w-6 h-6 rounded-full border-2 items-center justify-center",
            selected
              ? "bg-primary border-primary"
              : isDark
                ? "border-gray-600"
                : "border-gray-300",
          )}
        >
          {selected && <Check size={14} color="white" strokeWidth={3} />}
        </View>
      ) : showActions && !loading ? (
        <View className="flex-row items-center gap-1">
          {isEditing ? (
            <>
              <Pressable
                onPress={handleSaveEdit}
                className={cn(
                  "p-2 rounded-full",
                  isDark ? "active:bg-gray-700" : "active:bg-gray-100",
                )}
                hitSlop={8}
              >
                <Check size={18} color={colors.light.primary} />
              </Pressable>
              <Pressable
                onPress={handleCancelEdit}
                className={cn(
                  "p-2 rounded-full",
                  isDark ? "active:bg-gray-700" : "active:bg-gray-100",
                )}
                hitSlop={8}
              >
                <X
                  size={18}
                  color={isDark ? colors.dark.muted : colors.light.muted}
                />
              </Pressable>
            </>
          ) : (
            <>
              {onUpdateName && (
                <Pressable
                  onPress={handleStartEdit}
                  className={cn(
                    "p-2 rounded-full",
                    isDark ? "active:bg-gray-700" : "active:bg-gray-100",
                  )}
                  hitSlop={8}
                >
                  <Pencil
                    size={16}
                    color={
                      isDark
                        ? colors.dark.mutedForeground
                        : colors.light.mutedForeground
                    }
                  />
                </Pressable>
              )}
              {!isDefault && onSetDefault && (
                <Pressable
                  onPress={handleSetDefault}
                  className={cn(
                    "p-2 rounded-full",
                    isDark ? "active:bg-gray-700" : "active:bg-gray-100",
                  )}
                  hitSlop={8}
                >
                  <Check
                    size={18}
                    color={isDark ? colors.dark.muted : colors.light.muted}
                  />
                </Pressable>
              )}
              {onDelete && (
                <Pressable
                  onPress={handleDelete}
                  className={cn(
                    "p-2 rounded-full",
                    isDark ? "active:bg-gray-700" : "active:bg-gray-100",
                  )}
                  hitSlop={8}
                >
                  <Trash2 size={18} color="#EF4444" />
                </Pressable>
              )}
            </>
          )}
        </View>
      ) : loading ? (
        <ActivityIndicator size="small" color={colors.light.primary} />
      ) : null}
    </>
  );

  if (selectable || onPress) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        className={cn(
          "flex-row items-center p-4 rounded-xl border",
          selected
            ? "border-primary bg-primary/5"
            : isDark
              ? "border-gray-700 bg-gray-800/50"
              : "border-gray-200 bg-white",
          disabled && "opacity-50",
        )}
        style={({ pressed }) => ({
          opacity: pressed && !disabled ? 0.8 : disabled ? 0.5 : 1,
        })}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View
      className={cn(
        "flex-row items-center p-4 rounded-xl border",
        isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white",
      )}
    >
      {cardContent}
    </View>
  );
}

// Compact version for inline display in booking flow
export function PaymentMethodCardCompact({
  paymentMethod,
  onPress,
  selected = false,
}: {
  paymentMethod: PaymentMethod;
  onPress?: () => void;
  selected?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const brandInfo =
    CARD_BRANDS[paymentMethod.card_brand?.toLowerCase() || "unknown"] ||
    CARD_BRANDS.unknown;

  const lastFour = paymentMethod.card_mask?.slice(-4) || "****";

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center px-3 py-2 rounded-lg border",
        selected
          ? "border-primary bg-primary/5"
          : isDark
            ? "border-gray-700 bg-gray-800/30"
            : "border-gray-200 bg-gray-50",
      )}
    >
      <CreditCard
        size={16}
        color={selected ? colors.light.primary : brandInfo.color}
      />
      <Text
        className={cn(
          "text-sm font-medium ml-2",
          selected ? "text-primary" : isDark ? "text-white" : "text-gray-900",
        )}
      >
        {paymentMethod.name || brandInfo.name} •••• {lastFour}
      </Text>
      {selected && (
        <Check size={14} color={colors.light.primary} className="ml-auto" />
      )}
    </Pressable>
  );
}
