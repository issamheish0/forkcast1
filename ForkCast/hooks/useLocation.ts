// hooks/useLocation.ts
import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  country: string;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStoredLocation = async () => {
    try {
      const stored = await AsyncStorage.getItem("@user_location");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading stored location:", e);
    }
    return null;
  };

  const storeLocation = async (loc: LocationData) => {
    try {
      await AsyncStorage.setItem("@user_location", JSON.stringify(loc));
    } catch (e) {
      console.error("Error storing location:", e);
    }
  };

  const getCurrentLocation = useCallback(async () => {
    try {
      setLoading(true);

      // Check for stored location first
      const storedLocation = await getStoredLocation();
      if (storedLocation) {
        setLocation(storedLocation);
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        // Use default Beirut location
        const defaultLocation = {
          latitude: 33.8938,
          longitude: 35.5018,
          city: "Beirut",
          district: "Central District",
          country: "Lebanon",
        };
        setLocation(defaultLocation);
        return;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: address.city || "Unknown",
        district: address.district || address.subregion || "Unknown",
        country: address.country || "Lebanon",
      };

      setLocation(locationData);
      await storeLocation(locationData);
      setError(null);
    } catch (err) {
      setError("Failed to get location");
      console.error("Location error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  return {
    location,
    loading,
    error,
    refresh: getCurrentLocation,
    city: location?.city || "Unknown",
    district: location?.district || "Unknown",
  };
}
