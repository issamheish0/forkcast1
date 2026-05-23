import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { SafeAreaView } from "@/components/safe-area-view";

export default function MyWaitlistsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-xl font-semibold text-foreground">My Waitlists</Text>
        <Text className="text-muted-foreground mt-2 text-center">
          You have no active waitlist entries.
        </Text>
      </View>
    </SafeAreaView>
  );
}
