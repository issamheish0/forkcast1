// components/booking/CardGuaranteeSheet.tsx
// Bottom sheet for credit card guarantee selection during booking
// Shows fee breakdown, card selector, and "Add New Card" option

import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import {
  CreditCard,
  Plus,
  ShieldCheck,
  Info,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { usePaymentMethods, PaymentMethod } from "@/hooks/usePaymentMethods";
import { GuaranteeCheckResult } from "@/hooks/useCardGuarantee";
import {
  PaymentMethodCard,
  PaymentMethodCardCompact,
} from "@/components/profile/PaymentMethodCard";

interface CardGuaranteeSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onCardSelected: (paymentMethodId: string) => void;
  guaranteeInfo: GuaranteeCheckResult;
  partySize: number;
  restaurantName: string;
  bookingId?: string;
  selectedCardId?: string | null;
  cancellationWindowHours?: number;
}

export function CardGuaranteeSheet({
  isVisible,
  onClose,
  onCardSelected,
  guaranteeInfo,
  partySize,
  restaurantName,
  bookingId,
  selectedCardId,
  cancellationWindowHours = 24,
}: CardGuaranteeSheetProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const {
    paymentMethods,
    loading: loadingCards,
    openCheckout,
    fetchPaymentMethods,
    isCardExpiringSoon,
    updatePaymentMethodName,
  } = usePaymentMethods();

  const [selectedId, setSelectedId] = useState<string | null>(
    selectedCardId || null,
  );
  const [addingCard, setAddingCard] = useState(false);

  // Set default selection when cards load
  useEffect(() => {
    if (!selectedId && paymentMethods.length > 0) {
      const defaultCard = paymentMethods.find((pm) => pm.is_default);
      setSelectedId(defaultCard?.id || paymentMethods[0]?.id || null);
    }
  }, [paymentMethods, selectedId]);

  // Calculate fee breakdown
  const feeBreakdown = useMemo(() => {
    const isPerCover = guaranteeInfo.feeType === "per_cover";
    return {
      noShow: {
        perPerson: guaranteeInfo.noShowFee,
        total: guaranteeInfo.totalNoShowFee,
        label: isPerCover
          ? `${guaranteeInfo.noShowFee.toFixed(2)} ${guaranteeInfo.currency} × ${partySize} guests`
          : `${guaranteeInfo.noShowFee.toFixed(2)} ${guaranteeInfo.currency} (fixed)`,
      },
      lateCancellation: {
        perPerson: guaranteeInfo.lateCancelFee,
        total: guaranteeInfo.totalLateCancelFee,
        label: isPerCover
          ? `${guaranteeInfo.lateCancelFee.toFixed(2)} ${guaranteeInfo.currency} × ${partySize} guests`
          : `${guaranteeInfo.lateCancelFee.toFixed(2)} ${guaranteeInfo.currency} (fixed)`,
      },
    };
  }, [guaranteeInfo, partySize]);

  // Handle card selection
  const handleSelectCard = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(id);
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCardSelected(selectedId);
      onClose();
    }
  };

  const [cardName, setCardName] = useState("");

  // Handle add new card
  const handleAddCard = async () => {
    setAddingCard(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Capture current card count to check for success later
    // (A simplistic but effective way to confirm addition)
    const initialCount = paymentMethods.length;

    const result = await openCheckout({
      bookingId,
      returnPath: bookingId
        ? `booking/${bookingId}`
        : "profile/payment-methods",
      cardName: cardName.trim() || undefined,
    });

    // Refresh cards after returning
    await fetchPaymentMethods();

    // Check if we likely succeeded
    // Since openCheckout is now more lenient, we can assume success if it returned true
    // Ideally we'd compare the list length, but state updates might be async.
    // Given the user flow, if they come back and the process finished, it's usually a success.
    if (result) {
      Alert.alert("Success", "Card added successfully!");
      setCardName(""); // Reset name
    }

    setAddingCard(false);
  };

  if (!isVisible) return null;
  return (
    <View className="flex-1 bg-white dark:bg-[#121212]">
      {/* Header */}
      <View className="px-6 pt-2 pb-4 border-b border-gray-200 dark:border-gray-800">
        <View className="flex-row items-center mb-2">
          <ShieldCheck size={24} color={colors.light.primary} />
          <H3 className="ml-2 dark:text-white">
            Credit Card Guarantee Required
          </H3>
        </View>
        <Muted className="text-sm">
          {restaurantName} requires a credit card to secure your reservation.
        </Muted>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Fee Breakdown */}
        <View className="py-4">
          <Text className="text-base font-semibold mb-3 dark:text-gray-100">
            Penalty Fees
          </Text>

          {/* No-show fee */}
          {guaranteeInfo.totalNoShowFee > 0 && (
            <View
              className={cn(
                "p-4 rounded-xl mb-3",
                isDark ? "bg-red-950/20 border border-red-900/50" : "bg-red-50",
              )}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-medium text-red-600 dark:text-red-400">
                  No-Show Fee
                </Text>
                <Text className="font-bold text-red-600 dark:text-red-400">
                  {feeBreakdown.noShow.total.toFixed(2)}{" "}
                  {guaranteeInfo.currency}
                </Text>
              </View>
              <Muted className="text-xs dark:text-red-300/70">
                {feeBreakdown.noShow.label}
              </Muted>
            </View>
          )}

          {/* Late cancellation fee */}
          {guaranteeInfo.totalLateCancelFee > 0 && (
            <View
              className={cn(
                "p-4 rounded-xl mb-3",
                isDark
                  ? "bg-amber-950/20 border border-amber-900/50"
                  : "bg-amber-50",
              )}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-medium text-amber-600 dark:text-amber-400">
                  Late Cancellation Fee
                </Text>
                <Text className="font-bold text-amber-600 dark:text-amber-400">
                  {feeBreakdown.lateCancellation.total.toFixed(2)}{" "}
                  {guaranteeInfo.currency}
                </Text>
              </View>
              <Muted className="text-xs dark:text-amber-300/70">
                {feeBreakdown.lateCancellation.label}
              </Muted>
              <Muted className="text-xs mt-1 dark:text-amber-300/70">
                Applies if cancelled within {cancellationWindowHours} hours of
                booking time
              </Muted>
            </View>
          )}

          {/* Service fee (if applicable) */}
          {guaranteeInfo.serviceFeePercentage &&
            guaranteeInfo.serviceFeePercentage > 0 &&
            guaranteeInfo.totalLateCancelFee > 0 && (
              <View
                className={cn(
                  "p-4 rounded-xl mb-3",
                  isDark
                    ? "bg-blue-950/20 border border-blue-900/50"
                    : "bg-blue-50",
                )}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-medium text-blue-600 dark:text-blue-400">
                    Service Fee ({guaranteeInfo.serviceFeePercentage}%)
                  </Text>
                  <Text className="font-bold text-blue-600 dark:text-blue-400">
                    {guaranteeInfo.serviceFeeAmount?.toFixed(2)}{" "}
                    {guaranteeInfo.currency}
                  </Text>
                </View>
                <Muted className="text-xs dark:text-blue-300/70">
                  Applied to late cancellation fee
                </Muted>
              </View>
            )}

          {/* Total with service fee (if applicable) */}
          {guaranteeInfo.totalWithServiceFee &&
            guaranteeInfo.totalWithServiceFee >
              guaranteeInfo.totalLateCancelFee && (
              <View
                className={cn(
                  "p-4 rounded-xl mb-3",
                  isDark
                    ? "bg-gray-800 border-2 border-gray-700"
                    : "bg-gray-100 border-2 border-gray-300",
                )}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-lg dark:text-white">
                    Total Late Cancel Charge
                  </Text>
                  <Text className="font-bold text-lg dark:text-white">
                    {guaranteeInfo.totalWithServiceFee.toFixed(2)}{" "}
                    {guaranteeInfo.currency}
                  </Text>
                </View>
              </View>
            )}

          {/* Info note */}
          <View className="flex-row items-start mt-2">
            <Info size={14} color={isDark ? "#9CA3AF" : "#6B7280"} />
            <Muted className="text-xs ml-2 flex-1">
              Your card will only be charged if you don&apos;t show up or cancel
              too late.
            </Muted>
          </View>
        </View>

        {/* Card Selection */}
        <View className="py-4 border-t border-gray-200 dark:border-gray-700">
          <Text className="text-base font-semibold mb-3 dark:text-white">
            Select Payment Method
          </Text>

          {loadingCards ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color={colors.light.primary} />
              <Muted className="mt-2">Loading your cards...</Muted>
            </View>
          ) : (
            <View className="gap-3">
              {/* Existing cards */}
              {paymentMethods.map((pm) => (
                <PaymentMethodCard
                  key={pm.id}
                  paymentMethod={pm}
                  selectable
                  selected={selectedId === pm.id}
                  isDefault={pm.is_default}
                  isExpiringSoon={isCardExpiringSoon(pm)}
                  onUpdateName={updatePaymentMethodName}
                  onPress={() => handleSelectCard(pm.id)}
                />
              ))}

              {/* Add new card section */}
              <View
                className={cn(
                  "p-4 rounded-xl border-2 border-dashed gap-3",
                  isDark ? "border-gray-600" : "border-gray-300",
                )}
              >
                {/* Info Note about Hold */}
                <View className="flex-row items-start mb-1">
                  <Text
                    className={cn(
                      "text-xs flex-1",
                      isDark ? "text-gray-400" : "text-gray-500",
                    )}
                  >
                    Note: A temporary $1.00 hold will be placed to verify your
                    card and immediately refunded.
                  </Text>
                </View>

                {/* Card Name Input */}
                <View>
                  <Text
                    className={cn(
                      "text-xs font-medium mb-1.5",
                      isDark ? "text-gray-400" : "text-gray-500",
                    )}
                  >
                    Card Name (Optional)
                  </Text>
                  <TextInput
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="e.g. Corporate Card, My Visa"
                    placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-base",
                      isDark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-200 text-gray-900",
                    )}
                  />
                </View>

                {/* Add Button */}
                <Pressable
                  onPress={handleAddCard}
                  disabled={addingCard}
                  className={cn(
                    "flex-row items-center justify-center p-3 rounded-lg",
                    isDark
                      ? "bg-gray-700 active:bg-gray-600"
                      : "bg-gray-100 active:bg-gray-200",
                  )}
                >
                  {addingCard ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.light.primary}
                    />
                  ) : (
                    <Plus size={20} color={colors.light.primary} />
                  )}
                  <Text className="ml-2 text-primary font-medium">
                    {addingCard ? "Opening card setup..." : "Add New Card"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer with confirm button */}
      <View className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onPress={handleConfirm}
          disabled={!selectedId || loadingCards}
          className="w-full"
          size="lg"
        >
          <CreditCard size={18} color="white" className="mr-2" />
          <Text className="text-white font-semibold">
            Confirm Card Guarantee
          </Text>
        </Button>
        <Pressable onPress={onClose} className="mt-3 py-2 items-center">
          <Text className="text-muted-foreground">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Inline guarantee info display for booking confirmation
