// components/events/EventPaymentSheet.tsx
// Bottom sheet for event payment - shows pricing breakdown and payment method selection

import React, { useState, useMemo } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  CreditCard,
  Wallet,
  X,
  DollarSign,
  Users,
  Info,
  CheckCircle2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { SafeAreaView } from "@/components/safe-area-view";
import type {
  RestaurantEvent,
  EventPaymentMethod,
  EventPricing,
} from "@/types/events";
import { calculateEventPricing, isEventPaid } from "@/types/events";

interface EventPaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pricing: EventPricing) => void;
  event: RestaurantEvent;
  partySize: number;
  eventDate: string;
  loading?: boolean;
}

export function EventPaymentSheet({
  visible,
  onClose,
  onConfirm,
  event,
  partySize,
  eventDate,
  loading = false,
}: EventPaymentSheetProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [selectedMethod, setSelectedMethod] =
    useState<EventPaymentMethod>("card");

  // Calculate pricing for both methods
  const cardPricing = useMemo(
    () => calculateEventPricing(event, partySize, "card"),
    [event, partySize],
  );
  const whishPricing = useMemo(
    () => calculateEventPricing(event, partySize, "whish"),
    [event, partySize],
  );

  // Current pricing based on selected method
  const currentPricing = selectedMethod === "card" ? cardPricing : whishPricing;

  // If event is not paid, don't render
  if (!isEventPaid(event) || !currentPricing) {
    return null;
  }

  const handleMethodSelect = (method: EventPaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(method);
  };

  const handleConfirm = () => {
    if (!currentPricing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(currentPricing);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-row items-center gap-2">
            <DollarSign size={24} color={colors.light.primary} />
            <H3 className="dark:text-white">Complete Payment</H3>
          </View>
          <Pressable
            onPress={onClose}
            className="w-8 h-8 items-center justify-center rounded-full bg-muted"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color={isDark ? "#FFF" : "#000"} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* Event Summary */}
            <View
              className={cn(
                "p-4 rounded-xl mb-4",
                isDark ? "bg-gray-800" : "bg-gray-50",
              )}
            >
              <Text className="text-lg font-bold text-foreground mb-1">
                {event.title}
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Users size={14} color={isDark ? "#9CA3AF" : "#6B7280"} />
                <Muted>
                  {partySize} {partySize === 1 ? "guest" : "guests"} •{" "}
                  {eventDate}
                </Muted>
              </View>
            </View>

            {/* Price Breakdown */}
            <View className="mb-6">
              <Text className="text-base font-semibold mb-3 dark:text-white">
                Price Breakdown
              </Text>

              {/* Subtotal */}
              <View className="flex-row justify-between items-center py-3 border-b border-border">
                <View>
                  <Text className="text-foreground">
                    {formatCurrency(currentPricing.pricePerPerson)} ×{" "}
                    {partySize} {partySize === 1 ? "guest" : "guests"}
                  </Text>
                </View>
                <Text className="font-medium text-foreground">
                  {formatCurrency(currentPricing.subtotal)}
                </Text>
              </View>

              {/* Service Fee */}
              <View className="flex-row justify-between items-center py-3 border-b border-border">
                <View className="flex-row items-center gap-2">
                  <Text className="text-foreground">Service Fee</Text>
                  <Muted className="text-xs">
                    ({currentPricing.serviceChargePercentage}%)
                  </Muted>
                </View>
                <Text className="font-medium text-foreground">
                  {formatCurrency(currentPricing.serviceChargeAmount)}
                </Text>
              </View>

              {/* Total */}
              <View className="flex-row justify-between items-center py-4">
                <Text className="text-lg font-bold text-foreground">Total</Text>
                <Text className="text-xl font-bold text-primary">
                  {formatCurrency(currentPricing.total)}
                </Text>
              </View>
            </View>

            {/* Payment Method Selection */}
            <View className="mb-6">
              <Text className="text-base font-semibold mb-3 dark:text-white">
                Payment Method
              </Text>

              <View className="gap-3">
                {/* Card Option */}
                <Pressable
                  onPress={() => handleMethodSelect("card")}
                  className={cn(
                    "p-4 rounded-xl border-2 flex-row items-center",
                    selectedMethod === "card"
                      ? "border-primary bg-primary/5"
                      : isDark
                        ? "border-gray-700 bg-gray-800"
                        : "border-gray-200 bg-white",
                  )}
                >
                  <View
                    className={cn(
                      "w-12 h-12 rounded-full items-center justify-center",
                      selectedMethod === "card" ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <CreditCard
                      size={24}
                      color={
                        selectedMethod === "card"
                          ? colors.light.primary
                          : isDark
                            ? "#9CA3AF"
                            : "#6B7280"
                      }
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className={cn(
                        "font-semibold",
                        selectedMethod === "card"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      Credit / Debit Card
                    </Text>
                    <Muted className="text-xs mt-0.5">Visa, Mastercard</Muted>
                  </View>
                  {cardPricing && (
                    <View className="items-end">
                      <Text
                        className={cn(
                          "font-bold",
                          selectedMethod === "card"
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {formatCurrency(cardPricing.total)}
                      </Text>
                      <Muted className="text-xs">
                        ({cardPricing.serviceChargePercentage}% fee)
                      </Muted>
                    </View>
                  )}
                  {selectedMethod === "card" && (
                    <CheckCircle2
                      size={20}
                      color={colors.light.primary}
                      className="ml-2"
                    />
                  )}
                </Pressable>

                {/* Whish Option */}
                <Pressable
                  onPress={() => handleMethodSelect("whish")}
                  className={cn(
                    "p-4 rounded-xl border-2 flex-row items-center",
                    selectedMethod === "whish"
                      ? "border-primary bg-primary/5"
                      : isDark
                        ? "border-gray-700 bg-gray-800"
                        : "border-gray-200 bg-white",
                  )}
                >
                  <View
                    className={cn(
                      "w-12 h-12 rounded-full items-center justify-center",
                      selectedMethod === "whish" ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <Wallet
                      size={24}
                      color={
                        selectedMethod === "whish"
                          ? colors.light.primary
                          : isDark
                            ? "#9CA3AF"
                            : "#6B7280"
                      }
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className={cn(
                        "font-semibold",
                        selectedMethod === "whish"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      Whish Money
                    </Text>
                    <Muted className="text-xs mt-0.5">Mobile Wallet</Muted>
                  </View>
                  {whishPricing && (
                    <View className="items-end">
                      <Text
                        className={cn(
                          "font-bold",
                          selectedMethod === "whish"
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {formatCurrency(whishPricing.total)}
                      </Text>
                      <Muted className="text-xs">
                        ({whishPricing.serviceChargePercentage}% fee)
                      </Muted>
                    </View>
                  )}
                  {selectedMethod === "whish" && (
                    <CheckCircle2
                      size={20}
                      color={colors.light.primary}
                      className="ml-2"
                    />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Info Note */}
            <View className="flex-row items-start gap-2 mb-6">
              <Info size={14} color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Muted className="text-xs flex-1">
                You will be redirected to a secure payment page to complete your
                transaction. Your booking will be confirmed once payment is
                successful.
              </Muted>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View className="p-4 border-t border-border bg-background">
          <Button
            onPress={handleConfirm}
            size="lg"
            className="w-full"
            disabled={loading}
          >
            <View className="flex-row items-center justify-center gap-2">
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  {selectedMethod === "card" ? (
                    <CreditCard size={20} color="white" />
                  ) : (
                    <Wallet size={20} color="white" />
                  )}
                  <Text className="text-white font-bold text-lg">
                    Pay {formatCurrency(currentPricing.total)}
                  </Text>
                </>
              )}
            </View>
          </Button>
          <Pressable onPress={onClose} className="mt-3 py-2 items-center">
            <Text className="text-muted-foreground">Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
