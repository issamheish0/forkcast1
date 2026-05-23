import React from "react";
import { View, ScrollView } from "react-native";
import { Gift } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { OfferCard } from "./OfferCard";

interface UserOfferWithDetails {
  id: string;
  user_id: string;
  offer_id: string;
  claimed_at: string;
  used_at?: string;
  expires_at: string;
  special_offer: {
    id: string;
    title: string;
    description: string;
    discount_percentage: number;
    valid_until: string;
    restaurant_id: string;
    minimum_party_size?: number;
    terms_conditions?: string[];
  };
}

interface OffersSelectionProps {
  availableOffers: UserOfferWithDetails[];
  selectedOfferUserId: string | null;
  onSelectOffer: (userOfferId: string | null) => void;
  partySize: number;
}

export const OffersSelection: React.FC<OffersSelectionProps> = ({
  availableOffers,
  selectedOfferUserId,
  onSelectOffer,
  partySize,
}) => {
  if (availableOffers.length === 0) {
    return (
      <View className="bg-muted/30 rounded-xl p-6 items-center">
        <Gift size={48} color="#9ca3af" />
        <Text className="font-semibold text-lg mt-3 text-center">
          No Special Offers Available
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-1">
          Check back later for exclusive discounts and deals for this
          restaurant.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View className="flex-row items-center gap-3 mb-4">
        <Gift size={20} color="#3b82f6" />
        <Text className="font-semibold text-lg">Apply Special Offers</Text>
        <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
          <Text className="text-blue-800 dark:text-blue-200 font-bold text-xs">
            {availableOffers.length} Available
          </Text>
        </View>
      </View>

      <Text className="text-sm text-muted-foreground mb-4">
        Select an offer to apply to your booking. Discounts will be
        automatically applied.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <View className="flex-row gap-4">
          {availableOffers.map((offer) => (
            <View key={offer.id} className="w-80">
              <OfferCard
                offer={offer}
                isSelected={selectedOfferUserId === offer.id}
                onSelect={() => onSelectOffer(offer.id)}
                onDeselect={() => onSelectOffer(null)}
                partySize={partySize}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {selectedOfferUserId && (
        <View className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <View className="flex-row items-center gap-2">
            <Gift size={16} color="#10b981" />
            <Text className="font-medium text-green-800 dark:text-green-200">
              Offer Applied Successfully
            </Text>
          </View>
          <Text className="text-sm text-green-700 dark:text-green-300 mt-1">
            Your discount will be automatically applied during checkout.
          </Text>
        </View>
      )}
    </View>
  );
};
