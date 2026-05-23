// components/booking/ModificationCTA.tsx
import React from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { X, CreditCard } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface ModificationCTAProps {
  hasChanges: boolean;
  canSave: boolean;
  submitting: boolean;
  validationErrors: { field: string; message: string }[];
  onSave: () => void;
  onCancel: () => void;
  requiresDeposit?: boolean;
  onPayDeposit?: () => void;
  checkingPayment?: boolean;
}

export const ModificationCTA: React.FC<ModificationCTAProps> = ({
  hasChanges,
  canSave,
  submitting,
  validationErrors,
  onSave,
  onCancel,
  requiresDeposit = false,
  onPayDeposit,
  checkingPayment = false,
}) => {
  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        "Discard Changes?",
        "Are you sure you want to discard your changes?",
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: onCancel },
        ],
      );
    } else {
      onCancel();
    }
  };

  // Filter out deposit-related errors from display (since we show a special button for it)
  const displayErrors = requiresDeposit
    ? validationErrors.filter(
        (e) => e.field !== "payment" || !e.message.includes("deposit"),
      )
    : validationErrors;

  return (
    <View className="border-t border-border bg-background p-4 pb-6">
      {/* Validation Errors */}
      {displayErrors.length > 0 && (
        <View className="mb-4">
          {displayErrors.map((error, index) => (
            <View
              key={index}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-2 flex-row items-start gap-2"
            >
              <X size={16} color="#dc2626" className="mt-0.5" />
              <Text className="text-sm text-red-800 dark:text-red-200 flex-1">
                {error.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Deposit Required Notice */}
      {requiresDeposit && (
        <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex-row items-start gap-2">
          <CreditCard size={16} color="#d97706" className="mt-0.5" />
          <Text className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            This booking modification requires a deposit payment to complete.
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        {/* Cancel Button */}
        <Button
          variant="outline"
          onPress={handleCancel}
          disabled={submitting || checkingPayment}
          className="flex-1"
        >
          <Text className="font-medium">Cancel</Text>
        </Button>

        {/* Loading state while checking payment requirements */}
        {checkingPayment ? (
          <Button disabled className="flex-1 bg-muted">
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#6b7280" />
              <Text className="font-medium text-lg text-muted-foreground">
                Checking...
              </Text>
            </View>
          </Button>
        ) : requiresDeposit && onPayDeposit ? (
          <Button
            onPress={onPayDeposit}
            disabled={!hasChanges || displayErrors.length > 0 || submitting}
            className={`flex-1 ${!hasChanges || displayErrors.length > 0 || submitting ? "bg-muted" : "bg-primary"}`}
          >
            <View className="flex-row items-center gap-2">
              <CreditCard size={18} color="white" />
              <Text
                className={`font-medium text-lg ${!hasChanges || displayErrors.length > 0 ? "text-muted-foreground" : "text-primary-foreground"}`}
              >
                Pay Deposit
              </Text>
            </View>
          </Button>
        ) : (
          <Button
            onPress={onSave}
            disabled={!canSave || submitting}
            className={`flex-1 ${!canSave || submitting ? "bg-muted" : "bg-primary"}`}
          >
            {submitting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-primary-foreground font-medium">
                  Saving...
                </Text>
              </View>
            ) : (
              <Text
                className={`font-medium text-lg ${!canSave ? "text-muted-foreground" : "text-primary-foreground"}`}
              >
                Save Changes
              </Text>
            )}
          </Button>
        )}
      </View>

      {/* Helper Text */}
      {!hasChanges && (
        <Text className="text-xs text-muted-foreground text-center mt-3">
          Make changes above to save
        </Text>
      )}

      {hasChanges && canSave && !submitting && !requiresDeposit && (
        <Text className="text-xs text-muted-foreground text-center mt-3">
          Your booking request will be updated and the expiry timer will reset
        </Text>
      )}

      {hasChanges && requiresDeposit && (
        <Text className="text-xs text-muted-foreground text-center mt-3">
          Complete deposit payment to save your changes
        </Text>
      )}
    </View>
  );
};
