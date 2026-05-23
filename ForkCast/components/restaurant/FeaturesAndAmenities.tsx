import React from "react";
import { View } from "react-native";
import { Trees, Car, Cigarette, Info } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { useColorScheme } from "@/lib/useColorScheme";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[] | null;
  tags?: string[] | null;
  outdoor_seating?: boolean;
  valet_parking?: boolean;
  parking_available?: boolean;
  shisha_available?: boolean;
};

// Feature Icons Mapping
const FEATURE_ICONS = {
  "Outdoor Seating": Trees,
  "Valet Parking": Car,
  "Parking Available": Car,
  Shisha: Cigarette,
  "Live Music": Info,
  "Free WiFi": Info,
};

// Dietary Icons Mapping
const DIETARY_ICONS = {
  Vegetarian: "🥗",
  Vegan: "🌱",
  Halal: "🥩",
  "Gluten-Free": "🌾",

  "Dairy-Free": "🥛",
  "Nut-Free": "🥜",
};

interface FeaturesAndAmenitiesProps {
  restaurant: Restaurant;
}

export const FeaturesAndAmenities = ({
  restaurant,
}: FeaturesAndAmenitiesProps) => {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#fff' : '#374151';
  const hasFeatures =
    restaurant.outdoor_seating ||
    restaurant.valet_parking ||
    restaurant.parking_available ||
    restaurant.shisha_available ||
    (restaurant.tags && restaurant.tags.length > 0);

  const hasDietaryOptions =
    restaurant.dietary_options && restaurant.dietary_options.length > 0;

  if (!hasFeatures && !hasDietaryOptions) {
    return null;
  }

  return (
    <>
      {/* Features Grid */}
      {hasFeatures && (
        <View className="px-4 mb-6">
          <H3 className="mb-3">Features & Amenities</H3>
          <View className="flex-row flex-wrap gap-3">
            {restaurant.outdoor_seating && (
              <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <Trees size={20} color={iconColor} />
                <Text>Outdoor Seating</Text>
              </View>
            )}
            {restaurant.valet_parking && (
              <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <Car size={20} color={iconColor} />
                <Text>Valet Parking</Text>
              </View>
            )}
            {restaurant.parking_available && (
              <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <Car size={20} color={iconColor} />
                <Text>Parking Available</Text>
              </View>
            )}
            {restaurant.shisha_available && (
              <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <Cigarette size={20} color={iconColor} />
                <Text>Shisha</Text>
              </View>
            )}
            {restaurant.tags?.map((tag) => (
              <View
                key={tag}
                className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg"
              >
                {FEATURE_ICONS[tag as keyof typeof FEATURE_ICONS] ? (
                  React.createElement(
                    FEATURE_ICONS[tag as keyof typeof FEATURE_ICONS],
                    { size: 20, color: iconColor },
                  )
                ) : (
                  <Info size={20} color={iconColor} />
                )}
                <Text>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Dietary Options */}
      {hasDietaryOptions && (
        <View className="px-4 mb-6">
          <H3 className="mb-3">Dietary Options</H3>
          <View className="flex-row flex-wrap gap-3">
            {restaurant.dietary_options?.map((option) => (
              <View
                key={option}
                className="flex-row items-center gap-2 bg-green-100 dark:bg-green-900/20 px-3 py-2 rounded-lg"
              >
                <Text className="text-lg">
                  {DIETARY_ICONS[option as keyof typeof DIETARY_ICONS] || "✓"}
                </Text>
                <Text className="text-green-800 dark:text-green-200">
                  {option}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
};
