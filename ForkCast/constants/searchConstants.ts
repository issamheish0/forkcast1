// constants/searchConstants.ts - Updated with distance filtering
import { GeneralFilters, BookingFilters } from "@/types/search";

// Search Configuration Constants
// Updated to match your actual cuisine categories from homeScreenData.ts
export const CUISINE_TYPES = [
  "American",
  "Cafe",
  "Chinese",
  "French",
  "Greek",
  "Indian",
  "International",
  "Italian",
  "Japanese",
  "Lebanese",
  "Mediterranean",
  "Mediterrasian",
  "Mexican",
  "Seafood",
  "Spanish",
  "Thai",
];

export const FEATURES = [
  { id: "outdoor_seating", label: "Outdoor Seating", field: "outdoor_seating" },
  { id: "valet_parking", label: "Valet Parking", field: "valet_parking" },
  { id: "parking_available", label: "Parking", field: "parking_available" },
  { id: "shisha_available", label: "Shisha", field: "shisha_available" },
  { id: "live_music", label: "Live Music", field: "live_music_schedule" },
];

export const TIME_SLOTS = [
  null, // "Any time"
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

export const PARTY_SIZES = [null, 1, 2, 3, 4, 5, 6, 7, 8]; // null represents "Any"

// Distance filter options
export const DISTANCE_FILTERS = [
  { label: "Within 1km", value: 1 },
  { label: "Within 3km", value: 3 },
  { label: "Within 5km", value: 5 },
  { label: "Within 10km", value: 10 },
  { label: "Within 20km", value: 20 },
  { label: "Any distance", value: null },
];

// Lebanon geographic bounds for realistic coordinates
export const LEBANON_BOUNDS = {
  north: 34.691,
  south: 33.039,
  east: 36.625,
  west: 35.099,
  // Major city centers for realistic distribution
  cities: [
    { name: "Beirut", lat: 33.8938, lng: 35.5018, weight: 0.4 },
    { name: "Tripoli", lat: 34.4332, lng: 35.8498, weight: 0.15 },
    { name: "Sidon", lat: 33.5634, lng: 35.3711, weight: 0.15 },
    { name: "Tyre", lat: 33.2704, lng: 35.2038, weight: 0.1 },
    { name: "Jounieh", lat: 33.9806, lng: 35.6178, weight: 0.1 },
    { name: "Baalbek", lat: 34.0042, lng: 36.2075, weight: 0.1 },
  ],
};

// Default filter values
export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  date: null, // Any date
  time: null, // Any time
  partySize: null, // Any party size
  availableOnly: false,
};

export const DEFAULT_GENERAL_FILTERS: GeneralFilters = {
  sortBy: "recommended",
  cuisines: [],
  features: [],
  priceRange: [1, 2, 3, 4],
  bookingPolicy: "all",
  minRating: 0,
  maxDistance: null, // No distance limit by default (Any distance)
  hasSpecialOffer: "all",
  scratchCardOnly: false,
};

// Map Configuration
export const DEFAULT_MAP_REGION = {
  latitude: 33.8938,
  longitude: 35.5018,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
