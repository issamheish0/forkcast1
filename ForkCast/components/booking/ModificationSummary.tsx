// components/booking/ModificationSummary.tsx
import React from "react";
import { View } from "react-native";
import {
  Calendar,
  Clock,
  Users,
  Gift,
  MapPin,
  Utensils,
  MessageSquare,
  AlertCircle,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import {
  formatLebanonTime,
  formatLebanonDateLong,
  parseFromLebanonTZ,
} from "@/utils/lebanonTime";
import { Database } from "@/types/supabase";

type RestaurantSection =
  Database["public"]["Tables"]["restaurant_sections"]["Row"];

interface ModificationSummaryProps {
  originalBooking: any;
  modifiedFields: any;
  changes: {
    date?: boolean;
    time?: boolean;
    partySize?: boolean;
    offerId?: boolean;
    section?: boolean;
    tablePreferences?: boolean;
    specialRequests?: boolean;
    occasion?: boolean;
    dietaryNotes?: boolean;
  };
  willReleaseOffer: boolean;
  needsTableReassignment: boolean;
  sections?: RestaurantSection[];
}

export const ModificationSummary: React.FC<ModificationSummaryProps> = ({
  originalBooking,
  modifiedFields,
  changes,
  willReleaseOffer,
  needsTableReassignment,
  sections = [],
}) => {
  const hasChanges = Object.keys(changes).length > 0;

  if (!hasChanges) {
    return null;
  }

  const originalTime = parseFromLebanonTZ(originalBooking.booking_time);
  const modifiedTime = modifiedFields.booking_time
    ? new Date(modifiedFields.booking_time)
    : originalTime;

  // Helper to get section name from id
  const getSectionName = (sectionId: string | null | undefined): string => {
    if (!sectionId) return "No preference";
    const section = sections.find((s) => s.id === sectionId);
    return section?.name || sectionId;
  };

  return (
    <View className="mx-4 mb-4">
      <View className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <View className="flex-row items-center mb-3">
          <View className="bg-blue-100 dark:bg-blue-900/40 rounded-full p-2 mr-3">
            <AlertCircle size={20} color="#3b82f6" />
          </View>
          <Text className="font-semibold text-lg text-blue-900 dark:text-blue-100">
            Changes Summary
          </Text>
        </View>

        <View className="space-y-3">
          {/* Date Change */}
          {changes.date && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Calendar size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  DATE
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-200 line-through">
                  {formatLebanonDateLong(originalTime)}
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">
                  {formatLebanonDateLong(modifiedTime)}
                </Text>
              </View>
            </View>
          )}

          {/* Time Change */}
          {changes.time && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Clock size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  TIME
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-200 line-through">
                  {formatLebanonTime(originalTime)}
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">
                  {formatLebanonTime(modifiedTime)}
                </Text>
              </View>
            </View>
          )}

          {/* Party Size Change */}
          {changes.partySize && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Users size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  PARTY SIZE
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-200 line-through">
                  {originalBooking.party_size}{" "}
                  {originalBooking.party_size === 1 ? "guest" : "guests"}
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">
                  {modifiedFields.party_size}{" "}
                  {modifiedFields.party_size === 1 ? "guest" : "guests"}
                </Text>
              </View>
            </View>
          )}

          {/* Offer Change */}
          {changes.offerId && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Gift size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  SPECIAL OFFER
                </Text>
                {willReleaseOffer && (
                  <Text className="text-sm text-blue-800 dark:text-blue-200 mb-1">
                    Previous offer will be released
                  </Text>
                )}
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {modifiedFields.applied_offer_id
                    ? "New offer applied"
                    : "Offer removed"}
                </Text>
              </View>
            </View>
          )}

          {/* Section Change */}
          {changes.section && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <MapPin size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  SECTION
                </Text>
                {originalBooking.preferred_section && (
                  <Text className="text-sm text-blue-800 dark:text-blue-200 line-through capitalize">
                    {getSectionName(originalBooking.preferred_section)}
                  </Text>
                )}
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1 capitalize">
                  {getSectionName(modifiedFields.preferred_section)}
                </Text>
              </View>
            </View>
          )}

          {/* Table Preferences Change */}
          {changes.tablePreferences && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Utensils size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  TABLE PREFERENCES
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {modifiedFields.table_preferences?.length || 0} preferences
                  selected
                </Text>
              </View>
            </View>
          )}

          {/* Occasion Change */}
          {changes.occasion && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Gift size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  OCCASION
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100 capitalize">
                  {modifiedFields.occasion || "None"}
                </Text>
              </View>
            </View>
          )}

          {/* Special Requests Change */}
          {changes.specialRequests && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <MessageSquare size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  SPECIAL REQUESTS
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {modifiedFields.special_requests ? "Updated" : "Cleared"}
                </Text>
              </View>
            </View>
          )}

          {/* Dietary Notes Change */}
          {changes.dietaryNotes && (
            <View className="flex-row items-start gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
              <Utensils size={18} color="#3b82f6" className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  DIETARY NOTES
                </Text>
                <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {modifiedFields.dietary_notes?.length || 0} notes
                </Text>
              </View>
            </View>
          )}

          {/* Table Reassignment Warning */}
          {needsTableReassignment && (
            <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
              <Text className="text-xs text-amber-800 dark:text-amber-200">
                ⚠️ Table reassignment required. The restaurant will assign
                tables when they accept your modified request.
              </Text>
            </View>
          )}

          {/* Expiry Reset Info */}
          <View className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
            <Text className="text-xs text-green-800 dark:text-green-200">
              ✓ Your request expiry timer will reset to 24 hours after saving
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
