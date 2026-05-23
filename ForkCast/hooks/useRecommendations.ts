// hooks/useRecommendations.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useLocation } from "@/hooks/useLocation";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";

// 1. Type Definitions for Recommendation System
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];

interface RecommendationScore {
  restaurantId: string;
  score: number;
  reasons: RecommendationReason[];
  confidence: number;
}

interface RecommendationReason {
  type:
    | "cuisine_preference"
    | "ambiance_match"
    | "price_range"
    | "location_proximity"
    | "popular_with_similar_users"
    | "trending"
    | "dietary_match"
    | "special_occasion"
    | "time_based"
    | "weather_based"
    | "social_proof";
  weight: number;
  description: string;
}

interface UserProfile {
  cuisinePreferences: Map<string, number>;
  priceRangePreference: number[];
  ambiancePreferences: string[];
  dietaryRestrictions: string[];
  averagePartySize: number;
  bookingPatterns: {
    preferredDays: number[];
    preferredTimes: string[];
    occasionTypes: Map<string, number>;
  };
  locationPreferences: {
    maxDistance: number;
    preferredAreas: string[];
  };
}

interface RecommendationContext {
  timeOfDay: "breakfast" | "lunch" | "dinner" | "late_night";
  dayOfWeek: number;
  weather?: "sunny" | "rainy" | "cold" | "hot";
  occasion?: string;
  partySize?: number;
  date?: Date;
}

