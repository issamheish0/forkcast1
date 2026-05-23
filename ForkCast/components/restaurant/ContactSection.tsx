import React from "react";
import { View, Pressable, Linking } from "react-native";
import { Phone, Instagram, Globe, ChevronRight } from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { useColorScheme } from "@/lib/useColorScheme";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  instagram_handle?: string;
  website_url?: string;
  whatsapp_number?: string;
};

interface ContactSectionProps {
  restaurant: Restaurant;
  onCall: () => void;
  onWhatsApp: () => void;
}

export const ContactSection = ({
  restaurant,
  onCall,
  onWhatsApp,
}: ContactSectionProps) => {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#fff' : '#374151';
  const hasContactInfo =
    restaurant.phone_number ||
    restaurant.whatsapp_number ||
    restaurant.instagram_handle ||
    restaurant.website_url;

  if (!hasContactInfo) {
    return null;
  }

  return (
    <View className="px-4 mb-6">
      <H3 className="mb-3">Contact</H3>
      <View className="bg-card rounded-lg divide-y divide-border">
        {restaurant.phone_number && (
          <Pressable
            onPress={onCall}
            className="p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Phone size={20} color={iconColor} />
              <Text>{restaurant.phone_number}</Text>
            </View>
            <ChevronRight size={20} color="#666" />
          </Pressable>
        )}
        {restaurant.whatsapp_number && (
          <Pressable
            onPress={onWhatsApp}
            className="p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <FontAwesome name="whatsapp" size={20} color="#25D366" />
              <Text>WhatsApp</Text>
            </View>
            <ChevronRight size={20} color="#666" />
          </Pressable>
        )}
        {restaurant.instagram_handle && (
          <Pressable
            onPress={() =>
              Linking.openURL(
                `https://instagram.com/${restaurant.instagram_handle}`,
              ).catch(() => {})
            }
            className="p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Instagram size={20} color="#E1306C" />
              <Text>@{restaurant.instagram_handle}</Text>
            </View>
            <ChevronRight size={20} color="#666" />
          </Pressable>
        )}
        {restaurant.website_url && (
          <Pressable
            onPress={() => Linking.openURL(restaurant.website_url!).catch(() => {})}
            className="p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Globe size={20} color={iconColor} />
              <Text>Website</Text>
            </View>
            <ChevronRight size={20} color="#666" />
          </Pressable>
        )}
      </View>
    </View>
  );
};
