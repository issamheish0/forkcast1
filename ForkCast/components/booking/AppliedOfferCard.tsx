import React, { useCallback } from "react";
import { View, Pressable, Alert, Share } from "react-native";
import {
  Gift,
  CheckCircle,
  Copy,
  Share2,
  Tag,
  DollarSign,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface AppliedOfferDetails {
  special_offer_id: string;
  special_offer_title: string;
  special_offer_description: string;
  discount_percentage: number;
  user_offer_id: string;
  redemption_code: string;
  used_at: string;
  claimed_at: string;
  estimated_savings: number;
  terms_conditions?: string[];
  valid_until: string;
  minimum_party_size?: number;
}

interface AppliedOfferCardProps {
  offerDetails: AppliedOfferDetails;
  onCopyCode: () => void;
  onViewOffers: () => void;
  onShareOffer: () => void;
}

export const AppliedOfferCard: React.FC<AppliedOfferCardProps> = ({
  offerDetails,
  onCopyCode,
  onViewOffers,
  onShareOffer,
}) => {
  const formatDate = useCallback((dateString: string) => {
    return formatDateToDDMMYYYY(new Date(dateString));
  }, []);

  return (
    <View className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6 mb-4 shadow-lg">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3">
          <View className="bg-green-500 rounded-full p-2">
            <Gift size={24} color="white" />
          </View>
          <View>
            <Text className="font-bold text-xl text-green-800 dark:text-green-200">
              Special Offer Applied
            </Text>
            <Text className="text-green-700 dark:text-green-300 text-sm">
              Active discount on this booking
            </Text>
          </View>
        </View>

        <View className="bg-green-600 rounded-full px-4 py-2">
          <Text className="text-white font-bold text-lg">
            {offerDetails.discount_percentage}% OFF
          </Text>
        </View>
      </View>

      {/* Offer Details */}
      <View className="mb-4">
        <Text className="font-bold text-lg text-green-800 dark:text-green-200 mb-2">
          {offerDetails.special_offer_title}
        </Text>
        <Text className="text-green-700 dark:text-green-300 text-base leading-relaxed">
          {offerDetails.special_offer_description}
        </Text>
      </View>

      {/* Savings & Usage Info */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
              Estimated Savings
            </Text>
            <View className="flex-row items-center gap-2">
              <DollarSign size={20} color="#059669" />
              <Text className="text-green-800 dark:text-green-200 text-2xl font-bold">
                {offerDetails.estimated_savings.toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="items-end">
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
              Status
            </Text>
            <View className="flex-row items-center gap-1">
              <CheckCircle size={16} color="#059669" />
              <Text className="text-green-800 dark:text-green-200 font-bold">
                Applied
              </Text>
            </View>
          </View>
        </View>

        {/* Usage timestamp */}
        <Text className="text-green-600 dark:text-green-400 text-xs">
          Used on {formatDate(offerDetails.used_at)}
        </Text>
      </View>

      {/* Redemption Code Section */}
      <View className="bg-green-100 dark:bg-green-800 rounded-xl border-2 border-dashed border-green-400 p-4 mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium mb-1">
              Redemption Code
            </Text>
            <Text className="font-mono text-xl font-bold text-green-800 dark:text-green-200">
              {offerDetails.redemption_code.slice(-8).toUpperCase()}
            </Text>
          </View>
          <Pressable
            onPress={onCopyCode}
            className="bg-green-500 rounded-full p-3"
          >
            <Copy size={20} color="white" />
          </Pressable>
        </View>
        <Text className="text-green-600 dark:text-green-400 text-xs mt-2">
          This code was used for your discount
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3 mb-4">
        <Button
          variant="outline"
          onPress={onShareOffer}
          className="flex-1 border-green-400"
        >
          <View className="flex-row items-center justify-center gap-2">
            <Share2 size={16} color="#059669" />
            <Text className="text-green-700">Share Deal</Text>
          </View>
        </Button>

        <Button
          variant="outline"
          onPress={onViewOffers}
          className="flex-1 border-green-400"
        >
          <View className="flex-row items-center justify-center gap-2">
            <Tag size={16} color="#059669" />
            <Text className="text-green-700">More Offers</Text>
          </View>
        </Button>
      </View>

      {/* Terms & Conditions */}
      {offerDetails.terms_conditions &&
        offerDetails.terms_conditions.length > 0 && (
          <View className="border-t border-green-200 dark:border-green-700 pt-4">
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium mb-2">
              Terms & Conditions
            </Text>
            {offerDetails.terms_conditions.slice(0, 3).map((term, index) => (
              <Text
                key={index}
                className="text-green-600 dark:text-green-400 text-xs mb-1"
              >
                • {term}
              </Text>
            ))}
            {offerDetails.terms_conditions.length > 3 && (
              <Text className="text-green-600 dark:text-green-400 text-xs mt-1 font-medium">
                +{offerDetails.terms_conditions.length - 3} more terms
              </Text>
            )}
          </View>
        )}

      {/* Additional info */}
      <View className="mt-4 p-3 bg-green-200 dark:bg-green-900 rounded-lg">
        <Text className="text-green-800 dark:text-green-200 text-sm font-medium text-center">
          🎉 This offer saved you money on your dining experience!
        </Text>
      </View>
    </View>
  );
};
