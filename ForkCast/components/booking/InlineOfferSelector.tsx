import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import {
  Gift,
  Sparkles,
  Tag,
  Clock,
  Users,
  Calendar,
  X,
  CheckCircle,
  QrCode,
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { Image } from "@/components/image";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { useColorScheme } from "@/lib/useColorScheme";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";

interface InlineOfferSelectorProps {
  restaurantId: string;
  onOfferSelect: (
    offer: {
      id: string;
      title: string;
      discount: number;
      redemptionCode: string;
      // Full offer data for booking confirmation
      fullOfferData?: {
        valid_until: string;
        restaurant_id: string;
        discount_percentage: number;
      };
    } | null,
  ) => void;
  selectedOfferId?: string | null;
  disabled?: boolean;
}

export const InlineOfferSelector: React.FC<InlineOfferSelectorProps> = ({
  restaurantId,
  onOfferSelect,
  selectedOfferId,
  disabled = false,
}) => {
  const { colorScheme } = useColorScheme();
  const { offers, loading } = useOffers();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showOfferDetails, setShowOfferDetails] = useState(false);
  const [selectedOfferForDetails, setSelectedOfferForDetails] =
    useState<EnrichedOffer | null>(null);

  // Auto-expand when an offer is pre-selected (from navigation params)
  useEffect(() => {
    if (selectedOfferId && !isExpanded) {
      setIsExpanded(true);
    }
  }, [selectedOfferId]);

  // Filter offers for the current restaurant
  const restaurantOffers = useMemo(() => {
    return offers.filter(
      (offer) =>
        offer.restaurant_id === restaurantId &&
        !offer.isExpired &&
        new Date(offer.valid_until) > new Date(),
    );
  }, [offers, restaurantId]);

  // Sort offers by discount percentage (highest first)
  const sortedOffers = useMemo(() => {
    return [...restaurantOffers].sort(
      (a, b) => (b.discount_percentage || 0) - (a.discount_percentage || 0),
    );
  }, [restaurantOffers]);

  const handleSelectOffer = useCallback(
    (offer: EnrichedOffer) => {
      if (disabled) return;

      // Check if offer is valid for selection
      const now = new Date();
      const validUntil = new Date(offer.valid_until);
      if (now > validUntil) {
        Alert.alert("Offer Expired", "This offer is no longer valid.");
        return;
      }

      // For already claimed offers, check if they can be used
      if (offer.claimed && !offer.canUse) {
        Alert.alert(
          "Offer Not Available",
          offer.used
            ? "This offer has already been used"
            : "This offer has expired",
        );
        return;
      }

      // Toggle selection without claiming to database
      if (selectedOfferId === offer.id) {
        onOfferSelect(null);
      } else {
        onOfferSelect({
          id: offer.id,
          title: offer.title,
          discount: offer.discount_percentage || 0,
          redemptionCode: "", // Will be set during booking confirmation
          fullOfferData: {
            valid_until: offer.valid_until,
            restaurant_id: offer.restaurant_id,
            discount_percentage: offer.discount_percentage || 0,
          },
        });
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [disabled, selectedOfferId, onOfferSelect],
  );

  const handleViewDetails = useCallback((offer: EnrichedOffer) => {
    setSelectedOfferForDetails(offer);
    setShowOfferDetails(true);
  }, []);

  if (loading) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="text-muted-foreground">Loading offers...</Text>
        </View>
      </View>
    );
  }

  if (restaurantOffers.length === 0) {
    return null; // Don't show anything if no offers available
  }

  const OfferCard = ({ offer }: { offer: EnrichedOffer }) => {
    const isSelected = selectedOfferId === offer.id;
    const isExpired = new Date() > new Date(offer.valid_until);
    const canSelect = !isExpired;

    return (
      <Pressable
        onPress={() => canSelect && handleSelectOffer(offer)}
        disabled={!canSelect}
        className={`border-2 rounded-xl p-4 mb-3 ${
          isSelected
            ? "border-primary bg-primary/10"
            : canSelect
              ? "border-border bg-card"
              : "border-border bg-muted/50"
        } ${!canSelect ? "opacity-60" : ""}`}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            {/* Discount badge */}
            <View className="flex-row items-center gap-2 mb-2">
              <View
                className={`rounded-full px-3 py-1 ${
                  isSelected ? "bg-primary" : "bg-green-500"
                }`}
              >
                <Text className="text-white font-bold text-sm">
                  {offer.discount_percentage}% OFF
                </Text>
              </View>
              <Text
                className={`text-xs font-medium ${isExpired ? "text-red-500" : "text-green-500"}`}
              >
                {isExpired ? "Expired" : "Available"}
              </Text>
            </View>

            {/* Offer title */}
            <Text className="font-semibold text-base mb-1" numberOfLines={2}>
              {offer.title}
            </Text>

            {/* Description */}
            {offer.description && (
              <Text
                className="text-sm text-muted-foreground mb-2"
                numberOfLines={2}
              >
                {offer.description}
              </Text>
            )}

            {/* Metadata */}
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-row items-center bg-muted/50 rounded-full px-2 py-1">
                <Calendar size={12} color="#666" />
                <Text className="text-xs text-muted-foreground ml-1">
                  Until {formatDateToDDMMYYYY(new Date(offer.valid_until))}
                </Text>
              </View>
              {(offer.minimum_party_size ?? 0) > 1 && (
                <View className="flex-row items-center bg-muted/50 rounded-full px-2 py-1">
                  <Users size={12} color="#666" />
                  <Text className="text-xs text-muted-foreground ml-1">
                    {offer.minimum_party_size}+ people
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action area */}
          <View className="items-end">
            {isSelected ? (
              <View className="bg-primary rounded-full p-2">
                <CheckCircle size={20} color="white" />
              </View>
            ) : canSelect ? (
              <View className="bg-green-500 rounded-full p-2">
                <Tag size={20} color="white" />
              </View>
            ) : (
              <View className="bg-gray-400 rounded-full p-2">
                <X size={20} color="white" />
              </View>
            )}

            {/* Details button */}
            <Pressable
              onPress={() => handleViewDetails(offer)}
              className="mt-2 px-2 py-1 bg-muted rounded-full"
            >
              <Text className="text-xs text-muted-foreground">Details</Text>
            </Pressable>
          </View>
        </View>

        {/* Action text */}
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-sm font-medium text-center">
            {isSelected
              ? "✓ Will be applied when booking is confirmed"
              : "Tap to select for booking"}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <View
        className={`bg-card border border-border rounded-xl p-4 ${disabled ? "opacity-60" : ""}`}
      >
        {/* Header */}
        <Pressable
          onPress={() => !disabled && setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Sparkles size={20} color="#3b82f6" />
            <View>
              <Text className="font-semibold text-lg">Special Offers</Text>
              <Text className="text-sm text-muted-foreground">
                {restaurantOffers.length} offer
                {restaurantOffers.length !== 1 ? "s" : ""} available
                {selectedOfferId && " • 1 selected"}
              </Text>
            </View>
          </View>
          {!disabled &&
            (isExpanded ? (
              <ChevronUp size={20} color="#3b82f6" />
            ) : (
              <ChevronDown size={20} color="#3b82f6" />
            ))}
        </Pressable>

        {/* Selected offer summary when collapsed */}
        {!isExpanded && selectedOfferId && (
          <View className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            {(() => {
              const selectedOffer = restaurantOffers.find(
                (o) => o.id === selectedOfferId,
              );
              if (!selectedOffer) return null;
              return (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Image
                      {...({
                        source: {
                          uri: selectedOffer.restaurant.main_image_url,
                        },
                        optimizationPreset: "medium",
                        className: "w-12 h-12 rounded-md bg-gray-100",
                        contentFit: "cover",
                      } as any)}
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        className="font-medium text-primary"
                        numberOfLines={1}
                      >
                        {selectedOffer.discount_percentage}% discount applied
                      </Text>
                    </View>
                  </View>
                  <View className="bg-primary rounded-full p-1">
                    <CheckCircle size={16} color="white" />
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Expanded offer list */}
        {isExpanded && (
          <View className="mt-4">
            <Text className="font-medium text-sm text-muted-foreground mb-3">
              AVAILABLE OFFERS ({sortedOffers.length})
            </Text>
            {sortedOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </View>
        )}
      </View>

      {/* Offer Details Modal */}
      <Modal
        visible={showOfferDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOfferDetails(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-2xl p-6 max-h-[80%]">
            {selectedOfferForDetails && (
              <>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="font-bold text-xl">Offer Details</Text>
                  <Pressable
                    onPress={() => setShowOfferDetails(false)}
                    className="p-1"
                  >
                    <X
                      size={24}
                      color={colorScheme === "dark" ? "#fff" : "#000"}
                    />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Restaurant info */}
                  <View className="flex-row items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                    <Image
                      source={{
                        uri: selectedOfferForDetails.restaurant.main_image_url,
                      }}
                      className="w-12 h-12 rounded-lg"
                      contentFit="cover"
                    />
                    <View className="flex-1">
                      <Text className="font-semibold">
                        {selectedOfferForDetails.restaurant.name}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        <Text className="text-sm text-muted-foreground">
                          {selectedOfferForDetails.restaurant.average_rating?.toFixed(
                            1,
                          )}{" "}
                          •{" "}
                          {getDisplayCuisine(
                            selectedOfferForDetails.restaurant.cuisine_type,
                            (selectedOfferForDetails.restaurant as any)
                              .secondary_cuisines,
                            "",
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Offer info */}
                  <View className="mb-4">
                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="bg-green-500 rounded-full px-3 py-1">
                        <Text className="text-white font-bold">
                          {selectedOfferForDetails.discount_percentage}% OFF
                        </Text>
                      </View>
                      <Text
                        className={`text-sm font-medium ${
                          new Date() >
                          new Date(selectedOfferForDetails.valid_until)
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {new Date() >
                        new Date(selectedOfferForDetails.valid_until)
                          ? "Expired"
                          : "Available"}
                      </Text>
                    </View>

                    <Text className="font-bold text-lg mb-2">
                      {selectedOfferForDetails.title}
                    </Text>

                    {selectedOfferForDetails.description && (
                      <Text className="text-muted-foreground mb-4">
                        {selectedOfferForDetails.description}
                      </Text>
                    )}
                  </View>

                  {/* Terms and conditions */}
                  {selectedOfferForDetails.terms_conditions &&
                    selectedOfferForDetails.terms_conditions.length > 0 && (
                      <View className="mb-4">
                        <Text className="font-semibold mb-2">
                          Terms & Conditions
                        </Text>
                        {selectedOfferForDetails.terms_conditions.map(
                          (term, index) => (
                            <Text
                              key={index}
                              className="text-sm text-muted-foreground mb-1"
                            >
                              • {term}
                            </Text>
                          ),
                        )}
                      </View>
                    )}

                  {/* Action button */}
                  <Button
                    onPress={() => {
                      setShowOfferDetails(false);
                      handleSelectOffer(selectedOfferForDetails);
                    }}
                    disabled={
                      new Date() > new Date(selectedOfferForDetails.valid_until)
                    }
                    className="mt-4"
                  >
                    <Text className="text-white font-medium">
                      {selectedOfferForDetails.id === selectedOfferId
                        ? "Remove from Booking"
                        : new Date() >
                            new Date(selectedOfferForDetails.valid_until)
                          ? "Offer Expired"
                          : "Select for Booking"}
                    </Text>
                  </Button>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};
