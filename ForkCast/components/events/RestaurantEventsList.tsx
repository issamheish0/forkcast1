import React, { useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { RestaurantEventCard } from "./RestaurantEventCard";
import { EventDetailsModal } from "./EventDetailsModal";
import { useRestaurantEvents } from "@/hooks/useRestaurantEvents";
import type { RestaurantEventWithOccurrences } from "@/types/events";

interface RestaurantEventsListProps {
  restaurantId: string;
  restaurantName?: string;
}

export function RestaurantEventsList({
  restaurantId,
  restaurantName,
}: RestaurantEventsListProps) {
  const { events, loading, error, hasEvents } =
    useRestaurantEvents(restaurantId);

  const [selectedEvent, setSelectedEvent] =
    useState<RestaurantEventWithOccurrences | null>(null);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);

  const handleEventPress = (event: RestaurantEventWithOccurrences) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  // Don't render if there's an error or no events
  if (error) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <View className="px-4 py-6 items-center">
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text className="text-sm text-muted-foreground mt-2">
          Loading events...
        </Text>
      </View>
    );
  }

  // Show empty state if no events
  if (!hasEvents) {
    return (
      <View className="px-4 py-8 items-center justify-center">
        <Sparkles size={32} color="#9ca3af" />
        <Text className="text-muted-foreground mt-2">No events available</Text>
      </View>
    );
  }

  return (
    <>
      <View className="px-4 py-3 border-b border-border/50">
        {/* Section Header */}
        <View className="flex-row items-center gap-2 mb-3">
          <Text className="text-base font-semibold text-foreground">
            Upcoming Events
          </Text>
        </View>

        {/* Subtitle */}
        <Text className="text-sm text-muted-foreground mb-4">
          Special events and experiences at{" "}
          {restaurantName || "this restaurant"}
        </Text>

        {/* Events List - same ramadan-style card, no restaurant name (already on restaurant page) */}
        <View>
          {events.map((event) => (
            <RestaurantEventCard
              key={event.id}
              event={event}
              onPress={() => handleEventPress(event)}
              variant="ramadan"
              showRestaurantName={false}
            />
          ))}
        </View>
      </View>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          visible={showEventModal}
          event={selectedEvent}
          restaurantId={restaurantId}
          onClose={handleCloseModal}
          variant="ramadan"
        />
      )}
    </>
  );
}
