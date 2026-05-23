import { create } from "zustand";
import {
  devtools,
  persist,
  createJSONStorage,
  subscribeWithSelector,
} from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";

import type { Restaurant } from "@/types/restaurant";
import type { Database } from "@/types/supabase";

// Enable Immer MapSet plugin to support Set and Map
enableMapSet();

// Profile type definition (matching what we use in the app)
type Profile = {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  phone_number?: string;
  phone_verified?: boolean;
  phone_verified_at?: string;
  avatar_url?: string;
  allergies?: string[];
  favorite_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_party_size?: number;
  notification_preferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    all_muted: boolean;
  };
  loyalty_points?: number;
  membership_tier?: "bronze" | "silver" | "gold" | "platinum";
  onboarded?: boolean;
  completed_bookings?: number;
  created_at?: string;
  updated_at?: string;
};

/**
 * Auth Store - Handles authentication state
 */
interface AuthState {
  // State
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          session: null,
          user: null,
          profile: null,
          isGuest: false,
          initialized: false,
          loading: false,
          error: null,

          // Actions
          setSession: (session) =>
            set((state) => {
              state.session = session;
              if (session) {
                state.user = session.user;
                state.isGuest = false;
              }
            }),

          setUser: (user) =>
            set((state) => {
              state.user = user;
            }),

          setProfile: (profile) =>
            set((state) => {
              state.profile = profile;
            }),

          setIsGuest: (isGuest) =>
            set((state) => {
              state.isGuest = isGuest;
              if (isGuest) {
                state.session = null;
                state.user = null;
                state.profile = null;
              }
            }),

          setInitialized: (initialized) =>
            set((state) => {
              state.initialized = initialized;
            }),

          setLoading: (loading) =>
            set((state) => {
              state.loading = loading;
            }),

          setError: (error) =>
            set((state) => {
              state.error = error;
            }),

          reset: () =>
            set((state) => {
              state.session = null;
              state.user = null;
              state.profile = null;
              state.isGuest = false;
              state.error = null;
            }),
        })),
        {
          name: "auth-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            isGuest: state.isGuest,
            initialized: state.initialized,
          }),
        },
      ),
    ),
    { name: "AuthStore" },
  ),
);

/**
 * App Store - Handles global app state
 */
interface AppState {
  // Network state
  isOnline: boolean;
  networkStrength: "weak" | "strong" | "unknown";

  // UI state
  theme: "light" | "dark" | "system";
  isLoading: boolean;
  globalError: string | null;

  // Location state
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  locationPermission: "granted" | "denied" | "pending";

  // Search state
  recentSearches: string[];
  searchFilters: Record<string, any>;

  // Notifications
  notifications: {
    id: string;
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
  }[];

  // Actions
  setNetworkStatus: (
    isOnline: boolean,
    strength?: "weak" | "strong" | "unknown",
  ) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setLocation: (location: AppState["currentLocation"]) => void;
  setLocationPermission: (permission: AppState["locationPermission"]) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  setSearchFilters: (filters: Record<string, any>) => void;
  addNotification: (
    notification: Omit<
      AppState["notifications"][0],
      "id" | "timestamp" | "read"
    >,
  ) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          isOnline: true,
          networkStrength: "unknown",
          theme: "system",
          isLoading: false,
          globalError: null,
          currentLocation: null,
          locationPermission: "pending",
          recentSearches: [],
          searchFilters: {},
          notifications: [],

          // Actions
          setNetworkStatus: (isOnline, strength = "unknown") =>
            set((state) => {
              state.isOnline = isOnline;
              state.networkStrength = strength;
            }),

          setTheme: (theme) =>
            set((state) => {
              state.theme = theme;
            }),

          setLoading: (loading) =>
            set((state) => {
              state.isLoading = loading;
            }),

          setGlobalError: (error) =>
            set((state) => {
              state.globalError = error;
            }),

          setLocation: (location) =>
            set((state) => {
              state.currentLocation = location;
            }),

          setLocationPermission: (permission) =>
            set((state) => {
              state.locationPermission = permission;
            }),

          addRecentSearch: (search) =>
            set((state) => {
              // Remove if exists and add to front
              state.recentSearches = [
                search,
                ...state.recentSearches.filter((s) => s !== search),
              ].slice(0, 10); // Keep only 10 recent searches
            }),