// 2. Main Recommendation Hook
export function useRecommendations(context?: Partial<RecommendationContext>) {
  const { profile } = useAuth();
  const { location } = useLocation();

  const [recommendations, setRecommendations] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache user profile analysis
  const userProfileRef = useRef<UserProfile | null>(null);
  const lastAnalysisRef = useRef<Date | null>(null);

  // 3. Build User Profile from Historical Data
  const buildUserProfile =
    useCallback(async (): Promise<UserProfile | null> => {
      if (!profile?.id) return null;

      try {
        // 3.1 Fetch user's booking history
        const { data: bookings } = await supabase
          .from("bookings")
          .select(
            `
          *,
          restaurant:restaurants (
            cuisine_type,
            price_range,
            ambiance_tags
          )
        `,
          )
          .eq("user_id", profile.id)
          .eq("status", "completed")
          .order("booking_time", { ascending: false })
          .limit(100);

        // 3.2 Fetch user's reviews
        const { data: reviews } = await supabase
          .from("reviews")
          .select(
            `
          *,
          restaurant:restaurants (
            cuisine_type,
            price_range
          )
        `,
          )
          .eq("user_id", profile.id)
          .gte("rating", 4); // Focus on positive experiences

        // 3.3 Analyze cuisine preferences
        const cuisineCount = new Map<string, number>();
        const cuisineRatings = new Map<string, number[]>();

        bookings?.forEach((booking) => {
          if (booking.restaurant?.cuisine_type) {
            cuisineCount.set(
              booking.restaurant.cuisine_type,
              (cuisineCount.get(booking.restaurant.cuisine_type) || 0) + 1,
            );
          }
        });

        reviews?.forEach((review) => {
          if (review.restaurant?.cuisine_type) {
            const ratings =
              cuisineRatings.get(review.restaurant.cuisine_type) || [];
            ratings.push(review.rating);
            cuisineRatings.set(review.restaurant.cuisine_type, ratings);
          }
        });

        // 3.4 Calculate cuisine preference scores
        const cuisinePreferences = new Map<string, number>();
        cuisineCount.forEach((count, cuisine) => {
          const ratings = cuisineRatings.get(cuisine) || [];
          const avgRating =
            ratings.length > 0
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length
              : 3; // Neutral if no ratings

          // Score = frequency * average rating
          const score = (count / (bookings?.length || 1)) * (avgRating / 5);
          cuisinePreferences.set(cuisine, score);
        });

        // 3.5 Analyze price range preferences
        const priceRanges =
          bookings
            ?.map((b) => b.restaurant?.price_range)
            .filter((p): p is number => p !== undefined) || [];

        const priceRangePreference =
          priceRanges.length > 0 ? Array.from(new Set(priceRanges)) : [1, 2, 3];

        // 3.6 Analyze booking patterns
        const bookingTimes =
          bookings?.map((b) => new Date(b.booking_time)) || [];
        const preferredDays = Array.from(
          new Set(bookingTimes.map((d) => d.getDay())),
        );
        const preferredTimes = Array.from(
          new Set(
            bookingTimes.map((d) => {
              const hour = d.getHours();
              if (hour < 11) return "breakfast";
              if (hour < 15) return "lunch";
              if (hour < 21) return "dinner";
              return "late_night";
            }),
          ),
        );

        // 3.7 Build complete user profile
        const userProfile: UserProfile = {
          cuisinePreferences,
          priceRangePreference,
          ambiancePreferences: profile.preferred_ambiance ?? [],
          dietaryRestrictions: profile.dietary_restrictions ?? [],
          averagePartySize: profile.preferred_party_size ?? 2,
          bookingPatterns: {
            preferredDays,
            preferredTimes,
            occasionTypes: new Map(), // Would analyze occasion data
          },
          locationPreferences: {
            maxDistance: 10, // km
            preferredAreas: [], // Would analyze location data
          },
        };

        return userProfile;
      } catch (error) {
        console.error("Error building user profile:", error);
        return null;
      }
    }, [profile?.id]);

  // 4. Helper Functions
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRestaurantHoursForDay = useCallback(
    async (
      restaurant: Restaurant,
      dayOfWeek: number,
      date?: Date,
    ): Promise<{
      shifts: { open: string; close: string }[];
      isOpen: boolean;
    }> => {
      try {
        // Use enhanced availability system to get accurate hours for the specific date
        const checkDate = date || new Date();
        const dayName = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ][dayOfWeek];

        // Fetch restaurant hours data
        const [hoursResult, specialHoursResult, closuresResult] =
          await Promise.all([
            supabase
              .from("restaurant_hours")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .eq("day_of_week", dayName)
              .eq("is_open", true)
              .order("open_time"), // UPDATED: Get all shifts, ordered by open time

            supabase
              .from("restaurant_special_hours")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .eq("date", checkDate.toISOString().split("T")[0])
              .maybeSingle(), // Special hours still single per date

            supabase
              .from("restaurant_closures")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .lte("start_date", checkDate.toISOString().split("T")[0])
              .gte("end_date", checkDate.toISOString().split("T")[0])
              .maybeSingle(), // Closures still single per date range
          ]);

        // Check for closures first
        if (closuresResult.data) {
          // Full-day closure (no specific times)
          if (
            !closuresResult.data.start_time ||
            !closuresResult.data.end_time
          ) {
            return { shifts: [], isOpen: false };
          }
          // Partial closure - will be handled in time-specific checks later
        }

        // Check for special hours
        if (specialHoursResult.data) {
          if (specialHoursResult.data.is_closed) {
            return { shifts: [], isOpen: false };
          }

          let shifts = [
            {
              open: specialHoursResult.data.open_time || "11:00",
              close: specialHoursResult.data.close_time || "22:00",
            },
          ];

          // Filter out time ranges that conflict with partial closures
          if (
            closuresResult.data &&
            closuresResult.data.start_time &&
            closuresResult.data.end_time
          ) {
            shifts = filterShiftsForPartialClosure(shifts, closuresResult.data);
          }

          return {
            shifts,
            isOpen: shifts.length > 0,
          };
        }

        // UPDATED: Use ALL regular hour shifts
        if (hoursResult.data && hoursResult.data.length > 0) {
          let shifts = hoursResult.data
            .filter((h) => h.open_time && h.close_time)
            .map((h) => ({
              open: h.open_time!,
              close: h.close_time!,
            }));

          // Filter out time ranges that conflict with partial closures
          if (
            closuresResult.data &&
            closuresResult.data.start_time &&
            closuresResult.data.end_time
          ) {
            shifts = filterShiftsForPartialClosure(shifts, closuresResult.data);
          }

          return {
            shifts: shifts,
            isOpen: shifts.length > 0,
          };
        }

        // No shifts defined - restaurant is closed
        return {
          shifts: [],
          isOpen: false,
        };
      } catch (error) {
        console.warn("Error getting restaurant hours:", error);
        // Return closed status on error
        return {
          shifts: [],
          isOpen: false,
        };
      }
    },
    [],
  );

  const isOpenAtTime = (
    shifts: { open: string; close: string }[],
    timeOfDay: string,
  ): boolean => {
    // Simplified implementation
    const timeRanges: Record<string, { start: number; end: number }> = {
      breakfast: { start: 6, end: 11 },
      lunch: { start: 11, end: 15 },
      dinner: { start: 17, end: 22 },
      late_night: { start: 22, end: 2 },
    };

    const range = timeRanges[timeOfDay];
    if (!range) return false; // Handle unknown time periods

    // Check if ANY shift covers the time period
    for (const shift of shifts) {
      const [openHour] = shift.open.split(":").map(Number);
      const [closeHour] = shift.close.split(":").map(Number);

      // Check if this shift covers the required time range
      if (openHour <= range.start && closeHour >= range.end) {
        return true;
      }

      // For late night, handle wrap-around
      if (timeOfDay === "late_night") {
        if (closeHour < openHour) {
          // Closes after midnight
          if (openHour <= range.start || closeHour >= range.end) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // 5. Calculate Restaurant Recommendation Score
  const calculateRecommendationScore = useCallback(
    async (
      restaurant: Restaurant,
      userProfile: UserProfile,
      context: RecommendationContext,
    ): Promise<RecommendationScore> => {
      const reasons: RecommendationReason[] = [];
      let totalScore = 0;
      let totalWeight = 0;

      // 4.1 Cuisine Preference Score (Weight: 30%)
      const cuisineScore =
        userProfile.cuisinePreferences.get(restaurant.cuisine_type) || 0;
      if (cuisineScore > 0) {
        const weight = 0.3;
        totalScore += cuisineScore * weight;
        totalWeight += weight;

        reasons.push({
          type: "cuisine_preference",
          weight,
          description: `You love ${restaurant.cuisine_type} cuisine`,
        });
      }

      // 4.2 Price Range Match (Weight: 20%)
      if (
        restaurant.price_range &&
        userProfile.priceRangePreference?.includes(restaurant.price_range)
      ) {
        const weight = 0.2;
        totalScore += weight;
        totalWeight += weight;

        reasons.push({
          type: "price_range",
          weight,
          description: "Matches your preferred price range",
        });
      }

      // 4.3 Dietary Restrictions Match (Weight: 25% if applicable)
      if (userProfile.dietaryRestrictions.length > 0) {
        const matchingOptions =
          restaurant.dietary_options?.filter((option) =>
            userProfile.dietaryRestrictions.some((restriction) =>
              option.toLowerCase().includes(restriction.toLowerCase()),
            ),
          ) || [];

        if (matchingOptions.length > 0) {
          const weight = 0.25;
          const matchScore =
            matchingOptions.length / userProfile.dietaryRestrictions.length;
          totalScore += matchScore * weight;
          totalWeight += weight;

          reasons.push({
            type: "dietary_match",
            weight,
            description: `Offers ${matchingOptions.join(", ")} options`,
          });
        }
      }

      // 4.4 Ambiance Match (Weight: 15% if applicable)
      if (userProfile.ambiancePreferences.length > 0) {
        const restaurantAmbiance = restaurant.ambiance_tags ?? [];
        const matchingTags = restaurantAmbiance.filter((tag) =>
          userProfile.ambiancePreferences.some(
            (pref) => tag.toLowerCase() === pref.toLowerCase(),
          ),
        );

        if (matchingTags.length > 0) {
          const weight = 0.15;
          const matchScore =
            matchingTags.length / userProfile.ambiancePreferences.length;
          totalScore += matchScore * weight;
          totalWeight += weight;

          reasons.push({
            type: "ambiance_match",
            weight,
            description: `Matches your vibe: ${matchingTags.join(", ")}`,
          });
        }
      }

      // 4.5 Location Proximity (Weight: 15%)
      if (
        location &&
        restaurant.location &&
        typeof restaurant.location === "object" &&
        "coordinates" in restaurant.location
      ) {
        const coords = restaurant.location.coordinates as [number, number];
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          coords[1],
          coords[0],
        );

        if (distance <= userProfile.locationPreferences.maxDistance) {
          const weight = 0.15;
          const proximityScore =
            1 - distance / userProfile.locationPreferences.maxDistance;
          totalScore += proximityScore * weight;
          totalWeight += weight;

          reasons.push({
            type: "location_proximity",
            weight,
            description: `Only ${distance.toFixed(1)}km away`,
          });
        }
      }

      // 4.6 Enhanced Time-Based Recommendations (Weight: 10%) - UPDATED
      try {
        const restaurantHours = await getRestaurantHoursForDay(
          restaurant,
          context.dayOfWeek,
          context.date,
        );

        if (
          restaurantHours.isOpen &&
          isOpenAtTime(restaurantHours.shifts, context.timeOfDay)
        ) {
          const weight = 0.1;
          totalScore += weight;
          totalWeight += weight;

          // Special breakfast/brunch recommendations
          if (
            context.timeOfDay === "breakfast" &&
            restaurant.tags?.includes("brunch")
          ) {
            totalScore += 0.05;
            reasons.push({
              type: "time_based",
              weight: weight + 0.05,
              description: "Great for brunch",
            });
          } else {
            // Check if restaurant has multiple shifts (split service)
            if (restaurantHours.shifts.length > 1) {
              reasons.push({
                type: "time_based",
                weight,
                description: `Open for ${context.timeOfDay} service`,
              });
            } else {
              reasons.push({
                type: "time_based",
                weight,
                description: `Open for ${context.timeOfDay}`,
              });
            }
          }
        }
      } catch (error) {
        console.warn(
          "Error checking restaurant hours for recommendations:",
          error,
        );
        // Continue without time-based scoring if hours check fails
      }

      // 4.7 Weather-Based Adjustments
      if (context.weather) {
        if (
          context.weather === "rainy" &&
          restaurant.ambiance_tags?.includes("cozy")
        ) {
          totalScore += 0.05;
          reasons.push({
            type: "weather_based",
            weight: 0.05,
            description: "Cozy atmosphere perfect for rainy days",
          });
        }

        if (context.weather === "sunny" && restaurant.outdoor_seating) {
          totalScore += 0.05;
          reasons.push({
            type: "weather_based",
            weight: 0.05,
            description: "Outdoor seating available",
          });
        }
      }

      // 4.8 Social Proof (Weight: 10%)
      if (
        restaurant.average_rating &&
        restaurant.total_reviews &&
        restaurant.average_rating >= 4.5 &&
        restaurant.total_reviews >= 50
      ) {
        const weight = 0.1;
        totalScore += weight;
        totalWeight += weight;

        reasons.push({
          type: "social_proof",
          weight,
          description: `Highly rated (${restaurant.average_rating}★ from ${restaurant.total_reviews} reviews)`,
        });
      }

      // 4.8 Trending Bonus
      // This would check if restaurant is trending based on recent bookings
      // For now, we'll use a simple heuristic
      if (restaurant.featured) {
        totalScore += 0.05;
        reasons.push({
          type: "trending",
          weight: 0.05,
          description: "Trending this week",
        });
      }

      // 4.9 Calculate confidence based on data availability
      const confidence = totalWeight / 1.0; // Maximum possible weight

      return {
        restaurantId: restaurant.id,
        score: totalScore,
        reasons: reasons.sort((a, b) => b.weight - a.weight),
        confidence,
      };
    },
    [location, getRestaurantHoursForDay],
  );

  const getCurrentContext = (): RecommendationContext => {
    const now = new Date();
    const hour = now.getHours();

    let timeOfDay: RecommendationContext["timeOfDay"];
    if (hour < 11) timeOfDay = "breakfast";
    else if (hour < 15) timeOfDay = "lunch";
    else if (hour < 22) timeOfDay = "dinner";
    else timeOfDay = "late_night";

    return {
      timeOfDay,
      dayOfWeek: now.getDay(),
      ...context,
    };
  };

  // 6. Main Recommendation Generation
  const generateRecommendations = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);
    setError(null);

    try {
      // 6.1 Get or build user profile
      if (
        !userProfileRef.current ||
        !lastAnalysisRef.current ||
        Date.now() - lastAnalysisRef.current.getTime() > 24 * 60 * 60 * 1000 // Refresh daily
      ) {
        userProfileRef.current = await buildUserProfile();
        lastAnalysisRef.current = new Date();
      }

      if (!userProfileRef.current) {
        throw new Error("Failed to build user profile");
      }

      // 6.2 Fetch candidate restaurants (minimal columns for scoring)
      let query = supabase
        .from("restaurants")
        .select(
          "id, name, main_image_url, cuisine_type, secondary_cuisines, price_range, average_rating, total_reviews, status, location, featured, tier, booking_policy, scratch_card_enabled, created_at, updated_at",
        )
        .eq("status", "active")
        .limit(100); // Get more candidates for better filtering

      // Apply basic filters
      if (location) {
        // Would use PostGIS for distance queries in production
        // For now, we'll filter client-side
      }

      const { data: restaurants, error: restaurantsError } = await query;

      if (restaurantsError) throw restaurantsError;

      // 6.3 Score all restaurants with async scoring
      const currentContext = getCurrentContext();
      const scoringPromises = (restaurants || []).map(async (restaurant) => ({
        restaurant,
        scoreData: await calculateRecommendationScore(
          restaurant as any,
          userProfileRef.current!,
          currentContext,
        ),
      }));

      const scoredRestaurants = (await Promise.all(scoringPromises))
        .filter((item) => item.scoreData.score > 0.1) // Minimum threshold
        .sort((a, b) => b.scoreData.score - a.scoreData.score)
        .slice(0, 20); // Top 20 recommendations

      // 6.4 Enhance with collaborative filtering
      // This would compare with similar users' preferences
      // For now, we'll add a simple popularity boost
      const popularRestaurantIds = await getPopularRestaurants();

      const enhancedRecommendations = scoredRestaurants.map((item) => {
        if (popularRestaurantIds?.includes(item.restaurant.id)) {
          item.scoreData.score *= 1.1; // 10% boost for popular restaurants
          item.scoreData.reasons.push({
            type: "popular_with_similar_users",
            weight: 0.1,
            description: "Popular with diners like you",
          });
        }
        return item;
      });

      // 6.5 Re-sort and extract restaurants
      const finalRecommendations = enhancedRecommendations
        .sort((a, b) => b.scoreData.score - a.scoreData.score)
        .map((item) => ({
          ...item.restaurant,
          recommendationReasons: item.scoreData.reasons,
          recommendationScore: item.scoreData.score,
        }));

      setRecommendations(finalRecommendations as any);
    } catch (err) {
      console.error("Error generating recommendations:", err);
      setError("Failed to generate recommendations");
    } finally {
      setLoading(false);
    }
  }, [
    profile?.id,
    location,
    context,
    buildUserProfile,
    calculateRecommendationScore,
  ]);

  // 7. Get Popular Restaurants (Simplified)
  const getPopularRestaurants = async (): Promise<string[]> => {
    try {
      // This would analyze booking patterns across all users
      // For now, return featured restaurants
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("featured", true)
        .eq("status", "active")
        .order("total_reviews", { ascending: false })
        .limit(10);

      return data?.map((r) => r.id) || [];
    } catch (error) {
      console.error("Error fetching popular restaurants:", error);
      return [];
    }
  };

  // 8. Effect to Generate Recommendations
  useEffect(() => {
    if (profile) {
      generateRecommendations();
    }
  }, [profile, generateRecommendations]);

  // 9. Recommendation Actions
  const dismissRecommendation = useCallback((restaurantId: string) => {
    setRecommendations((prev) => prev.filter((r) => r.id !== restaurantId));

    // Track dismissal for future recommendations
    // This would be stored in a user_dismissals table
  }, []);

  const refreshRecommendations = useCallback(() => {
    userProfileRef.current = null; // Force profile rebuild
    generateRecommendations();
  }, [generateRecommendations]);

  return {
    recommendations,
    loading,
    error,
    dismissRecommendation,
    refreshRecommendations,
  };
}

