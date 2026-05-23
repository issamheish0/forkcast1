// app/(protected)/profile/privacy.tsx
import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, Alert, Linking } from "react-native";

import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Trash2,
  FileText,
  ExternalLink,
  Shield,
  Lock,
  AlertTriangle,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useAccountDeletion } from "@/lib/accountDeletionService";
import { BackHeader } from "@/components/ui/back-header";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

// Privacy Policy Sections
interface PrivacyPolicySection {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
}

const PRIVACY_SECTIONS: PrivacyPolicySection[] = [
  {
    id: "data_collection",
    title: "Data Collection",
    content:
      "We collect information you provide directly, usage data, and device information to enhance your dining experience. This includes your profile information, booking history, restaurant preferences, and location data when you grant permission.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "data_usage",
    title: "How We Use Your Data",
    content:
      "Your data helps us personalize restaurant recommendations, process bookings efficiently, send relevant notifications, and improve our services. We use this information to enhance your dining experience and provide better customer support.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "data_sharing",
    title: "Data Sharing",
    content:
      "We share minimal necessary data with restaurant partners to fulfill your bookings and trusted service providers for payment processing and analytics. We never sell your personal information to third parties.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "data_security",
    title: "Data Security",
    content:
      "We use industry-standard encryption, secure servers, and strict access controls to protect your personal information. Your payment data is processed through certified secure payment gateways.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "your_rights",
    title: "Your Privacy Rights",
    content:
      "You have the right to access, update, or delete your personal information. You can control notification preferences, export your data, or delete your account at any time. Contact us for assistance with privacy-related requests.",
    lastUpdated: "2024-01-15",
  },
];