          clearRecentSearches: () =>
            set((state) => {
              state.recentSearches = [];
            }),

          setSearchFilters: (filters) =>
            set((state) => {
              state.searchFilters = filters;
            }),

          addNotification: (notification) =>
            set((state) => {
              state.notifications.unshift({
                ...notification,
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                read: false,
              });
            }),

          markNotificationRead: (id) =>
            set((state) => {
              const notification = state.notifications.find((n) => n.id === id);
              if (notification) {
                notification.read = true;
              }
            }),

          clearNotifications: () =>
            set((state) => {
              state.notifications = [];
            }),
        })),
        {
          name: "app-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            theme: state.theme,
            recentSearches: state.recentSearches,
            searchFilters: state.searchFilters,
            locationPermission: state.locationPermission,
          }),
        },
      ),
    ),
    { name: "AppStore" },
  ),
);

/**
 * Restaurant Store - Handles restaurant data and favorites with TTL-based caching
 */

// Cache TTL constants (in milliseconds) - OPTIMIZED for better performance
// Restaurant data is relatively static, so longer TTLs reduce unnecessary refetches
const CACHE_TTL = {
  RESTAURANT: 15 * 60 * 1000, // 15 minutes (was 5) - individual restaurant data
  SEARCH_RESULTS: 5 * 60 * 1000, // 5 minutes (was 2) - search results can be cached longer
  RESTAURANT_LIST: 10 * 60 * 1000, // 10 minutes (was 3) - home screen lists
  RESTAURANT_DETAILS: 10 * 60 * 1000, // 10 minutes (was 2) - detailed restaurant view
};

interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

type ReviewWithUser = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url: string | null;
  };
};

interface RestaurantState {
  // Favorites
  favorites: Set<string>;
  favoritesList: Restaurant[];

  // Recently viewed
  recentlyViewed: Restaurant[];

  // Cache with TTL
  restaurantsCache: Map<string, CachedItem<Restaurant>>;
  searchResultsCache: Map<string, CachedItem<Restaurant[]>>;
  restaurantListCache: Map<string, CachedItem<Restaurant[]>>; // For home screen lists
  restaurantDetailsCache: Map<
    string,
    CachedItem<{
      restaurant: Restaurant;
      reviews: ReviewWithUser[];
    }>
  >;

  // Loading states
  favoritesLoading: boolean;
  restaurantLoading: Map<string, boolean>;

  // Actions
  addToFavorites: (restaurantId: string) => void;
  removeFromFavorites: (restaurantId: string) => void;
  toggleFavorite: (restaurantId: string) => void;
  isFavorite: (restaurantId: string) => boolean;
  setFavoritesList: (restaurants: Restaurant[]) => void;
  addToRecentlyViewed: (restaurant: Restaurant) => void;

  // Enhanced cache methods with TTL
  cacheRestaurant: (restaurant: Restaurant, ttl?: number) => void;
  getCachedRestaurant: (id: string) => Restaurant | undefined;
  cacheSearchResults: (
    query: string,
    results: Restaurant[],
    ttl?: number,
  ) => void;
  getCachedSearchResults: (query: string) => Restaurant[] | undefined;
  cacheRestaurantList: (
    key: string,
    restaurants: Restaurant[],
    ttl?: number,
  ) => void;
  getCachedRestaurantList: (key: string) => Restaurant[] | undefined;
  cacheRestaurantDetails: (
    id: string,
    details: { restaurant: Restaurant; reviews: ReviewWithUser[] },
    ttl?: number,
  ) => void;
  getCachedRestaurantDetails: (
    id: string,
  ) => { restaurant: Restaurant; reviews: ReviewWithUser[] } | undefined;
  clearRestaurantDetailsCache: () => void;

  setFavoritesLoading: (loading: boolean) => void;
  setRestaurantLoading: (id: string, loading: boolean) => void;
  clearCache: () => void;
  clearExpiredCache: () => void;
}

