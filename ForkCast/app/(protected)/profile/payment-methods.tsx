// app/(protected)/profile/payment-methods.tsx
// Payment Methods management screen
// Lists saved cards, allows adding new cards and managing defaults

import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, TextInput, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CreditCard,
  Plus,
  ShieldCheck,
  AlertCircle,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { BackHeader } from "@/components/ui/back-header";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { OptimizedList } from "@/components/ui/optimized-list";
import { PaymentMethodCard } from "@/components/profile/PaymentMethodCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { usePaymentMethods, PaymentMethod } from "@/hooks/usePaymentMethods";
import { colors } from "@/constants/colors";
import { cn } from "@/lib/utils";

// Skeleton for loading state
function PaymentMethodsSkeleton() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="px-4 py-6">
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          className={cn(
            "flex-row items-center p-4 rounded-xl mb-3",
            isDark ? "bg-gray-800/50" : "bg-gray-100",
          )}
        >
          <View
            className={cn(
              "w-12 h-9 rounded-md",
              isDark ? "bg-gray-700" : "bg-gray-200",
            )}
          />
          <View className="ml-3 flex-1">
            <View
              className={cn(
                "h-4 w-24 rounded mb-2",
                isDark ? "bg-gray-700" : "bg-gray-200",
              )}
            />
            <View
              className={cn(
                "h-3 w-40 rounded",
                isDark ? "bg-gray-700" : "bg-gray-200",
              )}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// Empty state component
