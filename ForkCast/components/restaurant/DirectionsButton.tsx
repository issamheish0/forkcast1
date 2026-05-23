// components/restaurant/DirectionsButton.tsx
import React, { useCallback } from "react";
import { Pressable, Platform, Linking, Alert } from "react-native";
import { Navigation } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Database } from "@/types/supabase";
import { LocationService } from "@/lib/locationService";

type Restaurant =
  | {
      id: string;
      name: string;
      staticCoordinates?: { lat: number; lng: number };
      coordinates?: { latitude: number; longitude: number };
      location?: any;
      [key: string]: any;
    }
  | any;

interface DirectionsButtonProps {
  restaurant: Restaurant;
  onDirections?: (restaurant: Restaurant) => void;
  variant?: "icon" | "button" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
  // Custom styling props
  iconColor?: string;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  // Custom button styling
  buttonVariant?: "default" | "outline" | "ghost" | "destructive";
  // Custom icon styling
  iconClassName?: string;
  textClassName?: string;
}

export function DirectionsButton({
  restaurant,
  onDirections,
  variant = "icon",
  size = "md",
  className,
  showText = false,
  // Custom styling props
  iconColor,
  textColor,
  backgroundColor,
  borderColor,
  buttonVariant = "default",
  iconClassName,
  textClassName,
}: DirectionsButtonProps) {
  // Directions handler - shows choice between Apple Maps and Google Maps
  const handleDirections = useCallback(async () => {
    if (onDirections) {
      // Use the provided onDirections handler if available
      onDirections(restaurant);
      return;
    }

    // Get coordinates
    const r: any = restaurant;
    let coords =
      r.staticCoordinates ||
      (r.coordinates
        ? {
            lat: r.coordinates.latitude,
            lng: r.coordinates.longitude,
          }
        : null);

    // If no processed coordinates, try to extract from location
    if (!coords && r.location) {
      const extractedCoords = LocationService.extractCoordinates(r.location);
      if (extractedCoords) {
        coords = {
          lat: extractedCoords.latitude,
          lng: extractedCoords.longitude,
        };
      }
    }

    // Fallback to default coordinates
    if (!coords) {
      coords = {
        lat: 33.8938, // Default Beirut coordinates
        lng: 35.5018,
      };
    }

    const latLng = `${coords.lat},${coords.lng}`;
    const label = encodeURIComponent(restaurant.name);

    // Show choice dialog
    Alert.alert(
      "Choose Maps App",
      "Select your preferred maps application:",
      [
        {
          text: "Apple Maps",
          onPress: async () => {
            const url = Platform.select({
              ios: `maps:0,0?q=${label}@${latLng}`,
              android: `geo:0,0?q=${latLng}(${label})`,
            });
            if (url) {
              try {
                await Linking.openURL(url);
              } catch (error) {
                console.error("Error opening Apple Maps:", error);
                Alert.alert("Error", "Unable to open Apple Maps");
              }
            }
          },
        },
        {
          text: "Google Maps",
          onPress: async () => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&destination_place_id=${label}`;
            try {
              await Linking.openURL(url);
            } catch (error) {
              console.error("Error opening Google Maps:", error);
              Alert.alert("Error", "Unable to open Google Maps");
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true },
    );
  }, [restaurant, onDirections]);

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 16;
      case "lg":
        return 24;
      default:
        return 20;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm":
        return "text-xs";
      case "lg":
        return "text-base";
      default:
        return "text-sm";
    }
  };

  if (variant === "icon") {
    const defaultIconColor = iconColor || "white";
    const defaultBgColor = backgroundColor || "bg-black/50";

    return (
      <Pressable
        onPress={(e) => {
          e.stopPropagation(); // Prevent card press
          handleDirections();
        }}
        className={cn("rounded-full p-2", defaultBgColor, className)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Navigation
          size={getIconSize()}
          color={defaultIconColor}
          className={iconClassName}
        />
      </Pressable>
    );
  }

  if (variant === "button") {
    const defaultIconColor = iconColor || "#3b82f6";
    const defaultTextColor = textColor || "text-primary";
    const defaultBgColor = backgroundColor || "bg-primary/10";

    return (
      <Pressable
        onPress={handleDirections}
        className={cn(
          "flex-row items-center gap-1 px-3 py-1.5 rounded-full",
          defaultBgColor,
          borderColor && `border ${borderColor}`,
          className,
        )}
      >
        <Navigation
          size={getIconSize()}
          color={defaultIconColor}
          className={iconClassName}
        />
        <Text
          className={cn(
            "font-medium",
            getTextSize(),
            defaultTextColor,
            textClassName,
          )}
        >
          Directions
        </Text>
      </Pressable>
    );
  }

  if (variant === "text") {
    const defaultIconColor = iconColor || "#666";
    const defaultTextColor = textColor || "text-muted-foreground";

    return (
      <Pressable
        onPress={handleDirections}
        className={cn("flex-row items-center gap-1", className)}
      >
        <Navigation
          size={getIconSize()}
          color={defaultIconColor}
          className={iconClassName}
        />
        {showText && (
          <Text className={cn(getTextSize(), defaultTextColor, textClassName)}>
            Directions
          </Text>
        )}
      </Pressable>
    );
  }

  return null;
}