export const useRestaurantStore = create<RestaurantState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          favorites: new Set<string>(),
          favoritesList: [],
          recentlyViewed: [],
          restaurantsCache: new Map<string, CachedItem<Restaurant>>(),
          searchResultsCache: new Map<string, CachedItem<Restaurant[]>>(),
          restaurantListCache: new Map<string, CachedItem<Restaurant[]>>(),
          restaurantDetailsCache: new Map<
            string,
            CachedItem<{ restaurant: Restaurant; reviews: ReviewWithUser[] }>
          >(),
          favoritesLoading: false,
          restaurantLoading: new Map<string, boolean>(),

          // Actions
          addToFavorites: (restaurantId) =>
            set((state) => {
              state.favorites.add(restaurantId);
            }),

          removeFromFavorites: (restaurantId) =>
            set((state) => {
              state.favorites.delete(restaurantId);
              state.favoritesList = state.favoritesList.filter(
                (r) => r.id !== restaurantId,
              );
            }),

          toggleFavorite: (restaurantId) =>
            set((state) => {
              if (state.favorites.has(restaurantId)) {
                state.favorites.delete(restaurantId);
                state.favoritesList = state.favoritesList.filter(
                  (r) => r.id !== restaurantId,
                );
              } else {
                state.favorites.add(restaurantId);
              }
            }),

          isFavorite: (restaurantId) => {
            return get().favorites.has(restaurantId);
          },

          setFavoritesList: (restaurants) =>
            set((state: any) => {
              state.favoritesList = restaurants;
            }),

          addToRecentlyViewed: (restaurant) =>
            set((state: any) => {
              // Remove if exists and add to front
              state.recentlyViewed = [
                restaurant,
                ...state.recentlyViewed.filter(
                  (r: { id: string }) => r.id !== restaurant.id,
                ),
              ].slice(0, 20); // Keep only 20 recent items
            }),

          // Enhanced cache methods with TTL
          cacheRestaurant: (restaurant, ttl = CACHE_TTL.RESTAURANT) =>
            set((state: any) => {
              state.restaurantsCache.set(restaurant.id, {
                data: restaurant,
                timestamp: Date.now(),
                ttl,
              });
            }),

          getCachedRestaurant: (id) => {
            const cached = get().restaurantsCache.get(id);
            if (!cached) return undefined;

            // Check if expired
            if (Date.now() - cached.timestamp > cached.ttl) {
              // Remove expired entry
              set((state: any) => {
                state.restaurantsCache.delete(id);
              });
              return undefined;
            }

            return cached.data;
          },

          cacheSearchResults: (
            query,
            results,
            ttl = CACHE_TTL.SEARCH_RESULTS,
          ) =>
            set((state: any) => {
              state.searchResultsCache.set(query, {
                data: results,
                timestamp: Date.now(),
                ttl,
              });
            }),

          getCachedSearchResults: (query) => {
            const cached = get().searchResultsCache.get(query);
            if (!cached) return undefined;

            // Check if expired
            if (Date.now() - cached.timestamp > cached.ttl) {
              // Remove expired entry
              set((state: any) => {
                state.searchResultsCache.delete(query);
              });
              return undefined;
            }

            return cached.data;
          },

          cacheRestaurantList: (
            key,
            restaurants,
            ttl = CACHE_TTL.RESTAURANT_LIST,
          ) =>
            set((state: any) => {
              state.restaurantListCache.set(key, {
                data: restaurants,
                timestamp: Date.now(),
                ttl,
              });
            }),

          getCachedRestaurantList: (key) => {
            const cached = get().restaurantListCache.get(key);
            if (!cached) return undefined;

            // Check if expired
            if (Date.now() - cached.timestamp > cached.ttl) {
              // Remove expired entry
              set((state: any) => {
                state.restaurantListCache.delete(key);
              });
              return undefined;
            }

            return cached.data;
          },

          cacheRestaurantDetails: (
            id,
            details,
            ttl = CACHE_TTL.RESTAURANT_DETAILS,
          ) =>
            set((state: any) => {
              state.restaurantDetailsCache.set(id, {
                data: details,
                timestamp: Date.now(),
                ttl,
              });
            }),

          getCachedRestaurantDetails: (id) => {
            const cached = get().restaurantDetailsCache.get(id);
            if (!cached) return undefined;

            if (Date.now() - cached.timestamp > cached.ttl) {
              set((state: any) => {
                state.restaurantDetailsCache.delete(id);
              });
              return undefined;
            }

            return cached.data;
          },

          clearRestaurantDetailsCache: () =>
            set((state) => {
              state.restaurantDetailsCache.clear();
            }),

          setFavoritesLoading: (loading) =>
            set((state) => {
              state.favoritesLoading = loading;
            }),

          setRestaurantLoading: (id, loading) =>
            set((state) => {
              if (loading) {
                state.restaurantLoading.set(id, true);
              } else {
                state.restaurantLoading.delete(id);
              }
            }),

          clearCache: () =>
            set((state) => {
              state.restaurantsCache.clear();
              state.searchResultsCache.clear();
              state.restaurantListCache.clear();
            }),

          clearExpiredCache: () =>
            set((state: any) => {
              const now = Date.now();

              // Clear expired restaurants
              for (const [id, cached] of state.restaurantsCache.entries()) {
                if (now - cached.timestamp > cached.ttl) {
                  state.restaurantsCache.delete(id);
                }
              }

              // Clear expired search results
              for (const [
                query,
                cached,
              ] of state.searchResultsCache.entries()) {
                if (now - cached.timestamp > cached.ttl) {
                  state.searchResultsCache.delete(query);
                }
              }

              // Clear expired restaurant lists
              for (const [key, cached] of state.restaurantListCache.entries()) {
                if (now - cached.timestamp > cached.ttl) {
                  state.restaurantListCache.delete(key);
                }
              }

              // Clear expired restaurant details
              for (const [
                id,
                cached,
              ] of state.restaurantDetailsCache.entries()) {
                if (now - cached.timestamp > cached.ttl) {
                  state.restaurantDetailsCache.delete(id);
                }
              }
            }),
        })),
        {
          name: "restaurant-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            favorites: Array.from(state.favorites),
            recentlyViewed: state.recentlyViewed,
          }),
          onRehydrateStorage: () => (state) => {
            if (state && Array.isArray(state.favorites)) {
              // Convert array back to Set
              (state as any).favorites = new Set(state.favorites);
            }
          },
        },
      ),
    ),
    { name: "RestaurantStore" },
  ),
);

