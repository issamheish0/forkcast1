// hooks/useLocationWithDistance.ts - Fixed with better debugging
import { useState, useEffect, useCallback } from "react";
import { LocationService, LocationData } from "@/lib/locationService";
import { EventEmitter } from "@/lib/eventEmitter";

// Create event emitter for location updates
const locationEventEmitter = new EventEmitter();

const DEFAULT_LOCATION: LocationData = {
  latitude: 33.8938,
  longitude: 35.5018,
  city: "Beirut",
  district: "Central District",
  country: "Lebanon",
};

export function useLocationWithDistance() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async () => {
    try {
      setError(null);

      const locationData = await LocationService.getCurrentLocation();

      setLocation(locationData);
      locationEventEmitter.emit("locationUpdated", locationData);
    } catch (err) {
      console.error("❌ useLocationWithDistance error:", err);
      setError("Failed to get location");

      const fallback = DEFAULT_LOCATION;
      setLocation(fallback);
      locationEventEmitter.emit("locationUpdated", fallback);
    }
  }, []);

  const updateLocation = useCallback(async (newLocation: LocationData) => {
    setLocation(newLocation);
    await LocationService.updateLocation(newLocation);

    // Emit location update event
    locationEventEmitter.emit("locationUpdated", newLocation);
  }, []);

  const clearLocation = useCallback(async () => {
    await LocationService.clearLocation();
    await getCurrentLocation();
  }, [getCurrentLocation]);

  // Subscribe to location updates from other components
  useEffect(() => {
    const handleLocationUpdate = (newLocation: LocationData) => {
      setLocation(newLocation);
    };

    locationEventEmitter.on("locationUpdated", handleLocationUpdate);

    return () => {
      locationEventEmitter.off("locationUpdated", handleLocationUpdate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Immediately serve cached location so downstream consumers don't block
      const cached = await LocationService.getCachedLocation();
      if (cached && !cancelled) {
        setLocation(cached);
        setLoading(false);
        locationEventEmitter.emit("locationUpdated", cached);
      } else if (!cached && !cancelled) {
        // No cache yet — use default so loading can end without delay
        setLocation(DEFAULT_LOCATION);
        setLoading(false);
      }

      // Refresh GPS in the background (won't block the initial render)
      await getCurrentLocation();
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [getCurrentLocation]);

  return {
    location,
    loading,
    error,
    refresh: getCurrentLocation,
    updateLocation,
    clearLocation,
    calculateDistance: LocationService.calculateDistance,
    formatDistance: LocationService.formatDistance,
    getDisplayName: () => LocationService.getLocationDisplayName(location),
  };
}
