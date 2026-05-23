// components/booking/PromoCodeInput.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  Platform,
} from "react-native";
import {
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import type { AppliedPromo } from "@/hooks/usePromoCode";

interface PromoCodeInputProps {
  onPromoApplied: () => void;
  onPromoRemoved: () => void;
  appliedPromo: AppliedPromo | null;
  loading: boolean;
  error: string | null;
  onValidate: (code: string) => Promise<boolean>;
  disabled?: boolean;
  scrollViewRef?: React.RefObject<any>;
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = React.memo(
  ({
    onPromoApplied,
    onPromoRemoved,
    appliedPromo,
    loading,
    error,
    onValidate,
    disabled = false,
    scrollViewRef,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [inputCode, setInputCode] = useState("");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const containerRef = useRef<View>(null);
    const inputRef = useRef<TextInput>(null);

    const scrollToInput = useCallback(() => {
      if (!containerRef.current || !scrollViewRef?.current) return;
      const scrollView = scrollViewRef.current;
      const scrollNode = findNodeHandle(scrollView);
      const containerNode = findNodeHandle(containerRef.current);
      if (!scrollNode || !containerNode) {
        scrollView?.scrollToEnd?.({ animated: true });
        return;
      }
      containerRef.current.measureLayout(
        scrollNode,
        (_x: number, y: number) => {
          scrollView.scrollTo({ y: y - 100, animated: true });
        },
        () => {
          scrollView?.scrollToEnd?.({ animated: true });
        },
      );
    }, [scrollViewRef]);

    React.useEffect(() => {
      if (Platform.OS !== "android") return;

      const subscription = Keyboard.addListener("keyboardDidShow", () => {
        if (!isInputFocused) return;
        setTimeout(() => {
          scrollToInput();
          scrollViewRef?.current?.scrollToEnd?.({ animated: true });
        }, 50);
      });

      return () => {
        subscription.remove();
      };
    }, [isInputFocused, scrollToInput, scrollViewRef]);

    const handleApply = useCallback(async () => {
      const success = await onValidate(inputCode);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setInputCode("");
        setIsExpanded(false);
        // Notify parent to clear any selected offer (mutual exclusivity)
        onPromoApplied();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, [inputCode, onValidate, onPromoApplied]);

    const handleRemove = useCallback(() => {
      onPromoRemoved();
      setInputCode("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [onPromoRemoved]);

    const formatDiscount = (promo: AppliedPromo) => {
      if (promo.discount_type === "percentage") {
        const cap = promo.max_discount_amount
          ? ` (max $${promo.max_discount_amount})`
          : "";
        return `${promo.discount_value}% off${cap}`;
      }
      return `$${promo.discount_value} off`;
    };

    return (
      <View
        ref={containerRef}
        className={`bg-card border border-border rounded-xl p-4 mt-3 ${disabled ? "opacity-60" : ""}`}
      >
        {/* Header */}
        <Pressable
          onPress={() => {
            if (disabled || appliedPromo) return;
            const willExpand = !isExpanded;
            setIsExpanded(willExpand);
            if (willExpand) {
              setTimeout(() => {
                scrollToInput();
                inputRef.current?.focus();
              }, 150);
            }
          }}
          disabled={disabled || !!appliedPromo}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Tag size={20} color="#3b82f6" />
            <View>
              <Text className="font-semibold text-lg">Promo Code</Text>
              <Text className="text-sm text-muted-foreground">
                {appliedPromo
                  ? `${appliedPromo.code} applied`
                  : "Have a promo code?"}
              </Text>
            </View>
          </View>
          {!appliedPromo &&
            !disabled &&
            (isExpanded ? (
              <ChevronUp size={20} color="#3b82f6" />
            ) : (
              <ChevronDown size={20} color="#3b82f6" />
            ))}
        </Pressable>

        {/* Applied state */}
        {appliedPromo && (
          <View className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <CheckCircle size={18} color="#22c55e" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {appliedPromo.code}
                </Text>
                <Text className="text-xs text-green-600 dark:text-green-500">
                  {formatDiscount(appliedPromo)}
                  {appliedPromo.description
                    ? ` · ${appliedPromo.description}`
                    : ""}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleRemove}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#666" />
            </Pressable>
          </View>
        )}

        {/* Expanded input */}
        {isExpanded && !appliedPromo && (
          <View className="mt-3">
            <View className="flex-row gap-2">
              <TextInput
                ref={inputRef}
                value={inputCode}
                onChangeText={(t) => setInputCode(t.toUpperCase())}
                placeholder="Enter code"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleApply}
                onFocus={() => {
                  setIsInputFocused(true);
                  setTimeout(scrollToInput, 180);
                }}
                onBlur={() => setIsInputFocused(false)}
                editable={!loading}
                className="flex-1 border border-border rounded-xl px-4 py-3 text-foreground bg-background text-base"
                placeholderTextColor="#9ca3af"
              />
              <Pressable
                onPress={handleApply}
                disabled={loading || !inputCode.trim()}
                className={`px-5 rounded-xl items-center justify-center ${
                  loading || !inputCode.trim() ? "bg-muted" : "bg-blue-600"
                }`}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold">Apply</Text>
                )}
              </Pressable>
            </View>

            {error && (
              <Text className="text-destructive text-sm mt-2 ml-1">
                {error}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  },
);

PromoCodeInput.displayName = "PromoCodeInput";
