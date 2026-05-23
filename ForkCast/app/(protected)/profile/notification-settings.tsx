import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import {
  Bell,
  BellOff,
  Mail,
  MessageCircle,
  Smartphone,
} from "lucide-react-native";

import * as Haptics from "expo-haptics";
import { BackHeader } from "@/components/ui/back-header";
import { SafeAreaView } from "@/components/safe-area-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { colors } from "@/constants/colors";

type ChannelPrefs = {
  all_muted: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
};

const DEFAULT_PREFS: ChannelPrefs = {
  all_muted: false,
  push: true,
  email: true,
  whatsapp: true,
};

export default function NotificationSettingsScreen() {
  const { profile, session, updateProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<ChannelPrefs>(DEFAULT_PREFS);

  const userEmail = session?.user?.email;

  // Load fresh preferences from DB on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        if (!profile?.id) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("notification_preferences")
          .eq("id", profile.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading notification prefs:", error);
          // Fall back to cached profile
          if (profile.notification_preferences) {
            setPrefs({
              all_muted: profile.notification_preferences.all_muted ?? false,
              push: profile.notification_preferences.push ?? true,
              email: profile.notification_preferences.email ?? true,
              whatsapp: profile.notification_preferences.whatsapp ?? true,
            });
          }
        } else if (data?.notification_preferences) {
          const np = data.notification_preferences as Record<string, unknown>;
          setPrefs({
            all_muted: (np.all_muted as boolean) ?? false,
            push: (np.push as boolean) ?? true,
            email: (np.email as boolean) ?? true,
            whatsapp: (np.whatsapp as boolean) ?? true,
          });
        }
      } catch (error) {
        console.error("Error loading notification prefs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPrefs();
  }, [profile?.id]);

  // Save preferences to DB and sync with OneSignal
  const savingRef = useRef(false);

  const savePrefs = useCallback(
    async (updated: ChannelPrefs, previousPrefs: ChannelPrefs) => {
      if (!profile?.id || savingRef.current) return;

      savingRef.current = true;
      setSaving(true);
      try {
        // Build the full JSONB value (preserve sms key)
        const fullPrefs = {
          sms: false,
          push: updated.push,
          email: updated.email,
          whatsapp: updated.whatsapp,
          all_muted: updated.all_muted,
        };

        const { error } = await supabase
          .from("profiles")
          .update({ notification_preferences: fullPrefs })
          .eq("id", profile.id);

        if (error) {
          console.error("Error saving notification prefs:", error);
          Alert.alert("Error", "Failed to save notification preferences.");
          setPrefs(previousPrefs);
          return;
        }

        // Update the cached profile
        await updateProfile({ notification_preferences: fullPrefs });
      } catch (error) {
        console.error("Error saving notification prefs:", error);
        Alert.alert("Error", "Failed to save notification preferences.");
        setPrefs(previousPrefs);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [profile?.id, updateProfile],
  );

  // Toggle handler for the master mute switch
  const handleToggleAllMuted = useCallback(async () => {
    const previous = prefs;
    const updated = { ...prefs, all_muted: !prefs.all_muted };
    setPrefs(updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await savePrefs(updated, previous);
  }, [prefs, savePrefs]);

  // Toggle handler for push notifications
  const handleTogglePush = useCallback(async () => {
    const newPush = !prefs.push;

    if (newPush) {
      // Turning push ON — check permission first
      try {
        // no-op in Expo Go — OneSignal not available
      } catch (error) {
        console.warn("[OneSignal] Push optIn error:", error);
      }
    } else {
      // Turning push OFF
      try {
        // no-op in Expo Go
      } catch (error) {
        console.warn("[OneSignal] Push optOut error:", error);
      }
    }

    const previous = prefs;
    const updated = { ...prefs, push: newPush };
    setPrefs(updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await savePrefs(updated, previous);
  }, [prefs, savePrefs]);

  // Toggle handler for email notifications
  const handleToggleEmail = useCallback(async () => {
    const newEmail = !prefs.email;

    if (userEmail) {
      try {
        // no-op in Expo Go
        if (newEmail) {
          // OneSignal.User.addEmail(userEmail);
        } else {
          // OneSignal.User.removeEmail(userEmail);
        }
      } catch (error) {
        console.warn("[OneSignal] Email sync error:", error);
      }
    }

    const previous = prefs;
    const updated = { ...prefs, email: newEmail };
    setPrefs(updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await savePrefs(updated, previous);
  }, [prefs, savePrefs, userEmail]);

  // Toggle handler for WhatsApp notifications
  const handleToggleWhatsApp = useCallback(async () => {
    const previous = prefs;
    const updated = { ...prefs, whatsapp: !prefs.whatsapp };
    setPrefs(updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await savePrefs(updated, previous);
  }, [prefs, savePrefs]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <BackHeader title="Notification Settings" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const channelsDisabled = prefs.all_muted;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <BackHeader title="Notification Settings" />

      <ScrollView className="flex-1 px-4 pt-2" showsVerticalScrollIndicator={false}>
        {/* Master toggle */}
        <View className="bg-card rounded-2xl px-4 py-5 mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-4">
              {prefs.all_muted ? (
                <BellOff
                  size={22}
                  color={themeColors.mutedForeground}
                  style={{ marginRight: 14 }}
                />
              ) : (
                <Bell
                  size={22}
                  color={themeColors.primary}
                  style={{ marginRight: 14 }}
                />
              )}
              <View className="flex-1">
                <Text className="text-base font-semibold">
                  All Notifications
                </Text>
                <Muted className="text-xs mt-0.5">
                  {prefs.all_muted
                    ? "All notifications are paused"
                    : "Receive notifications across all channels"}
                </Muted>
              </View>
            </View>
            <Switch
              checked={!prefs.all_muted}
              onCheckedChange={handleToggleAllMuted}
              disabled={saving}
            />
          </View>
        </View>

        {/* Channels section */}
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Channels
        </Text>

        <View
          className="bg-card rounded-2xl overflow-hidden mb-6"
          style={{
            opacity: channelsDisabled ? 0.4 : 1,
          }}
          pointerEvents={channelsDisabled ? "none" : "auto"}
        >
          {/* Push Notifications */}
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-border">
            <View className="flex-row items-center flex-1 mr-4">
              <Smartphone
                size={20}
                color={themeColors.foreground}
                style={{ marginRight: 14 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium">
                  Push Notifications
                </Text>
                <Muted className="text-xs mt-0.5">
                  Alerts on your device
                </Muted>
              </View>
            </View>
            <Switch
              checked={prefs.push}
              onCheckedChange={handleTogglePush}
              disabled={saving || channelsDisabled}
            />
          </View>

          {/* Email Notifications — only show if user has email */}
          {userEmail ? (
            <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-border">
              <View className="flex-row items-center flex-1 mr-4">
                <Mail
                  size={20}
                  color={themeColors.foreground}
                  style={{ marginRight: 14 }}
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium">
                    Email
                  </Text>
                  <Muted className="text-xs mt-0.5">{userEmail}</Muted>
                </View>
              </View>
              <Switch
                checked={prefs.email}
                onCheckedChange={handleToggleEmail}
                disabled={saving || channelsDisabled}
              />
            </View>
          ) : null}

          {/* WhatsApp Notifications */}
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-row items-center flex-1 mr-4">
              <MessageCircle
                size={20}
                color="#25D366"
                style={{ marginRight: 14 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium">
                  WhatsApp
                </Text>
                <Muted className="text-xs mt-0.5">
                  Booking confirmations & updates
                </Muted>
              </View>
            </View>
            <Switch
              checked={prefs.whatsapp}
              onCheckedChange={handleToggleWhatsApp}
              disabled={saving || channelsDisabled}
            />
          </View>
        </View>

        {/* Info text */}
        <View className="px-1 mb-8">
          <Muted className="text-xs leading-5">
            Security and account notifications will always be delivered regardless of these settings.
          </Muted>
        </View>
      </ScrollView>

      {/* Saving indicator */}
      {saving && (
        <View className="absolute bottom-8 left-0 right-0 items-center">
          <View
            className="flex-row items-center px-4 py-2 rounded-full bg-card"
          >
            <ActivityIndicator size="small" color={themeColors.primary} />
            <Text className="text-sm ml-2">Saving...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