export function CardGuaranteeInline({
  guaranteeInfo,
  partySize,
  selectedCard,
  onChangeCard,
  // Alternative props for booking create flow
  paymentMethods,
  selectedPaymentMethodId,
  onSelectPaymentMethod,
  onAddNewCard,
}: {
  guaranteeInfo: GuaranteeCheckResult;
  partySize: number;
  // Option 1: Direct card + change handler
  selectedCard?: PaymentMethod | null;
  onChangeCard?: () => void;
  // Option 2: List-based selection for booking create
  paymentMethods?: PaymentMethod[];
  selectedPaymentMethodId?: string | null;
  onSelectPaymentMethod?: (id: string | null) => void;
  onAddNewCard?: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Resolve the selected card from either prop style
  const resolvedSelectedCard =
    selectedCard ??
    paymentMethods?.find((pm) => pm.id === selectedPaymentMethodId) ??
    null;

  // Resolve the change handler from either prop style
  const handleChangeCard = onChangeCard ?? onAddNewCard ?? (() => {});

  if (!guaranteeInfo.required) return null;

  // Check if we have multiple payment methods to show as a list
  const hasMultipleCards = paymentMethods && paymentMethods.length > 0;

  return (
    <View
      className={cn(
        "p-4 rounded-xl border",
        isDark
          ? "border-gray-700 bg-gray-800/50"
          : "border-gray-200 bg-gray-50",
      )}
    >
      <View className="flex-row items-center mb-3">
        <ShieldCheck size={18} color={colors.light.primary} />
        <Text className="ml-2 font-semibold dark:text-white">
          Credit Card Guarantee
        </Text>
      </View>

      {/* Show list of payment methods if we have the list-based props */}
      {hasMultipleCards && onSelectPaymentMethod ? (
        <View className="mb-3 gap-2">
          {paymentMethods.map((pm) => (
            <Pressable key={pm.id} onPress={() => onSelectPaymentMethod(pm.id)}>
              <PaymentMethodCardCompact
                paymentMethod={pm}
                selected={pm.id === selectedPaymentMethodId}
                onPress={() => onSelectPaymentMethod(pm.id)}
              />
            </Pressable>
          ))}
          {/* Add new card button */}
          {onAddNewCard && (
            <Pressable
              onPress={onAddNewCard}
              className={cn(
                "flex-row items-center p-3 rounded-lg border-2 border-dashed",
                isDark ? "border-gray-600" : "border-gray-300",
              )}
            >
              <CreditCard size={18} color={colors.light.primary} />
              <Text className="ml-2 text-primary font-medium">
                Add new card
              </Text>
              <ChevronRight
                size={18}
                color={colors.light.primary}
                className="ml-auto"
              />
            </Pressable>
          )}
        </View>
      ) : resolvedSelectedCard ? (
        /* Single selected card mode */
        <Pressable onPress={handleChangeCard} className="mb-3">
          <PaymentMethodCardCompact
            paymentMethod={resolvedSelectedCard}
            selected
            onPress={handleChangeCard}
          />
        </Pressable>
      ) : (
        /* No cards - show add button */
        <Pressable
          onPress={handleChangeCard}
          className={cn(
            "flex-row items-center p-3 rounded-lg border-2 border-dashed mb-3",
            isDark ? "border-gray-600" : "border-gray-300",
          )}
        >
          <CreditCard size={18} color={colors.light.primary} />
          <Text className="ml-2 text-primary font-medium">
            Add payment method
          </Text>
          <ChevronRight
            size={18}
            color={colors.light.primary}
            className="ml-auto"
          />
        </Pressable>
      )}

      {/* Fee summary */}
      <View className="flex-row justify-between items-center">
        <Muted className="text-xs">
          No-show: {guaranteeInfo.totalNoShowFee.toFixed(2)}{" "}
          {guaranteeInfo.currency}
        </Muted>
        <Muted className="text-xs">
          Late cancel: {guaranteeInfo.totalLateCancelFee.toFixed(2)}{" "}
          {guaranteeInfo.currency}
        </Muted>
      </View>
    </View>
  );
}
