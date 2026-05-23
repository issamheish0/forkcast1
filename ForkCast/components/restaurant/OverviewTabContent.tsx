import React, { RefObject } from "react";
import MapView from "react-native-maps";
import { BookingWidget } from "./BookingWidget";
import { AboutSection } from "./AboutSection";
import { FeaturesAndAmenities } from "./FeaturesAndAmenities";
import { HoursSection } from "./HoursSection";
import { LocationSection } from "./LocationSection";
import { ContactSection } from "./ContactSection";
import type { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface OverviewTabContentProps {
  restaurant: Restaurant;
  selectedDate: Date;
  partySize: number;
  showFullDescription: boolean;
  mapCoordinates: MapCoordinate;
  mapRef: RefObject<MapView>;
  onBooking: () => void;
  onToggleDescription: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onDirectionsPress: () => void;
}

export const OverviewTabContent = ({
  restaurant,
  selectedDate,
  partySize,
  showFullDescription,
  mapCoordinates,
  mapRef,
  onBooking,
  onToggleDescription,
  onCall,
  onWhatsApp,
  onDirectionsPress,
}: OverviewTabContentProps) => {
  return (
    <>
      {/* Booking Widget */}
      <BookingWidget
        restaurant={restaurant}
        initialDate={selectedDate}
        initialPartySize={partySize}
        onBookingSuccess={() => {
          onBooking();
        }}
      />

      {/* About Section */}
      <AboutSection
        restaurant={restaurant as any}
        showFullDescription={showFullDescription}
        onToggleDescription={onToggleDescription}
      />

      {/* Features & Amenities */}
      <FeaturesAndAmenities restaurant={restaurant as any} />

      {/* Hours of Operation */}
      <HoursSection restaurant={restaurant as any} />

      {/* Location Section */}
      <LocationSection
        restaurant={restaurant as any}
        mapCoordinates={mapCoordinates}
        mapRef={mapRef}
        onDirectionsPress={onDirectionsPress}
      />

      {/* Contact Information */}
      <ContactSection
        restaurant={restaurant as any}
        onCall={onCall}
        onWhatsApp={onWhatsApp}
      />
    </>
  );
};