function EmptyState({
  onAddCard,
  addingCard,
}: {
  onAddCard: () => void;
  addingCard: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="flex-1 justify-center px-6 py-12">
      <View
        className={cn(
          "rounded-2xl p-8 mx-2",
          isDark ? "bg-gray-800/80" : "bg-gray-50",
        )}
      >
        <View
          className={cn(
            "w-16 h-16 rounded-2xl items-center justify-center mb-5",
            isDark ? "bg-gray-700" : "bg-white",
          )}
        >
          <CreditCard size={32} color={colors.light.primary} />
        </View>
        <Text
          className={cn(
            "text-lg font-semibold text-center mb-1.5",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          No Payment Methods
        </Text>
        <Muted className="text-center mb-4 text-sm max-w-xs mx-auto">
          Add a credit card to enable credit card guarantees for restaurant
          bookings that require them.
        </Muted>

        <View
          className={cn(
            "rounded-xl p-3 mb-5",
            isDark ? "bg-gray-700/50" : "bg-amber-50",
          )}
        >
          <Text
            className={cn(
              "text-xs text-center",
              isDark ? "text-gray-400" : "text-amber-800",
            )}
          >
            A temporary $1.00 hold will be placed to verify your card and
            immediately refunded.
          </Text>
        </View>

        <Button
          onPress={onAddCard}
          disabled={addingCard}
          className="rounded-xl h-12 min-h-12"
          accessibilityLabel={addingCard ? "Adding card" : "Add card"}
        >
          {addingCard ? (
            <>
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold ml-2">
                Opening card setup…
              </Text>
            </>
          ) : (
            <>
              <Plus size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Add Card</Text>
            </>
          )}
        </Button>
      </View>
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ payment_status?: string | string[] }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = isDark ? colors.dark : colors.light;

  const {
    paymentMethods,
    loading,
    refreshing,
    fetchPaymentMethods,
    deletePaymentMethod,
    setDefaultPaymentMethod,
    openCheckout,
    isCardExpiringSoon,
    updatePaymentMethodName,
  } = usePaymentMethods();

  const [addingCard, setAddingCard] = useState(false);
  const [cardName, setCardName] = useState("");

  const [toast, setToast] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const lastPaymentStatusHandledAtRef = useRef<number>(0);
  const postCheckoutBeforeIdsRef = useRef<Set<string> | null>(null);
  const postCheckoutTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const rawStatus = params.payment_status;
    const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

    if (!status) return;

    if (status === "success") {
      Alert.alert("Success", "Card added successfully.");
      void fetchPaymentMethods();
    } else if (status === "failed" || status === "error") {
      setToast({
        variant: "error",
        message: "Card setup failed. Please try again.",
      });
      const timeoutId = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timeoutId);
    } else {
      return;
    }

    lastPaymentStatusHandledAtRef.current = Date.now();
    router.setParams({ payment_status: undefined as unknown as string });
  }, [params.payment_status, fetchPaymentMethods, router]);

  useEffect(() => {
    const beforeIds = postCheckoutBeforeIdsRef.current;
    if (!beforeIds) return;

    const afterIds = new Set(paymentMethods.map((pm) => pm.id));
    const hasNewCard = Array.from(afterIds).some((id) => !beforeIds.has(id));

    if (!hasNewCard) return;

    if (postCheckoutTimeoutIdRef.current) {
      clearTimeout(postCheckoutTimeoutIdRef.current);
      postCheckoutTimeoutIdRef.current = null;
    }

    postCheckoutBeforeIdsRef.current = null;
    Alert.alert("Success", "Card added successfully.");
  }, [paymentMethods]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    await fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // Handle add new card
  const handleAddCard = async () => {
    setAddingCard(true);
    const beforeIds = new Set(paymentMethods.map((pm) => pm.id));

    const didOpen = await openCheckout({
      returnPath: "profile/payment-methods",
      cardName: cardName.trim() || undefined,
    });

    if (didOpen) {
      setCardName(""); // Reset name if valid
    }

    if (!didOpen) {
      setToast({ variant: "error", message: "Card setup cancelled" });
      setTimeout(() => setToast(null), 3000);
      setAddingCard(false);
      return;
    }

    // If the deep link already supplied `payment_status`, don't double-toast.
    if (Date.now() - lastPaymentStatusHandledAtRef.current < 5000) {
      setAddingCard(false);
      return;
    }

    // Fallback: user closed the browser / deep link didn't fire.
    postCheckoutBeforeIdsRef.current = beforeIds;
    await fetchPaymentMethods();

    // If nothing shows up shortly after returning, show a clear message.
    if (postCheckoutTimeoutIdRef.current) {
      clearTimeout(postCheckoutTimeoutIdRef.current);
    }
    postCheckoutTimeoutIdRef.current = setTimeout(() => {
      if (!postCheckoutBeforeIdsRef.current) return;

      postCheckoutBeforeIdsRef.current = null;
      postCheckoutTimeoutIdRef.current = null;

      setToast({
        variant: "error",
        message: "No card was added. Please try again.",
      });
      setTimeout(() => setToast(null), 3000);
    }, 3500);
    setAddingCard(false);
  };

  // Render individual payment method
  const renderPaymentMethod = useCallback(
    ({ item }: { item: PaymentMethod }) => {
      return (
        <View className="px-4 mb-3">
          <PaymentMethodCard
            paymentMethod={item}
            isDefault={item.is_default}
            isExpiringSoon={isCardExpiringSoon(item)}
            // @ts-ignore
            onDelete={() => deletePaymentMethod(item.id)}
            // @ts-ignore
            onSetDefault={() => setDefaultPaymentMethod(item.id)}
            onUpdateName={updatePaymentMethodName}
            showActions
          />
        </View>
      );
    },
    [deletePaymentMethod, setDefaultPaymentMethod, isCardExpiringSoon],
  );

  // Key extractor
  const keyExtractor = useCallback((item: PaymentMethod) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <BackHeader title="Payment Methods" />

      {toast && toast.variant === "error" ? (
        <View
          pointerEvents="none"
          className="absolute left-4 right-4 top-14 z-50"
        >
          <View className="flex-row items-center rounded-xl border border-destructive/30 bg-destructive/15 p-3">
            <AlertCircle size={18} color={themeColors.destructive} />
            <Text className="ml-2 text-sm font-medium dark:text-white">
              {toast.message}
            </Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <PaymentMethodsSkeleton />
      ) : paymentMethods.length === 0 ? (
        <EmptyState onAddCard={handleAddCard} addingCard={addingCard} />
      ) : (
        <OptimizedList
          data={paymentMethods}
          renderItem={renderPaymentMethod}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
          onRefresh={onRefresh}
          refreshing={refreshing}
          listProps={{ keyboardShouldPersistTaps: "handled" }}
          ListHeaderComponent={
            <View className="px-4 mb-2">
              {/* Info banner */}
              <View
                className={cn(
                  "flex-row items-start p-4 rounded-2xl mb-3",
                  isDark
                    ? "bg-blue-950/40 border border-blue-800/30"
                    : "bg-blue-50 border border-blue-100",
                )}
              >
                <View
                  className={cn(
                    "w-9 h-9 rounded-xl items-center justify-center",
                    isDark ? "bg-blue-900/50" : "bg-blue-100",
                  )}
                >
                  <ShieldCheck size={20} color={colors.light.primary} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-sm mb-0.5 dark:text-white">
                    Credit Card Guarantees
                  </Text>
                  <Muted className="text-xs leading-4">
                    Some restaurants require a card on file. Your card is only
                    charged if you no-show or cancel too late.
                  </Muted>
                </View>
              </View>

              {/* Expiring cards warning */}
              {paymentMethods.some((pm) => isCardExpiringSoon(pm)) && (
                <View
                  className={cn(
                    "flex-row items-start p-4 rounded-2xl mb-3",
                    isDark
                      ? "bg-amber-950/30 border border-amber-800/30"
                      : "bg-amber-50 border border-amber-200",
                  )}
                >
                  <View className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 items-center justify-center">
                    <AlertCircle size={20} color="#F59E0B" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-sm mb-0.5 text-amber-700 dark:text-amber-400">
                      Card Expiring Soon
                    </Text>
                    <Muted className="text-xs leading-4">
                      Add a new card to avoid issues with upcoming bookings.
                    </Muted>
                  </View>
                </View>
              )}
            </View>
          }
          ListFooterComponent={
            <View className="px-4 pt-2 pb-6">
              {/* Card Name Input (Optional) */}
              <View className="mb-4">
                <Text
                  className={cn(
                    "text-xs font-medium mb-2",
                    isDark ? "text-gray-400" : "text-gray-600",
                  )}
                >
                  Card name (optional)
                </Text>
                <TextInput
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="e.g. Corporate Card, My Visa"
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  editable={!addingCard}
                  className={cn(
                    "px-4 py-3.5 rounded-xl border text-base",
                    isDark
                      ? "bg-gray-800 border-gray-600 text-white"
                      : "bg-white border-gray-200 text-gray-900",
                  )}
                />
              </View>

              {/* Add new card button */}
              <Button
                onPress={handleAddCard}
                disabled={addingCard}
                className="rounded-xl h-12 min-h-12 w-full"
                accessibilityLabel={addingCard ? "Adding card" : "Add new card"}
              >
                {addingCard ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Opening card setup…
                    </Text>
                  </>
                ) : (
                  <>
                    <Plus size={20} color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Add New Card
                    </Text>
                  </>
                )}
              </Button>

              {/* Disclaimer + legal */}
              <View
                className={cn(
                  "rounded-xl p-3 mt-4",
                  isDark ? "bg-gray-800/50" : "bg-gray-50",
                )}
              >
                <Text
                  className={cn(
                    "text-xs text-center leading-4",
                    isDark ? "text-gray-400" : "text-gray-500",
                  )}
                >
                  A $1.00 temporary hold verifies your card and is refunded.
                  Card data is processed by MontyPay; we never store your full
                  number or CVV.
                </Text>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
