import { SpecialOffer } from "@/types/database-functions";
import {
  CheckCircle,
  Clock,
  Tag,
  Users,
  Calendar,
  QrCode,
} from "lucide-react-native";
import React from "react";
import { View, ScrollView, ActivityIndicator, Text } from "react-native";
import { Button } from "@/components/ui/button";
import { H3 } from "@/components/ui/typography";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

// Special offers section component
export const SpecialOffersSection: React.FC<{
  offers: SpecialOffer[];
  highlightOfferId?: string;
  onClaimOffer: (offerId: string) => void;
  onUseOffer: (offer: SpecialOffer) => void;
  onBookWithOffer: (offer: SpecialOffer) => void;
  processing: boolean;
}> = ({
  offers,
  highlightOfferId,
  onClaimOffer,
  onUseOffer,
  onBookWithOffer,
  processing,
}) => {
  if (offers.length === 0) return null;

  return (
    <View className="px-4 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <H3>Special Offers</H3>
        <View className="bg-primary/10 px-3 py-1 rounded-full">
          <Text className="text-primary font-bold text-sm">
            {offers.length} available
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-4">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              highlighted={offer.id === highlightOfferId}
              onClaim={() => onClaimOffer(offer.id)}
              onUse={() => onUseOffer(offer)}
              onBookWithOffer={() => onBookWithOffer(offer)}
              processing={processing}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// Individual offer card component
export const OfferCard: React.FC<{
  offer: SpecialOffer;
  highlighted?: boolean;
  onClaim: () => void;
  onUse: () => void;
  onBookWithOffer: () => void;
  processing: boolean;
}> = ({ offer, highlighted, onClaim, onUse, onBookWithOffer, processing }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const getOfferStatus = () => {
    if (offer.used) {
      return (
        <View className="flex-row items-center bg-green-100 px-2 py-1 rounded-full">
          <CheckCircle size={12} color="#16a34a" />
          <Text className="text-green-700 text-xs ml-1">Used</Text>
        </View>
      );
    }

    if (offer.isExpired) {
      return (
        <View className="flex-row items-center bg-red-100 px-2 py-1 rounded-full">
          <Clock size={12} color="#dc2626" />
          <Text className="text-red-700 text-xs ml-1">Expired</Text>
        </View>
      );
    }

    if (offer.claimed) {
      return (
        <View className="flex-row items-center bg-blue-100 px-2 py-1 rounded-full">
          <Tag size={12} color="#2563eb" />
          <Text className="text-blue-700 text-xs ml-1">Claimed</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View
      className={`bg-card rounded-xl border-2 p-4 w-72 ${
        highlighted ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="font-bold text-lg" numberOfLines={1}>
            {offer.title}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {offer.description}
          </Text>
        </View>

        <View className="bg-primary rounded-full h-12 w-12 items-center justify-center ml-2">
          <Text className="text-white font-bold text-lg">
            {offer.discount_percentage}
          </Text>
          <Text className="text-white text-xs -mt-1">%</Text>
        </View>
      </View>

      {/* Status and expiry */}
      <View className="flex-row items-center justify-between mb-3">
        {getOfferStatus()}
        <Text className="text-xs text-muted-foreground">
          Until {formatDate(offer.valid_until)}
        </Text>
      </View>

      {/* Terms */}
      {offer.minimum_party_size && offer.minimum_party_size > 1 && (
        <View className="flex-row items-center mb-3">
          <Users size={14} color="#666" />
          <Text className="text-xs text-muted-foreground ml-1">
            Min. {offer.minimum_party_size} people
          </Text>
        </View>
      )}

      {/* Action button */}
      <View>
        {!offer.claimed ? (
          <Button
            onPress={onClaim}
            disabled={processing}
            className="w-full"
            size="sm"
          >
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <Tag size={16} color="white" />
                <Text className="text-white font-medium">Claim Offer</Text>
              </View>
            )}
          </Button>
        ) : offer.canUse ? (
          <Button
            onPress={onUse}
            disabled={processing}
            className="w-full"
            size="sm"
          >
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <QrCode size={16} color="white" />
                <Text className="text-white font-medium">Use Now</Text>
              </View>
            )}
          </Button>
        ) : (
          <Button
            onPress={onBookWithOffer}
            disabled={processing}
            className="w-full"
            size="sm"
            variant="outline"
          >
            {processing ? (
              <ActivityIndicator size="small" />
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <Calendar size={16} color="#666" />
                <Text className="font-medium">Book with Offer</Text>
              </View>
            )}
          </Button>
        )}
      </View>
    </View>
  );
};