/**
 * Booking Store - Handles booking state with caching
 */
interface BookingState {
  // Current booking flow
  currentBooking: {
    restaurantId?: string;
    date?: string;
    time?: string;
    partySize?: number;
    specialRequests?: string;
    guestInfo?: {
      name: string;
      email: string;
      phone: string;
    };
  };

  // Bookings lists
  upcomingBookings: any[];
  pastBookings: any[];

  // Booking history
  recentBookings: any[];

  // Cache with TTL (OPTIMIZATION: Add caching for bookings)
  bookingsCache: {
    data: { upcoming: any[]; past: any[] } | null;
    timestamp: number;
    ttl: number;
  };

  // Loading states
  isCreating: boolean;
  availabilityLoading: boolean;
  bookingsLoading: boolean;

  // Actions
  setBookingData: (data: Partial<BookingState["currentBooking"]>) => void;
  clearCurrentBooking: () => void;
  addRecentBooking: (booking: any) => void;
  setCreating: (creating: boolean) => void;
  setAvailabilityLoading: (loading: boolean) => void;
  setBookingsLoading: (loading: boolean) => void;
  setUpcomingBookings: (bookings: any[]) => void;
  setPastBookings: (bookings: any[]) => void;
  addNewBooking: (booking: any) => void;
  updateBooking: (bookingId: string, updates: any) => void;
  removeBooking: (bookingId: string) => void;

  // Cache actions (OPTIMIZATION)
  cacheBookings: (upcoming: any[], past: any[], ttl?: number) => void;
  getCachedBookings: () => { upcoming: any[]; past: any[] } | null;
  clearBookingsCache: () => void;
}

