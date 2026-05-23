// app/(protected)/profile/help.tsx
import React from "react";
import { View, ScrollView, Pressable, Linking } from "react-native";
import { Phone, Mail } from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { BackHeader } from "@/components/ui/back-header";

export default function HelpScreen() {
  const handleCall = () => {
    Linking.openURL("tel:+15551234567").catch(() => {});
  };

  const handleEmail = () => {
    Linking.openURL("mailto:support@plate.com").catch(() => {});
  };

  const handleWhatsApp = () => {
    Linking.openURL("https://wa.me/9613498485").catch(() => {});
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <BackHeader title="Help & Support" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Contact Methods */}
        <View className="mt-6 px-4">
          <Text className="text-sm font-semibold text-muted-foreground uppercase mb-3">
            Contact Us
          </Text>

          {/* Phone */}
          <Pressable
            onPress={handleCall}
            className="bg-card mb-3 rounded-xl p-4 flex-row items-center active:opacity-70"
          >
            <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
              <Phone size={24} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">Phone Support</Text>
              <Muted className="text-sm">+9613498485</Muted>
              <Muted className="text-xs mt-1">9 AM - 9 PM daily</Muted>
            </View>
          </Pressable>

          {/* Email */}
          <Pressable
            onPress={handleEmail}
            className="bg-card mb-3 rounded-xl p-4 flex-row items-center active:opacity-70"
          >
            <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
              <Mail size={24} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">Email Support</Text>
              <Muted className="text-sm">support@plate.com</Muted>
              <Muted className="text-xs mt-1">Response within 24 hours</Muted>
            </View>
          </Pressable>

          {/* WhatsApp */}
          <Pressable
            onPress={handleWhatsApp}
            className="bg-card mb-3 rounded-xl p-4 flex-row items-center active:opacity-70"
          >
            <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
              <FontAwesome name="whatsapp" size={24} color="#25D366" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">WhatsApp</Text>
              <Muted className="text-sm">+9613498485</Muted>
              <Muted className="text-xs mt-1">24/7 automated responses</Muted>
            </View>
          </Pressable>
        </View>

        {/* FAQ Section */}
        <View className="mt-6 px-4">
          <Text className="text-sm font-semibold text-muted-foreground uppercase mb-3">
            Frequently Asked Questions
          </Text>

          {/* How to Book */}
          <View className="bg-card mb-3 rounded-xl p-4">
            <Text className="font-semibold mb-2">How do I book a table?</Text>
            <Muted className="text-sm leading-5">
              Browse restaurants, select your preferred date and time, choose
              party size, and tap &ldquo;Book Now&rdquo; to confirm your
              reservation.
            </Muted>
          </View>

          {/* How to Cancel */}
          <View className="bg-card mb-3 rounded-xl p-4">
            <Text className="font-semibold mb-2">
              How do I cancel a booking?
            </Text>
            <Muted className="text-sm leading-5">
              Go to the Bookings tab, select your reservation, and tap
              &ldquo;Cancel Booking&rdquo;. You can cancel up to 2 hours before
              your booking time.
            </Muted>
          </View>

          {/* How to Review */}
          <View className="bg-card mb-3 rounded-xl p-4">
            <Text className="font-semibold mb-2">How do I leave a review?</Text>
            <Muted className="text-sm leading-5">
              After dining, go to the Bookings tab, find your completed
              reservation, and tap &ldquo;Write Review&rdquo; to share your
              experience.
            </Muted>
          </View>

          {/* How to Update Profile */}
          <View className="bg-card mb-3 rounded-xl p-4">
            <Text className="font-semibold mb-2">
              How do I update my profile?
            </Text>
            <Muted className="text-sm leading-5">
              Go to the Profile tab, tap &ldquo;Edit Profile&rdquo;, update your
              information (name, email, phone, dietary preferences), and save
              your changes.
            </Muted>
          </View>

          {/* Modify Booking */}
          <View className="bg-card mb-3 rounded-xl p-4">
            <Text className="font-semibold mb-2">
              Can I modify my reservation?
            </Text>
            <Muted className="text-sm leading-5">
              Yes! Go to the Bookings tab, select your reservation, and tap
              &ldquo;Modify&rdquo; to change the date, time, or party size.
              Changes must be made at least 2 hours before your booking.
            </Muted>
          </View>
        </View>

        {/* Footer */}
        <View className="items-center py-8 px-4">
          <Muted className="text-xs text-center">
            Need more help? Our support team is available 9 AM - 9 PM daily
          </Muted>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
