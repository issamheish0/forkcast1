import React, { useCallback, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import {
  X,
  Share2,
  Copy,
  Link,
  MessageCircle,
  Mail,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { useShare, ShareOptions } from "@/hooks/useShare";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  shareOptions: ShareOptions;
  showNativeShare?: boolean;
  showCopyLink?: boolean;
  customActions?: ShareAction[];
}

interface ShareAction {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<any>;
  onPress: () => void | Promise<void>;
  loading?: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  onClose,
  title = "Share",
  description,
  shareOptions,
  showNativeShare = true,
  showCopyLink = true,
  customActions = [],
}) => {
  const { colorScheme } = useColorScheme();
  const { shareGeneric, copyToClipboard } = useShare();
  const [loading, setLoading] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    if (loading) return;

    setLoading("share");
    try {
      const success = await shareGeneric(shareOptions);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Share error:", error);
    } finally {
      setLoading(null);
    }
  }, [shareGeneric, shareOptions, onClose, loading]);

  const handleCopyLink = useCallback(async () => {
    if (loading || !shareOptions.url) return;

    setLoading("copy");
    try {
      await copyToClipboard(shareOptions.url, "Link copied to clipboard!");
      onClose();
    } catch (error) {
      console.error("Copy error:", error);
    } finally {
      setLoading(null);
    }
  }, [copyToClipboard, shareOptions.url, onClose, loading]);

  const handleCustomAction = useCallback(
    async (action: ShareAction) => {
      if (loading) return;

      setLoading(action.id);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await action.onPress();
        onClose();
      } catch (error) {
        console.error(`Custom action ${action.id} error:`, error);
      } finally {
        setLoading(null);
      }
    },
    [onClose, loading],
  );

  const defaultActions: ShareAction[] = [
    ...(showNativeShare
      ? [
          {
            id: "native-share",
            title: "Share",
            description: "Use your device's share options",
            icon: Share2,
            onPress: handleShare,
            loading: loading === "share",
          },
        ]
      : []),
    ...(showCopyLink && shareOptions.url
      ? [
          {
            id: "copy-link",
            title: "Copy Link",
            description: "Copy the link to your clipboard",
            icon: Copy,
            onPress: handleCopyLink,
            loading: loading === "copy",
          },
        ]
      : []),
  ];

  const allActions = [...defaultActions, ...customActions];

  const renderShareAction = useCallback(
    ({ item }: { item: ShareAction }) => {
      const isLoading = loading === item.id;
      const IconComponent = item.icon;

      return (
        <Pressable
          onPress={() => handleCustomAction(item)}
          disabled={isLoading || Boolean(loading)}
          className={cn(
            "flex-row items-center p-4 rounded-xl border border-border",
            "bg-card active:bg-muted/50",
            {
              "opacity-50": isLoading || Boolean(loading),
            },
          )}
        >
          <View className="w-10 h-10 bg-muted rounded-full items-center justify-center mr-3">
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={colorScheme === "dark" ? "#ffffff" : "#000000"}
              />
            ) : (
              <IconComponent
                size={20}
                color={colorScheme === "dark" ? "#ffffff" : "#000000"}
              />
            )}
          </View>

          <View className="flex-1">
            <Text className="font-semibold text-base mb-1">{item.title}</Text>
            {item.description && (
              <Text className="text-sm text-muted-foreground">
                {item.description}
              </Text>
            )}
          </View>
        </Pressable>
      );
    },
    [handleCustomAction, loading, colorScheme],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />

        <View className="bg-background border-t border-border rounded-t-3xl">
          <SafeAreaView edges={["bottom"]}>
            {/* Header */}
            <View className="flex-row items-center justify-between p-6 pb-4">
              <View className="flex-1">
                <H3 className="text-xl font-bold mb-1">{title}</H3>
                {description && (
                  <P className="text-muted-foreground">{description}</P>
                )}
              </View>

              <Pressable
                onPress={onClose}
                className="w-8 h-8 items-center justify-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X
                  size={24}
                  color={colorScheme === "dark" ? "#ffffff" : "#000000"}
                />
              </Pressable>
            </View>

            {/* Share Actions */}
            <View className="px-6 pb-6">
              <FlatList
                data={allActions}
                keyExtractor={(item) => item.id}
                renderItem={renderShareAction}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View className="h-3" />}
                scrollEnabled={false}
              />
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

export default ShareModal;