export const useBookingStore = create<BookingState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          currentBooking: {},
          upcomingBookings: [],
          pastBookings: [],
          recentBookings: [],
          bookingsCache: {
            data: null,
            timestamp: 0,
            ttl: 3 * 60 * 1000, // 3 minutes TTL for bookings cache
          },
          isCreating: false,
          availabilityLoading: false,
          bookingsLoading: false,

          // Actions
          setBookingData: (data) =>
            set((state) => {
              state.currentBooking = { ...state.currentBooking, ...data };
            }),

          clearCurrentBooking: () =>
            set((state) => {
              state.currentBooking = {};
            }),

          addRecentBooking: (booking) =>
            set((state) => {
              state.recentBookings.unshift(booking);
              state.recentBookings = state.recentBookings.slice(0, 50); // Keep only 50 recent
            }),

          setCreating: (creating) =>
            set((state) => {
              state.isCreating = creating;
            }),

          setAvailabilityLoading: (loading) =>
            set((state) => {
              state.availabilityLoading = loading;
            }),

          setBookingsLoading: (loading) =>
            set((state) => {
              state.bookingsLoading = loading;
            }),

          setUpcomingBookings: (bookings) =>
            set((state) => {
              state.upcomingBookings = bookings;
            }),

          setPastBookings: (bookings) =>
            set((state) => {
              state.pastBookings = bookings;
            }),

          addNewBooking: (booking) =>
            set((state) => {
              // Clear cache when new booking is added
              state.bookingsCache.data = null;

              // Add to recent bookings
              state.recentBookings.unshift(booking);
              state.recentBookings = state.recentBookings.slice(0, 50);

              // Add to appropriate list based on status and date
              const bookingDate = new Date(booking.booking_time);
              const now = new Date();

              if (
                (booking.status === "pending" ||
                  booking.status === "confirmed") &&
                bookingDate >= now
              ) {
                // Add to upcoming bookings in chronological order
                state.upcomingBookings.push(booking);
                state.upcomingBookings.sort(
                  (a, b) =>
                    new Date(a.booking_time).getTime() -
                    new Date(b.booking_time).getTime(),
                );
              } else {
                // Add to past bookings in reverse chronological order
                state.pastBookings.unshift(booking);
                state.pastBookings = state.pastBookings.slice(0, 50); // Keep only 50 recent
              }
            }),

          updateBooking: (bookingId, updates) =>
            set((state) => {
              // Clear cache when booking is updated
              state.bookingsCache.data = null;

              // Update in upcoming bookings
              const upcomingIndex = state.upcomingBookings.findIndex(
                (b) => b.id === bookingId,
              );
              if (upcomingIndex !== -1) {
                const updatedBooking = {
                  ...state.upcomingBookings[upcomingIndex],
                  ...updates,
                };

                // Check if booking should be moved to past bookings
                const bookingDate = new Date(updatedBooking.booking_time);
                const now = new Date();
                const shouldMoveToPast =
                  updatedBooking.status === "completed" ||
                  updatedBooking.status === "cancelled_by_user" ||
                  updatedBooking.status === "declined_by_restaurant" ||
                  updatedBooking.status === "no_show" ||
                  bookingDate < now;

                if (shouldMoveToPast) {
                  state.upcomingBookings.splice(upcomingIndex, 1);
                  state.pastBookings.unshift(updatedBooking);
                  state.pastBookings = state.pastBookings.slice(0, 50);
                } else {
                  state.upcomingBookings[upcomingIndex] = updatedBooking;
                  // Re-sort upcoming bookings
                  state.upcomingBookings.sort(
                    (a, b) =>
                      new Date(a.booking_time).getTime() -
                      new Date(b.booking_time).getTime(),
                  );
                }
              } else {
                // Update in past bookings
                const pastIndex = state.pastBookings.findIndex(
                  (b) => b.id === bookingId,
                );
                if (pastIndex !== -1) {
                  state.pastBookings[pastIndex] = {
                    ...state.pastBookings[pastIndex],
                    ...updates,
                  };
                }
              }

              // Update in recent bookings
              const recentIndex = state.recentBookings.findIndex(
                (b) => b.id === bookingId,
              );
              if (recentIndex !== -1) {
                state.recentBookings[recentIndex] = {
                  ...state.recentBookings[recentIndex],
                  ...updates,
                };
              }
            }),

          removeBooking: (bookingId) =>
            set((state) => {
              // Clear cache when booking is removed
              state.bookingsCache.data = null;

              state.upcomingBookings = state.upcomingBookings.filter(
                (b) => b.id !== bookingId,
              );
              state.pastBookings = state.pastBookings.filter(
                (b) => b.id !== bookingId,
              );
              state.recentBookings = state.recentBookings.filter(
                (b) => b.id !== bookingId,
              );
            }),

          // Cache actions (OPTIMIZATION)
          cacheBookings: (upcoming, past, ttl = 3 * 60 * 1000) =>
            set((state) => {
              state.bookingsCache = {
                data: { upcoming, past },
                timestamp: Date.now(),
                ttl,
              };
            }),

          getCachedBookings: () => {
            const state = get();
            const cache = state.bookingsCache;

            if (!cache.data) return null;

            // Check if expired
            if (Date.now() - cache.timestamp > cache.ttl) {
              return null;
            }

            return cache.data;
          },

          clearBookingsCache: () =>
            set((state) => {
              state.bookingsCache.data = null;
            }),
        })),
        {
          name: "booking-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            recentBookings: state.recentBookings,
          }),
        },
      ),
    ),
    { name: "BookingStore" },
  ),
);

