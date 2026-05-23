// lib/locationService.ts - Enhanced version with minor improvements
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/config/supabase";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData extends LocationCoordinates {
  city: string;
  district: string;
  country: string;
}

const STORAGE_KEY = "@user_location";
const DEFAULT_LOCATION: LocationData = {
  latitude: 33.8938,
  longitude: 35.5018,
  city: "Beirut",
  district: "Central District",
  country: "Lebanon",
};

// Lebanon geographical bounds for validation
const LEBANON_BOUNDS = {
  north: 34.691,
  south: 33.039,
  east: 36.625,
  west: 35.099,
};

export class LocationService {
  // Validate if coordinates are within Lebanon (optional validation)
  static isInLebanon(coords: LocationCoordinates): boolean {
    return (
      coords.latitude >= LEBANON_BOUNDS.south &&
      coords.latitude <= LEBANON_BOUNDS.north &&
      coords.longitude >= LEBANON_BOUNDS.west &&
      coords.longitude <= LEBANON_BOUNDS.east
    );
  }

  // Enhanced coordinate validation
  static isValidCoordinate(lat: number, lng: number): boolean {
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      // Ensure they're not exactly 0,0 (likely invalid)
      !(lat === 0 && lng === 0)
    );
  }

  // Extract coordinates from PostGIS WKB or WKT format
  static extractCoordinates(location: any): LocationCoordinates | null {
    if (!location) {
      return null;
    }

    // Handle PostGIS WKT POINT format: "POINT(longitude latitude)"
    if (typeof location === "string" && location.includes("POINT")) {
      // Detected WKT POINT format
      const match = location.match(/POINT\s*\(\s*([^)]+)\s*\)/i);
      if (match && match[1]) {
        const coords = match[1].trim().split(/\s+/);
        if (coords.length >= 2) {
          const lng = parseFloat(coords[0]);
          const lat = parseFloat(coords[1]);
          if (LocationService.isValidCoordinate(lat, lng)) {
            const result = { latitude: lat, longitude: lng };
            // Extracted WKT coordinates
            return result;
          }
        }
      }
    }

    // Handle PostGIS WKB hex format
    if (typeof location === "string" && location.match(/^0101000020/)) {
      // Detected WKB hex format
      const coords = LocationService.parseWKB(location);
      if (coords) {
        // Extracted WKB coordinates
        return coords;
      }
    }

    // Handle GeoJSON Point
    if (
      typeof location === "object" &&
      location?.type === "Point" &&
      Array.isArray(location.coordinates)
    ) {
      // Detected GeoJSON Point
      const [lng, lat] = location.coordinates;
      if (LocationService.isValidCoordinate(lat, lng)) {
        const result = { latitude: lat, longitude: lng };
        // Extracted GeoJSON coordinates
        return result;
      }
    }

    // Handle direct coordinate objects
    if (typeof location === "object") {
      let lat, lng;

      // Try lat/lng format
      if (location.lat !== undefined && location.lng !== undefined) {
        lat = Number(location.lat);
        lng = Number(location.lng);
      }
      // Try latitude/longitude format
      else if (
        location.latitude !== undefined &&
        location.longitude !== undefined
      ) {
        lat = Number(location.latitude);
        lng = Number(location.longitude);
      }

      if (
        lat !== undefined &&
        lng !== undefined &&
        LocationService.isValidCoordinate(lat, lng)
      ) {
        const result = { latitude: lat, longitude: lng };
        // Extracted object coordinates
        return result;
      }
    }

    // Could not extract coordinates from location
    return null;
  }

  // Parse PostGIS WKB format with improved error handling
  static parseWKB(wkb: string): LocationCoordinates | null {
    try {
      const hex = wkb.replace(/^0x/i, "");

      if (hex.length < 42) {
        // WKB hex too short
        return null;
      }

      // For POINT with SRID, coordinates start at position 18 (after header)
      const coordsHex = hex.substring(18);

      if (coordsHex.length < 32) {
        // Not enough coordinate data
        return null;
      }

      // Extract X (longitude) and Y (latitude) - each is 16 hex chars (8 bytes)
      const xHex = coordsHex.substring(0, 16);
      const yHex = coordsHex.substring(16, 32);

      const longitude = LocationService.hexToFloat64LE(xHex);
      const latitude = LocationService.hexToFloat64LE(yHex);

      // Enhanced validation
      if (!LocationService.isValidCoordinate(latitude, longitude)) {
        // Invalid parsed coordinates
        return null;
      }

      return { latitude, longitude };
    } catch (error) {
      // WKB parsing error
      return null;
    }
  }

  // Convert hex string to IEEE 754 double (little endian)
  static hexToFloat64LE(hex: string): number {
    if (hex.length !== 16) return NaN;

    try {
      const bytes = new ArrayBuffer(8);
      const view = new DataView(bytes);

      // Parse as little endian
      for (let i = 0; i < 8; i++) {
        const byte = parseInt(hex.substr(i * 2, 2), 16);
        view.setUint8(i, byte);
      }

      return view.getFloat64(0, true); // true = little endian
    } catch {
      return NaN;
    }
  }

  // Calculate distance using Haversine formula
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Get restaurants with distance - robust method with fallbacks and retry logic
  static async getRestaurantsWithDistance(
    userLocation: LocationCoordinates,
    maxDistance?: number | null,
    retryCount: number = 0,
  ): Promise<any[]> {
    // Getting restaurants with distance

    try {
      // First try: PostGIS ST_X and ST_Y functions
      // Method 1: Using PostGIS ST_X/ST_Y functions

      const { data: restaurants, error } = await supabase
        .from("restaurants")
        .select(
          `
          id, name, main_image_url, cuisine_type, secondary_cuisines, price_range, average_rating, total_reviews, status, location, featured, tier, booking_policy, scratch_card_enabled, created_at, updated_at,
          longitude:ST_X(location::geometry),
          latitude:ST_Y(location::geometry)
        `,
        )
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("average_rating", { ascending: false });

      if (error) {
        // PostGIS method failed

        // Retry once if it's a temporary error
        if (
          retryCount === 0 &&
          (error.message.includes("timeout") ||
            error.message.includes("connection"))
        ) {
          // Retrying PostGIS method
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          return LocationService.getRestaurantsWithDistance(
            userLocation,
            maxDistance,
            1,
          );
        }

        return LocationService.fallbackMethod(userLocation, maxDistance);
      }

      // Got restaurants from PostGIS method

      const processedRestaurants =
        restaurants?.map((restaurant: any, index) => {
          // Processing restaurant

          let coords: LocationCoordinates | null = null;

          // Use PostGIS extracted coordinates if valid
          if (
            restaurant.latitude &&
            restaurant.longitude &&
            LocationService.isValidCoordinate(
              restaurant.latitude,
              restaurant.longitude,
            )
          ) {
            coords = {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            };
            // Using PostGIS coordinates
          } else {
            // Fallback to manual extraction
            // PostGIS failed, trying manual extraction
            coords = LocationService.extractCoordinates(restaurant.location);
            if (coords) {
              // Manual extraction successful
            } else {
              // No coordinates found
            }
          }

          const distance = coords
            ? LocationService.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                coords.latitude,
                coords.longitude,
              )
            : null;

          if (distance !== null) {
            // Distance calculated
          }

          // Clean up temporary fields
          const { latitude, longitude, ...cleanRestaurant } = restaurant;

          return {
            ...cleanRestaurant,
            distance,
            coordinates: coords,
          };
        }) || [];

      return LocationService.filterAndSortRestaurants(
        processedRestaurants,
        userLocation,
        maxDistance,
      );
    } catch (error) {
      // Error in main method

      // Retry once on unexpected errors
      if (retryCount === 0) {
        // Retrying after unexpected error
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return LocationService.getRestaurantsWithDistance(
          userLocation,
          maxDistance,
          1,
        );
      }

      return LocationService.fallbackMethod(userLocation, maxDistance);
    }
  }

  // Fallback method using raw location field
  static async fallbackMethod(
    userLocation: LocationCoordinates,
    maxDistance?: number | null,
  ) {
    // Using fallback method with raw location parsing

    try {
      const { data: restaurants, error } = await supabase
        .from("restaurants")
        .select(
          "id, name, main_image_url, cuisine_type, secondary_cuisines, price_range, average_rating, total_reviews, status, location, featured, tier, booking_policy, scratch_card_enabled, created_at, updated_at",
        )
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("average_rating", { ascending: false });

      if (error) throw error;

      // Fallback: Got restaurants

      const processedRestaurants =
        restaurants?.map((restaurant, index) => {
          // Fallback processing restaurant

          const coords = LocationService.extractCoordinates(
            restaurant.location,
          );

          const distance = coords
            ? LocationService.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                coords.latitude,
                coords.longitude,
              )
            : null;

          if (distance !== null) {
            // Distance calculated
          }

          return {
            ...restaurant,
            distance,
            coordinates: coords,
          };
        }) || [];

      return LocationService.filterAndSortRestaurants(
        processedRestaurants,
        userLocation,
        maxDistance,
      );
    } catch (error) {
      // Fallback method failed
      return [];
    }
  }

  // Filter and sort restaurants with enhanced logging
  static filterAndSortRestaurants(
    restaurants: any[],
    userLocation: LocationCoordinates,
    maxDistance?: number | null,
  ) {
    // Filtering and sorting restaurants

    // Filter out restaurants without coordinates
    let validRestaurants = restaurants.filter((r) => r.coordinates !== null);
    // Restaurants have valid coordinates

    // Log some examples
    if (validRestaurants.length > 0) {
      validRestaurants.slice(0, 3).forEach((r, i) => {
        // Sample restaurant
      });
    }

    // Apply distance filter if specified
    if (maxDistance && maxDistance > 0) {
      const beforeCount = validRestaurants.length;
      validRestaurants = validRestaurants.filter(
        (r) => r.distance !== null && r.distance <= maxDistance,
      );
    }

    // Sort by distance, with featured restaurants prioritized
    validRestaurants.sort((a, b) => {
      // Featured restaurants first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      // Then by distance
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    return validRestaurants;
  }

  // Format distance for display
  static formatDistance(distance: number | null): string {
    if (distance === null || distance === undefined) return "Distance unknown";
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  }

  // Return cached location from AsyncStorage without triggering GPS
  static async getCachedLocation(): Promise<LocationData | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as LocationData;
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Enhanced location detection with better error handling
  static async getCurrentLocation(): Promise<LocationData> {
    try {
      // Request permission with better error messages
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(DEFAULT_LOCATION),
        );
        return DEFAULT_LOCATION;
      }

      // Get current position with timeout and accuracy settings
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // For GPS location, use reverse geocoding to get actual street/area names
      // This ensures we get real location names from the map

      let locationData: LocationData;
      try {
        // Try reverse geocoding to get real street/area names
        const geocodePromise = Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        // Add timeout to reverse geocoding
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Geocoding timeout")), 10000),
        );

        const [address] = (await Promise.race([
          geocodePromise,
          timeoutPromise,
        ])) as any;

        // Extract real location names from geocoding result
        let detectedCity = "Unknown Location";
        let detectedDistrict = "Unknown Area";

        if (address) {
          // Try to get the most specific location names available
          detectedCity =
            address.city ||
            address.subregion ||
            address.region ||
            address.administrativeArea ||
            address.country ||
            "Unknown Location";

          detectedDistrict =
            address.district ||
            address.street ||
            address.name ||
            address.locality ||
            address.subLocality ||
            address.neighborhood ||
            "Unknown Area";

          // If we got generic names, try to be more specific
          if (
            detectedCity === "Lebanon" ||
            detectedCity === "Unknown Location"
          ) {
            detectedCity = "Unknown Location";
          }
          if (
            detectedDistrict === "Lebanon" ||
            detectedDistrict === "Unknown Area"
          ) {
            detectedDistrict = "Unknown Area";
          }
        }

        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: detectedCity,
          district: detectedDistrict,
          country: address?.country || "Lebanon",
        };
      } catch (geocodeError) {
        // Reverse geocoding failed
        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: "Unknown Location",
          district: "Unknown Area",
          country: "Lebanon",
        };
      }

      // Validate coordinates are reasonable for Lebanon area
      // But be more lenient - if we have valid GPS coordinates, use them even if outside Lebanon
      if (!LocationService.isInLebanon(locationData)) {
        // Location outside Lebanon bounds, but using GPS coordinates anyway
        // Don't fall back to default - use the actual GPS location
        // This allows users outside Lebanon to still use the app
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locationData));

      return locationData;
    } catch (error) {
      // Error getting location
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LOCATION));
      return DEFAULT_LOCATION;
    }
  }

  // Update stored location
  static async updateLocation(location: LocationData): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  }

  // Clear stored location
  static async clearLocation(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // Get location display name
  static getLocationDisplayName(location: LocationData | null): string {
    if (!location) return "Select location";

    // If we have specific city/district info from map, use it
    if (
      location.district &&
      location.city &&
      location.district !== location.city &&
      location.district !== "Unknown Area" &&
      location.city !== "Unknown Location" &&
      location.district !== "GPS Location" &&
      location.city !== "Current Location"
    ) {
      return `${location.district}, ${location.city}`;
    }

    // If we have a city name that's not generic, use it
    if (
      location.city &&
      location.city !== "Current Location" &&
      location.city !== "Unknown Location"
    ) {
      return location.city;
    }

    // If we have GPS coordinates but no good location names, show coordinates
    if (location.latitude && location.longitude) {
      return `GPS: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }

    return "Current Location";
  }

  // Convert coordinates to PostGIS format
  static toPostGISFormat(lat: number, lng: number): string {
    return `POINT(${lng} ${lat})`;
  }

  // Find the closest city from predefined Lebanon locations
  static findClosestCity(
    latitude: number,
    longitude: number,
  ): { city: string; district: string } {
    // Import the Lebanon locations from the LocationSelector component
    const LEBANON_LOCATIONS = [
      // Beirut Districts
      {
        id: "beirut-central",
        city: "Beirut",
        district: "Central District",
        coordinates: { latitude: 33.8938, longitude: 35.5018 },
      },
      {
        id: "beirut-hamra",
        city: "Beirut",
        district: "Hamra",
        coordinates: { latitude: 33.8959, longitude: 35.4797 },
      },
      {
        id: "beirut-achrafieh",
        city: "Beirut",
        district: "Achrafieh",
        coordinates: { latitude: 33.8854, longitude: 35.5209 },
      },
      {
        id: "beirut-gemmayzeh",
        city: "Beirut",
        district: "Gemmayzeh",
        coordinates: { latitude: 33.8958, longitude: 35.5144 },
      },
      {
        id: "beirut-mar-mikhael",
        city: "Beirut",
        district: "Mar Mikhael",
        coordinates: { latitude: 33.8969, longitude: 35.5262 },
      },
      {
        id: "beirut-verdun",
        city: "Beirut",
        district: "Verdun",
        coordinates: { latitude: 33.8791, longitude: 35.4834 },
      },
      {
        id: "beirut-ras-beirut",
        city: "Beirut",
        district: "Ras Beirut",
        coordinates: { latitude: 33.9006, longitude: 35.4815 },
      },
      {
        id: "beirut-badaro",
        city: "Beirut",
        district: "Badaro",
        coordinates: { latitude: 33.8792, longitude: 35.5156 },
      },
      {
        id: "beirut-sodeco",
        city: "Beirut",
        district: "Sodeco",
        coordinates: { latitude: 33.8831, longitude: 35.5131 },
      },
      {
        id: "beirut-raouche",
        city: "Beirut",
        district: "Raouche",
        coordinates: { latitude: 33.8912, longitude: 35.4792 },
      },

      // Mount Lebanon
      {
        id: "jounieh",
        city: "Jounieh",
        district: "Keserwan",
        coordinates: { latitude: 33.9806, longitude: 35.6178 },
      },
      {
        id: "dbayeh",
        city: "Dbayeh",
        district: "Metn",
        coordinates: { latitude: 33.9481, longitude: 35.5872 },
      },
      {
        id: "antelias",
        city: "Antelias",
        district: "Metn",
        coordinates: { latitude: 33.9139, longitude: 35.5858 },
      },
      {
        id: "zalka",
        city: "Zalka",
        district: "Metn",
        coordinates: { latitude: 33.9264, longitude: 35.5711 },
      },
      {
        id: "jal-el-dib",
        city: "Jal el Dib",
        district: "Metn",
        coordinates: { latitude: 33.9386, longitude: 35.5958 },
      },
      {
        id: "baabda",
        city: "Baabda",
        district: "Baabda",
        coordinates: { latitude: 33.8339, longitude: 35.5442 },
      },
      {
        id: "aley",
        city: "Aley",
        district: "Aley",
        coordinates: { latitude: 33.8106, longitude: 35.5992 },
      },
      {
        id: "broummana",
        city: "Broummana",
        district: "Metn",
        coordinates: { latitude: 33.8831, longitude: 35.6442 },
      },
      {
        id: "beit-mery",
        city: "Beit Mery",
        district: "Metn",
        coordinates: { latitude: 33.8531, longitude: 35.6097 },
      },
      {
        id: "kaslik",
        city: "Kaslik",
        district: "Keserwan",
        coordinates: { latitude: 33.9706, longitude: 35.6125 },
      },

      // North Lebanon
      {
        id: "batroun",
        city: "Batroun",
        district: "Batroun",
        coordinates: { latitude: 34.2556, longitude: 35.6586 },
      },
      {
        id: "byblos",
        city: "Byblos",
        district: "Jbeil",
        coordinates: { latitude: 34.1224, longitude: 35.6487 },
      },
      {
        id: "tripoli",
        city: "Tripoli",
        district: "Tripoli",
        coordinates: { latitude: 34.4332, longitude: 35.8498 },
      },
      {
        id: "chekka",
        city: "Chekka",
        district: "Batroun",
        coordinates: { latitude: 34.3006, longitude: 35.7089 },
      },
      {
        id: "zgharta",
        city: "Zgharta",
        district: "Zgharta",
        coordinates: { latitude: 34.3983, longitude: 35.9006 },
      },

      // South Lebanon
      {
        id: "tyre",
        city: "Tyre",
        district: "Tyre",
        coordinates: { latitude: 33.2704, longitude: 35.2038 },
      },
      {
        id: "sidon",
        city: "Sidon",
        district: "Sidon",
        coordinates: { latitude: 33.5634, longitude: 35.3711 },
      },
      {
        id: "nabatieh",
        city: "Nabatieh",
        district: "Nabatieh",
        coordinates: { latitude: 33.3789, longitude: 35.4839 },
      },
      {
        id: "jezzine",
        city: "Jezzine",
        district: "Jezzine",
        coordinates: { latitude: 33.5456, longitude: 35.5789 },
      },

      // Bekaa
      {
        id: "zahle",
        city: "Zahle",
        district: "Zahle",
        coordinates: { latitude: 33.8463, longitude: 35.9019 },
      },
      {
        id: "baalbek",
        city: "Baalbek",
        district: "Baalbek",
        coordinates: { latitude: 34.0042, longitude: 36.2075 },
      },
      {
        id: "chtaura",
        city: "Chtaura",
        district: "Zahle",
        coordinates: { latitude: 33.8206, longitude: 35.8556 },
      },
    ];

    let closestLocation = LEBANON_LOCATIONS[0]; // Default to first location
    let minDistance = Number.MAX_VALUE;

    for (const location of LEBANON_LOCATIONS) {
      const distance = LocationService.calculateDistance(
        latitude,
        longitude,
        location.coordinates.latitude,
        location.coordinates.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestLocation = location;
      }
    }

    return {
      city: closestLocation.city,
      district: closestLocation.district,
    };
  }
}
