import React from "react";
import { View, ScrollView } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Palette, Monitor } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, P, Muted } from "@/components/ui/typography";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Card } from "@/components/ui/card";
import { useColorScheme } from "@/lib/useColorScheme";

export default function AppearanceScreen() {
  const { colorScheme } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft size={20} className="text-foreground" />
          </Button>
          <View>
            <H2>Appearance</H2>
            <Muted>Customize how the app looks</Muted>
          </View>
        </View>
        <Palette size={24} className="text-muted-foreground" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Theme Selection */}
        <View className="p-4">
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">Theme</Text>
            <P className="text-muted-foreground mb-4">
              Choose how the app appears. System will automatically switch
              between light and dark based on your device settings.
            </P>
            <ThemeToggle variant="full" showLabels={true} />
          </View>

          {/* Current Theme Info */}
          <Card variant="subtle">
            <View className="flex-row items-center gap-3 mb-3">
              <Monitor size={20} className="text-primary" />
              <Text className="font-semibold">Current Theme</Text>
            </View>
            <View className="space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground">Active Mode:</Text>
                <Text className="font-medium capitalize">{colorScheme}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground">Color Palette:</Text>
                <Text className="font-medium">Mulberry Velvet</Text>
              </View>
            </View>
          </Card>

          {/* Color Palette Preview */}
          <View className="mt-6">
            <Text className="text-lg font-semibold mb-4">Color Palette</Text>
            <Card variant="default">
              <Text className="font-medium mb-3">Brand Colors</Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="items-center">
                  <View className="w-12 h-12 rounded-full bg-primary border-2 border-border" />
                  <Text className="text-xs mt-1 text-muted-foreground">
                    Primary
                  </Text>
                </View>
                <View className="items-center">
                  <View className="w-12 h-12 rounded-full bg-secondary border-2 border-border" />
                  <Text className="text-xs mt-1 text-muted-foreground">
                    Secondary
                  </Text>
                </View>
                <View className="items-center">
                  <View className="w-12 h-12 rounded-full bg-accent border-2 border-border" />
                  <Text className="text-xs mt-1 text-muted-foreground">
                    Accent
                  </Text>
                </View>
                <View className="items-center">
                  <View className="w-12 h-12 rounded-full bg-muted border-2 border-border" />
                  <Text className="text-xs mt-1 text-muted-foreground">
                    Muted
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          {/* Theme Benefits */}
          <View className="mt-6">
            <Text className="text-lg font-semibold mb-4">Theme Benefits</Text>
            <View className="space-y-3">
              <Card variant="subtle">
                <Text className="font-medium mb-2">🌞 Light Mode</Text>
                <Text className="text-sm text-muted-foreground">
                  Perfect for daytime use with excellent readability and vibrant
                  colors.
                </Text>
              </Card>
              <Card variant="subtle">
                <Text className="font-medium mb-2">🌙 Dark Mode</Text>
                <Text className="text-sm text-muted-foreground">
                  Reduces eye strain in low-light conditions and saves battery
                  on OLED displays.
                </Text>
              </Card>
              <Card variant="subtle">
                <Text className="font-medium mb-2">⚙️ System</Text>
                <Text className="text-sm text-muted-foreground">
                  Automatically adapts to your device's system theme settings.
                </Text>
              </Card>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