/**
 * Waiting List Store - Handles waiting list state
 */
interface WaitingListState {
  waitingList: any[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setWaitingList: (entries: any[]) => void;
  addEntry: (entry: any) => void;
  updateWaitingListEntry: (id: string, updates: any) => void;
  removeWaitingListEntry: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchWaitingList: (userId: string) => Promise<void>;
}

export const useWaitingListStore = create<WaitingListState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        waitingList: [],
        isLoading: false,
        error: null,

        // Actions
        setWaitingList: (entries) =>
          set((state) => {
            state.waitingList = entries;
          }),

        addEntry: (entry) =>
          set((state) => {
            state.waitingList.unshift(entry);
          }),

        updateWaitingListEntry: (id, updates) =>
          set((state) => {
            const index = state.waitingList.findIndex(
              (entry) => entry.id === id,
            );
            if (index !== -1) {
              state.waitingList[index] = {
                ...state.waitingList[index],
                ...updates,
              };
            }
          }),

        removeWaitingListEntry: (id) =>
          set((state) => {
            state.waitingList = state.waitingList.filter(
              (entry) => entry.id !== id,
            );
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        fetchWaitingList: async (userId) => {
          const { supabase } = await import("@/config/supabase");

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            // First run automation to update expired entries
            await supabase.rpc("process_waitlist_automation");

            // Get all entries (not just active/notified for waitlist page history)
            const { data, error } = await supabase
              .from("waitlist")
              .select(
                `
                *,
                restaurant:restaurants(id, name, address, main_image_url)
              `,
              )
              .eq("user_id", userId)
              .order("created_at", { ascending: false });

            if (error) {
              throw error;
            }

            set((state) => {
              state.waitingList = data || [];
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.error = error.message || "Failed to fetch waiting list";
              state.isLoading = false;
            });
          }
        },
      })),
    ),
    { name: "WaitingListStore" },
  ),
);

/**
 * Store selectors for performance optimization
 */
export const useAuth = () =>
  useAuthStore((state) => ({
    session: state.session,
    user: state.user,
    profile: state.profile,
    isGuest: state.isGuest,
    initialized: state.initialized,
    loading: state.loading,
    error: state.error,
  }));

export const useAuthActions = () =>
  useAuthStore((state) => ({
    setSession: state.setSession,
    setUser: state.setUser,
    setProfile: state.setProfile,
    setIsGuest: state.setIsGuest,
    setInitialized: state.setInitialized,
    setLoading: state.setLoading,
    setError: state.setError,
    reset: state.reset,
  }));

export const useNetworkStatus = () =>
  useAppStore((state) => ({
    isOnline: state.isOnline,
    networkStrength: state.networkStrength,
  }));

export const useLocation = () =>
  useAppStore((state) => ({
    currentLocation: state.currentLocation,
    locationPermission: state.locationPermission,
  }));

export const useFavorites = () =>
  useRestaurantStore((state) => ({
    favorites: state.favorites,
    favoritesList: state.favoritesList,
    favoritesLoading: state.favoritesLoading,
    isFavorite: state.isFavorite,
    toggleFavorite: state.toggleFavorite,
  }));

export const useCurrentBooking = () =>
  useBookingStore((state) => ({
    currentBooking: state.currentBooking,
    isCreating: state.isCreating,
    setBookingData: state.setBookingData,
    clearCurrentBooking: state.clearCurrentBooking,
  }));

