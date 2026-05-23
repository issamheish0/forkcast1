import React, { useState, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Flag, AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { H3, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  useReviewReports,
  ReportReason,
  REPORT_REASONS,
} from "@/hooks/useReviewReports";

interface ReportReviewModalProps {
  visible: boolean;
  reviewId: string;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

export const ReportReviewModal: React.FC<ReportReviewModalProps> = ({
  visible,
  reviewId,
  onClose,
  onReportSubmitted,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"reason" | "details">("reason");

  const { submitReport, isSubmitting } = useReviewReports();

  // When modal opens, preselect the first reason to avoid disabled CTA confusion
  useEffect(() => {
    if (visible) {
      setStep("reason");
      setDescription("");
      setSelectedReason(REPORT_REASONS[0]?.value ?? null);
    }
  }, [visible]);

  const handleNext = () => {
    if (!selectedReason) {
      Alert.alert(
        "Select a Reason",
        "Please select a reason for reporting this review.",
      );
      return;
    }
    setStep("details");
  };

  const handleBack = () => {
    setStep("reason");
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason for reporting.");
      return;
    }

    const success = await submitReport({
      reviewId,
      reason: selectedReason,
      description: description.trim() || undefined,
    });

    if (success) {
      handleClose();
      onReportSubmitted?.();
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription("");
    setStep("reason");
    onClose();
  };

  const ReasonOption: React.FC<{
    reason: (typeof REPORT_REASONS)[0];
    selected: boolean;
    onSelect: () => void;
  }> = ({ reason, selected, onSelect }) => (
    <Pressable
      onPress={onSelect}
      className={`p-4 rounded-lg border mb-3 ${
        selected
          ? isDark
            ? "bg-red-900/30 border-red-400"
            : "bg-red-50 border-red-300"
          : isDark
            ? "bg-card border-border"
            : "bg-white border-gray-200"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text
            className={`font-medium ${
              selected
                ? isDark
                  ? "text-red-200"
                  : "text-red-800"
                : isDark
                  ? "text-white"
                  : "text-gray-900"
            }`}
          >
            {reason.label}
          </Text>
          <P
            className={`text-sm mt-1 ${
              selected
                ? isDark
                  ? "text-red-300"
                  : "text-red-600"
                : "text-muted-foreground"
            }`}
          >
            {reason.description}
          </P>
        </View>
        {selected && (
          <View
            className={`w-5 h-5 rounded-full ml-3 ${
              isDark ? "bg-red-400" : "bg-red-500"
            } items-center justify-center`}
          >
            <Text className="text-white text-xs">✓</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View
            className={`rounded-2xl max-h-[90%] ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-border">
              <View className="flex-row items-center">
                <Flag size={20} color={isDark ? "#ef4444" : "#dc2626"} />
                <H3 className="ml-2 text-destructive">Report Review</H3>
              </View>
              <Pressable onPress={handleClose} className="p-2 -m-2">
                <X size={20} color={isDark ? "#fff" : "#000"} />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {step === "reason" ? (
                <View className="p-6">
                  <P className="text-muted-foreground mb-6">
                    Help us understand what's wrong with this review. Your
                    report is anonymous.
                  </P>

                  {REPORT_REASONS.map((reason) => (
                    <ReasonOption
                      key={reason.value}
                      reason={reason}
                      selected={selectedReason === reason.value}
                      onSelect={() => setSelectedReason(reason.value)}
                    />
                  ))}
                </View>
              ) : (
                <View className="p-6">
                  <View className="mb-4">
                    <Text className="font-medium mb-2">Selected Reason:</Text>
                    <Text className="text-destructive">
                      {
                        REPORT_REASONS.find((r) => r.value === selectedReason)
                          ?.label
                      }
                    </Text>
                  </View>

                  <Text className="font-medium mb-2">
                    Additional Details (Optional)
                  </Text>
                  <P className="text-muted-foreground text-sm mb-4">
                    Provide any additional context that might help us review
                    this report.
                  </P>

                  <Input
                    placeholder="Describe the issue in more detail..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    className="min-h-[100px] text-top"
                    maxLength={500}
                  />
                  <Text className="text-xs text-muted-foreground text-right mt-1">
                    {description.length}/500
                  </Text>

                  <View
                    className={`mt-6 p-4 rounded-lg ${
                      isDark ? "bg-yellow-900/30" : "bg-yellow-50"
                    }`}
                  >
                    <View className="flex-row items-start">
                      <AlertTriangle
                        size={16}
                        color={isDark ? "#facc15" : "#eab308"}
                        className="mt-0.5 mr-2 flex-shrink-0"
                      />
                      <P
                        className={`text-xs flex-1 ${
                          isDark ? "text-yellow-200" : "text-yellow-800"
                        }`}
                      >
                        False reports may result in restrictions on your
                        account. Only report content that genuinely violates our
                        community guidelines.
                      </P>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View className="p-6 border-t border-border">
              <View className="flex-row gap-3">
                {step === "details" && (
                  <Button
                    variant="outline"
                    onPress={handleBack}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    <Text>Back</Text>
                  </Button>
                )}

                {step === "reason" ? (
                  <Button
                    onPress={handleNext}
                    className="flex-1"
                    disabled={!selectedReason}
                  >
                    <Text>Next</Text>
                  </Button>
                ) : (
                  <Button
                    onPress={handleSubmit}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    <Text>
                      {isSubmitting ? "Submitting..." : "Submit Report"}
                    </Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
