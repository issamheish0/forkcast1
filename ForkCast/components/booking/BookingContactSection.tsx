import React from "react";
import { View, Alert, Linking } from "react-native";
import { Phone, Info } from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface BookingContactSectionProps {
  restaurant: {
    name: string;
    phone_number?: string | null;
    whatsapp_number?: string | null;
  };
  appliedOfferDetails?: {
    discount_percentage: number;
  } | null;
}

export const BookingContactSection: React.FC<BookingContactSectionProps> = ({
  restaurant,
  appliedOfferDetails,
}) => {
  const callRestaurant = async () => {
    if (!restaurant.phone_number) return;

    const url = `tel:${restaurant.phone_number}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  };

  const messageRestaurant = async () => {
    if (!restaurant.whatsapp_number) return;

    const offerText = appliedOfferDetails
      ? ` I have a ${appliedOfferDetails.discount_percentage}% discount offer applied.`
      : "";
    const message = encodeURIComponent(
      `Hi! I have a booking at ${restaurant.name}.${offerText}`,
    );

    // Clean phone number: remove all non-numeric characters
    const cleanedNumber = restaurant.whatsapp_number.replace(/[^\d]/g, "");

    // Use https://wa.me/ format which works without URL scheme whitelisting
    const waUrl = `https://wa.me/${cleanedNumber}?text=${message}`;
    // Fallback to whatsapp:// scheme
    const whatsappUrl = `whatsapp://send?phone=${cleanedNumber}&text=${message}`;

    try {
      // Try wa.me URL first (works on both platforms without configuration)
      const canOpenWa = await Linking.canOpenURL(waUrl);
      if (canOpenWa) {
        await Linking.openURL(waUrl);
        return;
      }

      // Fallback to whatsapp:// scheme
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
        return;
      }

      Alert.alert("Error", "WhatsApp is not installed");
    } catch (error) {
      console.error("Error opening WhatsApp:", error);
      Alert.alert(
        "Error",
        "Unable to open WhatsApp. Please check if it's installed.",
      );
    }
  };

  // Only show if there's WhatsApp or offer info to display
  if (!restaurant.whatsapp_number && !appliedOfferDetails) {
    return null;
  }

  // Build info message parts safely
  const buildInfoMessage = () => {
    const parts = [];

    if (appliedOfferDetails) {
      parts.push("discount offer");
    }

    if (parts.length === 0) {
      return "Your booking details will be mentioned when contacting the restaurant.";
    }

    if (parts.length === 1) {
      return `Your ${parts[0]} will be mentioned when contacting the restaurant.`;
    }

    return `Your ${parts.join(" and ")} will be mentioned when contacting the restaurant.`;
  };

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">
        <Text>Contact Restaurant</Text>
      </H3>

      <View className="gap-2">
        {restaurant.whatsapp_number ? (
          <Button
            variant="outline"
            onPress={messageRestaurant}
            className="w-full"
          >
            <View className="flex-row items-center gap-2">
              <FontAwesome name="whatsapp" size={20} color="#25D366" />
              <Text>WhatsApp</Text>
            </View>
          </Button>
        ) : null}
      </View>

      {appliedOfferDetails ? (
        <View className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <View className="flex-row items-center gap-2">
            <Info size={16} color="#3b82f6" />
            <Text className="text-sm text-blue-800 dark:text-blue-200 flex-1">
              {buildInfoMessage()}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};
