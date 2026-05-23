// components/booking/DepositPaymentSheet.tsx
// Bottom sheet for deposit payment - shows pricing breakdown and payment method selection

import React, { useState, useMemo } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import {
  CreditCard,
  X,
  DollarSign,
  Users,
  Info,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { SafeAreaView } from "@/components/safe-area-view";
import type { DepositCheckResult } from "@/hooks/useDepositPayment";

// Import Whish Money logo
const whishLogo = require("@/assets/whish-money.png");

export type DepositPaymentMethod = "montypay" | "whish";

export interface DepositPricing {
  depositAmount: number;
  serviceFee: number;
  serviceFeePercentage: number;
  total: number;
  currency: string;
}

interface DepositPaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (method: DepositPaymentMethod, pricing: DepositPricing) => void;
  depositInfo: DepositCheckResult;
  restaurantName: string;
  partySize: number;
  bookingDate: string;
  bookingTime: string;
  // Service fee percentages from restaurant settings
  cardServiceFeePercentage?: number;
  whishServiceFeePercentage?: number;
  loading?: boolean;
  // Whether this is a new booking (from availability page) or existing pending_payment booking
  isNewBooking?: boolean;
}

export function DepositPaymentSheet({
  visible,
  onClose,
  onConfirm,
  depositInfo,
  restaurantName,
  partySize,
  bookingDate,
  bookingTime,
  cardServiceFeePercentage = 0,
  whishServiceFeePercentage = 0,
  loading = false,
  isNewBooking = false,
}: DepositPaymentSheetProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [selectedMethod, setSelectedMethod] =
    useState<DepositPaymentMethod>("montypay");

  // Calculate pricing for both methods
  const cardPricing = useMemo((): DepositPricing => {
    const baseDeposit = depositInfo.totalDeposit;
    const serviceFee = baseDeposit * (cardServiceFeePercentage / 100);
    return {
      depositAmount: baseDeposit,
      serviceFee,
      serviceFeePercentage: cardServiceFeePercentage,
      total: baseDeposit + serviceFee,
      currency: depositInfo.currency,
    };
  }, [depositInfo, cardServiceFeePercentage]);

  const whishPricing = useMemo((): DepositPricing => {
    const baseDeposit = depositInfo.totalDeposit;
    const serviceFee = baseDeposit * (whishServiceFeePercentage / 100);
    return {
      depositAmount: baseDeposit,
      serviceFee,
      serviceFeePercentage: whishServiceFeePercentage,
      total: baseDeposit + serviceFee,
      currency: depositInfo.currency,
    };
  }, [depositInfo, whishServiceFeePercentage]);

  const currentPricing =
    selectedMethod === "montypay" ? cardPricing : whishPricing;

  const handleMethodSelect = (method: DepositPaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(method);
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(selectedMethod, currentPricing);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: depositInfo.currency || "USD",
    }).format(amount);
  };

  const getRefundPolicyText = () => {
    switch (depositInfo.refundPolicy) {
      case "full":
        return `Full refund if cancelled ${depositInfo.refundWindowHours}+ hours before`;
      case "partial":
        return `${depositInfo.partialRefundPercentage}% refund if cancelled ${depositInfo.refundWindowHours}+ hours before`;
      case "none":
        return "Non-refundable deposit";
      default:
        return "";
    }
  };

  const getRefundPolicyColor = () => {
    switch (depositInfo.refundPolicy) {
      case "full":
        return "text-green-600";
      case "partial":
        return "text-amber-600";
      case "none":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  if (!depositInfo.required) {
    return null;
  }

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
            <H3 className="dark:text-white">Pay Deposit</H3>
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
            {/* Booking Summary */}
            <View
              className={cn(
                "p-4 rounded-xl mb-4",
                isDark ? "bg-gray-800" : "bg-gray-50",
              )}
            >
              <Text className="text-lg font-bold text-foreground mb-1">
                {restaurantName}
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Users size={14} color={isDark ? "#9CA3AF" : "#6B7280"} />
                <Muted>
                  {partySize} {partySize === 1 ? "guest" : "guests"} •{" "}
                  {bookingDate} • {bookingTime}
                </Muted>
              </View>
            </View>

            {/* New Booking Payment Window Info */}
            {isNewBooking && (
              <View
                className={cn(
                  "flex-row items-start gap-3 p-3 rounded-xl mb-4",
                  isDark ? "bg-blue-900/30" : "bg-blue-50",
                )}
              >
                <View
                  className={cn(
                    "w-8 h-8 rounded-full items-center justify-center",
                    isDark ? "bg-blue-800/50" : "bg-blue-100",
                  )}
                >
                  <Clock size={16} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-sm text-blue-600 dark:text-blue-400">
                    10-Minute Payment Window
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    A pending booking will be created. You&apos;ll have 10
                    minutes to complete the payment, after which the booking
                    will be automatically cancelled.
                  </Text>
                </View>
              </View>
            )}

            {/* Refund Policy Alert */}
            <View
              className={cn(
                "flex-row items-center gap-3 p-3 rounded-xl mb-4",
                depositInfo.refundPolicy === "full"
                  ? "bg-green-50"
                  : depositInfo.refundPolicy === "partial"
                    ? "bg-amber-50"
                    : "bg-red-50",
              )}
            >
              <View
                className={cn(
                  "w-8 h-8 rounded-full items-center justify-center",
                  depositInfo.refundPolicy === "full"
                    ? "bg-green-100"
                    : depositInfo.refundPolicy === "partial"
                      ? "bg-amber-100"
                      : "bg-red-100",
                )}
              >
                {depositInfo.refundPolicy === "full" ? (
                  <RefreshCw size={16} color="#16A34A" />
                ) : depositInfo.refundPolicy === "partial" ? (
                  <Clock size={16} color="#D97706" />
                ) : (
                  <AlertCircle size={16} color="#DC2626" />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className={cn("font-medium text-sm", getRefundPolicyColor())}
                >
                  {depositInfo.refundPolicy === "full"
                    ? "Refundable Deposit"
                    : depositInfo.refundPolicy === "partial"
                      ? "Partially Refundable"
                      : "Non-Refundable"}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {getRefundPolicyText()}
                </Text>
              </View>
            </View>

            {/* Price Breakdown */}
            <View className="mb-6">
              <Text className="text-base font-semibold mb-3 dark:text-white">
                Price Breakdown
              </Text>

              {/* Deposit Amount */}
              <View className="flex-row justify-between items-center py-3 border-b border-border">
                <View>
                  <Text className="text-foreground">
                    {depositInfo.feeType === "per_cover"
                      ? `${formatCurrency(depositInfo.depositAmount)} × ${partySize} guests`
                      : "Fixed Deposit"}
                  </Text>
                </View>
                <Text className="font-medium text-foreground">
                  {formatCurrency(currentPricing.depositAmount)}
                </Text>
              </View>

              {/* Service Fee */}
              {currentPricing.serviceFee > 0 && (
                <View className="flex-row justify-between items-center py-3 border-b border-border">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground">Service Fee</Text>
                    <Muted className="text-xs">
                      ({currentPricing.serviceFeePercentage}%)
                    </Muted>
                  </View>
                  <Text className="font-medium text-foreground">
                    {formatCurrency(currentPricing.serviceFee)}
                  </Text>
                </View>
              )}

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
                {/* Card Option (MontyPay) */}
                <Pressable
                  onPress={() => handleMethodSelect("montypay")}
                  className={cn(
                    "p-4 rounded-xl border-2 flex-row items-center",
                    selectedMethod === "montypay"
                      ? "border-primary bg-primary/5"
                      : isDark
                        ? "border-gray-700 bg-gray-800"
                        : "border-gray-200 bg-white",
                  )}
                >
                  <View
                    className={cn(
                      "w-12 h-12 rounded-full items-center justify-center",
                      selectedMethod === "montypay"
                        ? "bg-primary/10"
                        : "bg-muted",
                    )}
                  >
                    <CreditCard
                      size={24}
                      color={
                        selectedMethod === "montypay"
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
                        selectedMethod === "montypay"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      Credit / Debit Card
                    </Text>
                    <Muted className="text-xs mt-0.5">Visa, Mastercard</Muted>
                  </View>
                  <View className="items-end">
                    <Text
                      className={cn(
                        "font-bold",
                        selectedMethod === "montypay"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {formatCurrency(cardPricing.total)}
                    </Text>
                    {cardPricing.serviceFeePercentage > 0 && (
                      <Muted className="text-xs">
                        ({cardPricing.serviceFeePercentage}% fee)
                      </Muted>
                    )}
                  </View>
                  {selectedMethod === "montypay" && (
                    <CheckCircle2
                      size={20}
                      color={colors.light.primary}
                      style={{ marginLeft: 8 }}
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
                      "w-12 h-12 rounded-full items-center justify-center overflow-hidden",
                      selectedMethod === "whish" ? "bg-white" : "bg-white",
                    )}
                  >
                    <Image
                      source={whishLogo}
                      style={{ width: 40, height: 40 }}
                      resizeMode="contain"
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
                    {whishPricing.serviceFeePercentage > 0 && (
                      <Muted className="text-xs">
                        ({whishPricing.serviceFeePercentage}% fee)
                      </Muted>
                    )}
                  </View>
                  {selectedMethod === "whish" && (
                    <CheckCircle2
                      size={20}
                      color={colors.light.primary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Info Note */}
            <View className="flex-row items-start gap-2 mb-6">
              <Info size={14} color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Muted className="text-xs flex-1">
                You will be redirected to a secure payment page. Your booking
                will be confirmed once the deposit is successfully paid.
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
                  {selectedMethod === "montypay" ? (
                    <CreditCard size={20} color="white" />
                  ) : (
                    <Image
                      source={whishLogo}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                    />
                  )}
                  <Text className="text-white font-bold text-lg">
                    Pay {formatCurrency(currentPricing.total)} Deposit
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