export const useBookingsStore = () =>
  useBookingStore((state) => ({
    upcomingBookings: state.upcomingBookings,
    pastBookings: state.pastBookings,
    bookingsLoading: state.bookingsLoading,
    setUpcomingBookings: state.setUpcomingBookings,
    setPastBookings: state.setPastBookings,
    setBookingsLoading: state.setBookingsLoading,
    addNewBooking: state.addNewBooking,
    updateBooking: state.updateBooking,
    removeBooking: state.removeBooking,
    cacheBookings: state.cacheBookings,
    getCachedBookings: state.getCachedBookings,
    clearBookingsCache: state.clearBookingsCache,
  }));

/**
 * Store subscription hooks for reactive updates
 */
export const useAuthSubscription = (callback: (state: AuthState) => void) => {
  useAuthStore.subscribe(callback);
};

export const useThemeSubscription = (callback: (theme: string) => void) => {
  useAppStore.subscribe((state) => state.theme, callback);
};

/**
 * Store reset for testing and development
 */
export const resetAllStores = () => {
  useAuthStore.persist.clearStorage();
  useAppStore.persist.clearStorage();
  useRestaurantStore.persist.clearStorage();
  useBookingStore.persist.clearStorage();
};

/**
 * Review Prompt Store - Handles post-booking review prompts
 */
interface ReviewPromptState {
  // Dismissed booking IDs (user clicked "Skip")
  dismissedBookingIds: Set<string>;

  // Last time we checked for eligible bookings
  lastCheckedAt: string | null;

  // Currently showing prompt booking ID
  currentPromptBookingId: string | null;

  // Session flag to prevent multiple prompts per session
  sessionPromptShown: boolean;

  // Actions
  dismissBooking: (bookingId: string) => void;
  setCurrentPrompt: (bookingId: string | null) => void;
  markChecked: () => void;
  shouldCheck: () => boolean;
  resetSession: () => void;
}

export const useReviewPromptStore = create<ReviewPromptState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          dismissedBookingIds: new Set<string>(),
          lastCheckedAt: null,
          currentPromptBookingId: null,
          sessionPromptShown: false,

          // Actions
          dismissBooking: (bookingId) =>
            set((state) => {
              state.dismissedBookingIds.add(bookingId);
              state.currentPromptBookingId = null;
              state.sessionPromptShown = true;
            }),

          setCurrentPrompt: (bookingId) =>
            set((state) => {
              state.currentPromptBookingId = bookingId;
              if (bookingId) {
                state.sessionPromptShown = true;
              }
            }),

          markChecked: () =>
            set((state) => {
              state.lastCheckedAt = new Date().toISOString();
            }),

          shouldCheck: () => {
            const state = get();

            // Don't check if already shown this session
            if (state.sessionPromptShown) {
              return false;
            }

            // Don't check if currently showing a prompt
            if (state.currentPromptBookingId) {
              return false;
            }

            // Check if enough time has passed (6 hours)
            if (state.lastCheckedAt) {
              const lastCheck = new Date(state.lastCheckedAt).getTime();
              const now = new Date().getTime();
              const sixHours = 6 * 60 * 60 * 1000;

              if (now - lastCheck < sixHours) {
                return false;
              }
            }

            return true;
          },

          resetSession: () =>
            set((state) => {
              state.sessionPromptShown = false;
            }),
        })),
        {
          name: "review-prompt-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            dismissedBookingIds: Array.from(state.dismissedBookingIds),
            lastCheckedAt: state.lastCheckedAt,
          }),
          onRehydrateStorage: () => (state) => {
            if (state && Array.isArray(state.dismissedBookingIds)) {
              // Convert array back to Set
              (state as any).dismissedBookingIds = new Set(
                state.dismissedBookingIds,
              );
            }
          },
        },
      ),
    ),
    { name: "ReviewPromptStore" },
  ),
);

/**
 * Development helpers
 */
if (__DEV__) {
  // Enable devtools
  (window as any).__ZUSTAND_AUTH_STORE__ = useAuthStore;
  (window as any).__ZUSTAND_APP_STORE__ = useAppStore;
  (window as any).__ZUSTAND_RESTAURANT_STORE__ = useRestaurantStore;
  (window as any).__ZUSTAND_BOOKING_STORE__ = useBookingStore;
  (window as any).__ZUSTAND_REVIEW_PROMPT_STORE__ = useReviewPromptStore;
}