// 10. Specialized Recommendation Hooks
export function useSimilarRestaurants(restaurantId: string) {
  const [similarRestaurants, setSimilarRestaurants] = useState<Restaurant[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilar = async () => {
      try {
        // Get the reference restaurant
        const { data: refRestaurant } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", restaurantId)
          .eq("status", "active")
          .single();

        if (!refRestaurant) return;

        // Find similar restaurants (minimal columns)
        const { data: similar } = await supabase
          .from("restaurants")
          .select(
            "id, name, main_image_url, cuisine_type, secondary_cuisines, price_range, average_rating, total_reviews, status, location, featured, tier, booking_policy, scratch_card_enabled, created_at, updated_at",
          )
          .eq("cuisine_type", refRestaurant.cuisine_type)
          .eq("price_range", refRestaurant.price_range)
          .eq("status", "active")
          .neq("id", restaurantId)
          .limit(5);

        setSimilarRestaurants((similar || []) as any);
      } catch (error) {
        console.error("Error fetching similar restaurants:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [restaurantId]);

  return { similarRestaurants, loading };
}

export function useOccasionRecommendations(occasion: string) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOccasionRestaurants = async () => {
      try {
        // Map occasions to restaurant features
        const occasionTags: Record<string, string[]> = {
          birthday: ["celebration", "cake", "private_room"],
          anniversary: ["romantic", "intimate", "fine_dining"],
          business: ["quiet", "business_lunch", "private_room"],
          date: ["romantic", "intimate", "cozy"],
          family: ["family_friendly", "kids_menu", "spacious"],
        };

        const tags = occasionTags[occasion] || [];

        let query = supabase
          .from("restaurants")
          .select(
            "id, name, main_image_url, cuisine_type, price_range, average_rating, total_reviews, location, status, tags",
          )
          .eq("status", "active")
          .limit(10);

        // Filter by relevant tags
        if (tags.length > 0) {
          query = query.contains("tags", tags);
        }

        const { data } = await query;
        setRestaurants((data || []) as any);
      } catch (error) {
        console.error("Error fetching occasion restaurants:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOccasionRestaurants();
  }, [occasion]);

  return { restaurants, loading };
}

/**
 * Helper function to filter shifts that conflict with partial closures
 */
function filterShiftsForPartialClosure(
  shifts: { open: string; close: string }[],
  closure: { start_time: string; end_time: string },
): { open: string; close: string }[] {
  return shifts.filter((shift) => {
    // Check if shift overlaps with closure period
    const shiftStart = timeToMinutes(shift.open);
    const shiftEnd = timeToMinutes(shift.close);
    const closureStart = timeToMinutes(closure.start_time);
    const closureEnd = timeToMinutes(closure.end_time);

    // If shift ends before closure starts, or shift starts after closure ends, no conflict
    return shiftEnd <= closureStart || shiftStart >= closureEnd;
  });
}

/**
 * Convert time string (HH:mm or HH:mm:ss) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}
