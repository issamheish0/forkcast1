import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Mail } from "lucide-react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";
import BookingCardSkeleton from "./BookingCardSkeleton";
import { H2, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { TabButton } from "@/components/ui/tab-button";

const BookingsScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Real Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <H2 className="text-2xl font-bold tracking-tight">My Bookings</H2>
            <Muted className="text-sm mt-0.5">
              Tap any booking for full details and options
            </Muted>
          </View>
          <View className="ml-4">
            <Button
              variant="ghost"
              size="sm"
              className="flex-row items-center gap-2 px-3"
            >
              <Mail size={18} className="text-primary" />
            </Button>
          </View>
        </View>
      </View>

      {/* Real Tabs */}
      <View className="flex-row border-b border-border bg-background">
        <TabButton
          title="Upcoming"
          isActive={true}
          onPress={() => {}}
          count={0}
        />
        <TabButton title="Past" isActive={false} onPress={() => {}} />
      </View>

      {/* Booking Cards */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {[...Array(3)].map((_, index) => (
          <BookingCardSkeleton key={index} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BookingsScreenSkeleton;
