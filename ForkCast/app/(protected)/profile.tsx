// app/(protected)/profile.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import {
  Edit3,
  BarChart3,
  Users,
  Utensils,
  Bell,
  Star,
  TrendingUp,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  MapPin,
  Clock,
  CreditCard,
  UserPlus,
  MessageCircle,
  Award,
  Bot,
  KeyRound,
  Settings,
  User, // Added for guest view
  Heart,
  ChevronLeft, // Added for guest view
  Camera, // Added for my posts
  ClockIcon, // Added for waitlist
} from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useUserRating } from "@/hooks/useUserRating";
import ProfileScreenSkeleton from "@/components/skeletons/ProfileScreenSkeleton";
import { colors } from "@/constants/colors";
import {
  validateImageStrict,
  buildSecureStoragePath,
  MAX_IMAGE_SIZE,
} from "@/utils/imageUpload";

const iconMap: { [key: string]: any } = {
  Edit3,
  BarChart3,
  Users,
  Utensils,
  Bell,
  Star,
  TrendingUp,
  HelpCircle,
  Shield,
  LogOut,
  MapPin,
  Clock,
  ClockIcon,
  CreditCard,
  UserPlus,
  MessageCircle,
  Award,
  Bot,
  KeyRound,
  Settings,
  User,
  Heart,
  Camera,
};

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  showBadge?: boolean;
  badgeText?: string;
  badgeColor?: string;
  destructive?: boolean;
}

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = isDark ? colors.dark : colors.light;
  const router = useRouter();
  const {
    profile,
    signOut,
    initialized,
    isGuest,
    convertGuestToUser,
    refreshProfile,
  } = useAuth();

  // All hooks must be called before any conditional returns
  const userRating = useUserRating();
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // --- Authenticated User View ---
  // The rest of the logic is for authenticated users.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([userRating.refresh()]);
    setRefreshing(false);
  }, [userRating]);

  // Refresh profile and scratch card when screen comes into focus (so DB data like phone/DOB shows)
  useFocusEffect(
    useCallback(() => {
      if (!isGuest) {
        void refreshProfile();
        // Keep profile data fresh on focus
      }
    }, [isGuest, refreshProfile]),
  );

  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            console.error("Sign out error:", error);
          }
        },
      },
    ]);
  }, [signOut]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingAvatar(true);
      try {
        const image = result.assets[0];

        const validation = await validateImageStrict(image, MAX_IMAGE_SIZE);
        if (!validation.valid || !validation.mime || !validation.extension) {
          Alert.alert(
            "Invalid image",
            validation.error ?? "Please choose a JPEG, PNG, or WebP image.",
          );
          return;
        }

        const filePath = buildSecureStoragePath("avatars", validation.mime);
        const fileName = filePath.split("/").pop() as string;

        const formData = new FormData();
        formData.append("file", {
          uri: image.uri,
          type: validation.mime,
          name: fileName,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, formData, {
            contentType: validation.mime,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", profile?.id);
        if (updateError) throw updateError;

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch (error) {
        console.error("Error uploading avatar:", error);
        Alert.alert("Error", "Failed to upload avatar");
      } finally {
        setUploadingAvatar(false);
      }
    }
  }, [profile?.id]);

  // --- Guest View ---
  // Keep hook order stable when transitioning from guest mode to auth screens.
  if (isGuest) {
    return (
      <View className="flex-1 bg-background">
        <View className="p-4 pt-12">
          <H2>Profile</H2>
        </View>

        <View className="flex-1 items-center justify-center px-6 -mt-10">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
            <User size={48} className="text-primary" />
          </View>

          <H2 className="text-center mb-2">Create Your Profile</H2>
          <P className="text-center text-muted-foreground mb-8">
            Sign up to unlock personalized recommendations, save your favorites,
            and much more!
          </P>

          <View className="w-full max-w-sm">
            <Button onPress={convertGuestToUser} size="lg">
              <UserPlus size={20} color="#fff" />
              <Text className="ml-2 font-bold text-white">Sign Up Now</Text>
            </Button>

            <View className="mt-8 gap-4">
              <View className="flex-row items-center">
                <Heart size={20} className="text-red-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Save your favorite restaurants
                </Text>
              </View>
              <View className="flex-row items-center">
                <Clock size={20} className="text-blue-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Quick & easy reservations
                </Text>
              </View>
              <View className="flex-row items-center">
                <Bell size={20} className="text-green-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Get exclusive offers & updates
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // --- Authenticated User View ---

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Account",
      items: [
        {
          id: "edit-profile",
          title: "Edit Profile",
          subtitle: "Update your personal information",
          icon: "Edit3",
          onPress: () => router.push("/profile/edit"),
        },
        {
          id: "notifications",
          title: "Notifications",
          subtitle: "View your notifications",
          icon: "Bell",
          onPress: () => router.push("/profile/notifications"),
        },
        {
          id: "notification-settings",
          title: "Notification Settings",
          subtitle: "Push, email & WhatsApp preferences",
          icon: "Settings",
          onPress: () => router.push("/profile/notification-settings"),
        },
        {
          id: "preferences",
          title: "Preferences",
          subtitle: "Customize your experience",
          icon: "Star",
          onPress: () => router.push("/profile/preferences"),
        },
        {
          id: "reset-password",
          title: "Reset Password",
          subtitle: "Update your password",
          icon: "KeyRound",
          onPress: () =>
            router.push({
              pathname: "/password-reset",
              params: { from: "profile" },
            }),
        },
      ],
    },
    {
      title: "Rewards & Social",
      items: [
        {
          id: "friends",
          title: "Friends",
          subtitle: "Manage your connections",
          icon: "Users",
          onPress: () => router.push("/friends"),
        },
        {
          id: "payment-methods",
          title: "Payment Methods",
          subtitle: "Cards & wallets",
          icon: "CreditCard",
          onPress: () => router.push("/profile/payment-methods" as any),
        },
      ],
    },
    {
      title: "Activity",
      items: [
        {
          id: "insights",
          title: "My Insights",
          subtitle: "Dining stats",
          icon: "BarChart3",
          onPress: () => router.push("/profile/insights"),
        },
        {
          id: "reviews",
          title: "My Reviews",
          subtitle: "Reviews you've written",
          icon: "MessageCircle",
          onPress: () => router.push("/profile/reviews"),
        },
        {
          id: "waitlist",
          title: "My Waitlist",
          subtitle: "View your restaurant waitlist entries",
          icon: "ClockIcon",
          onPress: () => router.push("/(protected)/waitlist"),
        },
      ],
    },
    {
      title: "Social",
      items: [
        {
          id: "blocked-users",
          title: "Blocked Users",
          subtitle: "Manage blocked accounts",
          icon: "Shield",
          onPress: () => router.push("/profile/blocked-users"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          title: "Help & Support",
          subtitle: "Get help when you need it",
          icon: "HelpCircle",
          onPress: () => router.push("/profile/help"),
        },
        {
          id: "privacy",
          title: "Privacy & Security",
          subtitle: "Privacy settings, data management & account deletion",
          icon: "Shield",
          onPress: () => router.push("/profile/privacy"),
        },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem, index: number) => {
    const IconComponent = iconMap[item.icon];
    return (
      <Pressable
        key={item.id}
        onPress={item.onPress}
        className={`flex-row items-center gap-3 px-4 py-3.5 ${
          item.destructive ? "" : "border-b border-border/30 last:border-b-0"
        }`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          className={`w-9 h-9 rounded-xl items-center justify-center ${
            item.destructive
              ? isDark
                ? "bg-red-900/30"
                : "bg-red-100"
              : "bg-primary/10"
          }`}
        >
          <IconComponent
            size={18}
            color={
              item.destructive ? themeColors.destructive : themeColors.primary
            }
          />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-[14px] font-medium ${
                item.destructive ? "text-destructive" : "text-foreground"
              }`}
            >
              {item.title}
            </Text>
            {item.showBadge && (
              <View
                style={{
                  backgroundColor: item.badgeColor || themeColors.primary,
                }}
                className="px-2 py-0.5 rounded-full"
              >
                <Text className="text-xs font-bold text-primary-foreground">
                  {item.badgeText || "New"}
                </Text>
              </View>
            )}
          </View>
          {item.subtitle && (
            <Text className="text-[12px] text-muted-foreground mt-0.5">
              {item.subtitle}
            </Text>
          )}
        </View>
        {!item.destructive && (
          <ChevronRight size={16} color={themeColors.mutedForeground} />
        )}
      </Pressable>
    );
  };

  if (!initialized || userRating.loading) {
    return <ProfileScreenSkeleton />;
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.foreground}
          />
        }
      >
        {/* Back button */}
        <View
          style={{ paddingTop: Constants.statusBarHeight }}
          className="px-4 pb-0"
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="w-9 h-9 items-center justify-center"
          >
            <ChevronLeft
              size={26}
              color={isDark ? "#ffffff" : themeColors.primary}
            />
          </Pressable>
        </View>

        <View
          className="items-center pb-6 px-4 bg-background"
          style={{
            paddingTop: 8,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <Pressable onPress={pickImage} disabled={uploadingAvatar}>
            <View className="relative mb-3">
              <Image
                source={
                  profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : require("@/assets/default-avatar.jpeg")
                }
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 4,
                  borderColor: themeColors.background,
                }}
                contentFit="cover"
                optimizationPreset="thumbnail"
              />
              {uploadingAvatar && (
                <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                  <Text className="text-white text-xs">Uploading...</Text>
                </View>
              )}
              <View
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full items-center justify-center"
                style={{
                  borderWidth: 3,
                  borderColor: themeColors.background,
                }}
              >
                <Star
                  size={12}
                  color={themeColors.primaryForeground}
                  fill={themeColors.primaryForeground}
                />
              </View>
            </View>
          </Pressable>
          <H2 className="text-center text-xl text-foreground">
            {profile?.full_name || "Loading..."}
          </H2>
          <View className="flex-row items-center mt-1">
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <Text className="ml-1 text-xs font-semibold text-foreground">
              {(profile as any)?.user_rating?.toFixed(1) || "5.0"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile/edit")}
            className="mt-2 px-4 py-1.5 rounded-full bg-secondary"
          >
            <Text className="text-xs font-medium text-secondary-foreground">
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {menuSections.map((section) => (
          <View key={section.title} className="mt-4 px-5">
            <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </Text>
            <View className="bg-card rounded-2xl overflow-hidden">
              {section.items.map(renderMenuItem)}
            </View>
          </View>
        ))}

        {/* Sign Out - Standalone card */}
        <View className="px-5 mt-4">
          <Pressable
            onPress={handleSignOut}
            className="w-full flex-row items-center justify-center gap-2 py-3.5 bg-card rounded-2xl"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <LogOut size={16} color={themeColors.destructive} />
            <Text className="text-destructive text-sm font-semibold">
              Sign Out
            </Text>
          </Pressable>
        </View>

        <Text className="text-center text-[10px] text-muted-foreground mt-4 mb-2">
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </ScrollView>
    </View>
  );
}