export default function PrivacyScreen() {
  const { profile, signOut } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const { deleteAccount, softDeleteAccount, validateDeletion } =
    useAccountDeletion();

  // State Management
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  // Account Deletion Handler
  const handleAccountDeletion = useCallback(async () => {
    // First, validate if user can delete account
    const validation = await validateDeletion();

    if (!validation.canDelete) {
      Alert.alert(
        "Cannot Delete Account",
        `Account deletion is not possible:\n\n${validation.restrictions.join("\n")}`,
        [{ text: "OK" }],
      );
      return;
    }

    // Show initial confirmation
    Alert.alert(
      "Delete Account",
      `This will permanently delete your account and all associated data including bookings, reviews, and favorites.\n\n${validation.warnings.length > 0 ? "\nWarnings:\n" + validation.warnings.join("\n") : ""}\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => showFinalConfirmation(),
        },
      ],
    );
  }, [validateDeletion]);

  // Final Confirmation Step
  const showFinalConfirmation = useCallback(() => {
    Alert.alert(
      "Final Confirmation",
      "Are you absolutely sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I understand",
          style: "destructive",
          onPress: () => showDeletionOptions(),
        },
      ],
    );
  }, []);

  // Show Deletion Options (Hard vs Soft Delete)
  const showDeletionOptions = useCallback(() => {
    Alert.alert(
      "Deletion Type",
      "Choose how you want to delete your account:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate (Recoverable)",
          onPress: () => performSoftDeletion(),
        },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: () => performHardDeletion(),
        },
      ],
    );
  }, []);

  // Perform Soft Deletion
  const performSoftDeletion = useCallback(async () => {
    setDeletingAccount(true);
    try {
      const result = await softDeleteAccount();

      if (result.success) {
        Alert.alert(
          "Account Deactivated",
          "Your account has been deactivated. Contact support if you want to reactivate it.",
          [
            {
              text: "OK",
              onPress: () => signOut(),
            },
          ],
        );
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      console.error("Error deactivating account:", error);
      Alert.alert("Error", "Failed to deactivate account");
    } finally {
      setDeletingAccount(false);
    }
  }, [softDeleteAccount, signOut]);

  // Perform Hard Deletion
  const performHardDeletion = useCallback(async () => {
    setDeletingAccount(true);
    try {
      const result = await deleteAccount();

      if (result.success) {
        Alert.alert(
          "Account Deleted",
          "Your account and all associated data have been permanently deleted.",
          [
            {
              text: "OK",
              onPress: () => signOut(),
            },
          ],
        );
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      Alert.alert("Error", "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  }, [deleteAccount, signOut]);

  // Section Toggle Handler
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Contact Support Handler
  const handleContactSupport = useCallback(() => {
    Alert.alert("Contact Support", "Choose how to contact us:", [
      { text: "Cancel", style: "cancel" },
      {
        text: "WhatsApp",
        onPress: () => Linking.openURL("https://wa.me/9613498485").catch(() => {}),
      },
      {
        text: "Email",
        onPress: () => Linking.openURL("mailto:support@plate.com").catch(() => {}),
      },
      {
        text: "Phone",
        onPress: () => Linking.openURL("tel:+9613498485").catch(() => {}),
      },
    ]);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <BackHeader title="Privacy & Security" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Privacy Overview */}
        <View className="pt-6 px-4">
          <View className="bg-card rounded-xl p-4 mb-4">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center dark:bg-blue-900">
                <Shield size={20} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-lg mb-2">
                  Your Privacy Matters
                </Text>
                <P className="text-muted-foreground text-sm leading-5">
                  We are committed to protecting your personal information and
                  giving you control over your data. Review our privacy
                  practices and manage your account settings below.
                </P>
              </View>
            </View>
          </View>
        </View>

        {/* Account Management Section */}
        <View className="pt-4">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Account Management
          </Text>

          {/* Account Deletion */}
          <View className="bg-card mx-4 mb-3 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center dark:bg-red-900">
                <Trash2 size={20} color="#ef4444" />
              </View>
              <View className="flex-1">
                <Text className="font-medium mb-1 text-red-600 dark:text-red-400">
                  Delete Account
                </Text>
                <Muted className="text-sm mb-3">
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </Muted>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={handleAccountDeletion}
                  disabled={deletingAccount}
                >
                  <Text className="text-destructive-foreground text-sm">
                    {deletingAccount ? "Processing..." : "Delete Account"}
                  </Text>
                </Button>
              </View>
            </View>
          </View>
        </View>

        {/* Privacy Policy Sections */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Privacy Information
          </Text>

          {PRIVACY_SECTIONS.map((section) => {
            const isExpanded = expandedSections.has(section.id);

            return (
              <View
                key={section.id}
                className="bg-card mx-4 mb-3 rounded-xl overflow-hidden"
              >
                <Pressable
                  onPress={() => toggleSection(section.id)}
                  className="p-4 flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="font-medium">{section.title}</Text>
                    <Muted className="text-xs mt-1">
                      Updated{" "}
                      {formatDateToDDMMYYYY(new Date(section.lastUpdated))}
                    </Muted>
                  </View>
                  <View
                    className={`transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
                  >
                    <ArrowLeft
                      size={20}
                      color="#666"
                      style={{ transform: [{ rotate: "270deg" }] }}
                    />
                  </View>
                </Pressable>

                {isExpanded && (
                  <View className="px-4 pb-4 border-t border-border">
                    <P className="text-sm mt-3 leading-5">{section.content}</P>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Legal Documents Section */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Legal Documents
          </Text>

          <Pressable
            onPress={() => router.push("../../legal/PRIVACY_POLICY" as any)}
            className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center dark:bg-blue-900">
              <FileText size={20} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">Full Privacy Policy</Text>
              <Muted className="text-sm">
                Complete details about our privacy practices and data handling
              </Muted>
            </View>
            <ExternalLink size={20} color="#666" />
          </Pressable>

          <Pressable
            onPress={() => router.push("../../legal/TERMS_OF_SERVICE" as any)}
            className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center dark:bg-green-900">
              <Lock size={20} color="#059669" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">Terms & Conditions</Text>
              <Muted className="text-sm">
                Terms of service, privacy policy, and community guidelines
              </Muted>
            </View>
            <ExternalLink size={20} color="#666" />
          </Pressable>
        </View>

        {/* Contact Information */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Need Help?
          </Text>

          <View className="bg-card mx-4 mb-3 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-yellow-100 rounded-full items-center justify-center dark:bg-yellow-900">
                <AlertTriangle size={20} color="#f59e0b" />
              </View>
              <View className="flex-1">
                <Text className="font-medium mb-1">Privacy Questions</Text>
                <P className="text-sm text-muted-foreground leading-5 mb-3">
                  Have questions about your privacy or need help with your
                  account? Our support team is here to help.
                </P>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleContactSupport}
                >
                  <Text className="text-sm">Contact Support</Text>
                </Button>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="items-center py-8 px-4">
          <Muted className="text-xs text-center leading-4">
            Your privacy is important to us. We follow industry best practices
            to protect your data and give you control over your information.
          </Muted>
          <Pressable
            onPress={() =>
              router.push("../../legal/DATA_PROTECTION_POLICY" as any)
            }
            className="mt-2"
          >
            <Text className="text-primary text-sm">
              Read Data Protection Policy
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
