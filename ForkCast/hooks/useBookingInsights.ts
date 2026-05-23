// hooks/useBookingInsights.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface BookingInsights {
  // Basic Stats
  totalBookings: number;
  totalRestaurants: number;
  completedBookings: number;
  upcomingBookings: number;
  cancelledBookings: number;

  // Fun Stats
  favoriteCuisine: string | null;
  favoriteRestaurant: {
    name: string;
    visits: number;
    id: string;
  } | null;
  favoriteDay: string | null;
  favoriteTime: string | null;
  averagePartySize: number;
  totalGuests: number; // Sum of all party sizes
  longestStreak: number; // Most consecutive months with bookings
  currentStreak: number;

  // Social Stats
  mostExpensiveRestaurant: {
    name: string;
    priceRange: number;
    id: string;
  } | null;
  explorerScore: number; // Percentage of unique restaurants vs total bookings

  // Time-based Stats
  firstBookingDate: string | null;
  daysSinceFirstBooking: number;
  bookingsThisMonth: number;
  bookingsThisYear: number;
  busiestMonth: string | null;

  // Achievements
  achievements: Achievement[];
  nextMilestone: Milestone | null;

  // Trends
  topRestaurants: { name: string; visits: number; id: string }[];
  cuisineBreakdown: { cuisine: string; count: number; percentage: number }[];
  monthlyTrend: { month: string; count: number }[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export interface Milestone {
  title: string;
  description: string;
  progress: number;
  total: number;
  reward?: string;
}

const INSIGHTS_CACHE_KEY = "booking_insights_";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function useBookingInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<BookingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const calculateInsights = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check cache
      const cacheKey = `${INSIGHTS_CACHE_KEY}${user.id}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setInsights(data);
          setLoading(false);
          return;
        }
      }

      // Fetch all bookings with restaurant data
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          booking_time,
          party_size,
          status,
          created_at,
          restaurant:restaurants(
            id,
            name,
            cuisine_type,
            price_range
          )
        `,
        )
        .eq("user_id", user.id)
        .order("booking_time", { ascending: false });

      if (bookingsError) throw bookingsError;

      const now = new Date();
      const completed = bookings?.filter((b) => b.status === "completed") || [];
      const upcoming =
        bookings?.filter(
          (b) =>
            (b.status === "confirmed" || b.status === "pending") &&
            new Date(b.booking_time) > now,
        ) || [];
      const cancelled =
        bookings?.filter(
          (b) =>
            b.status === "cancelled_by_user" ||
            b.status === "declined_by_restaurant" ||
            b.status === "cancelled_by_restaurant",
        ) || [];

      // Calculate unique restaurants
      const uniqueRestaurants = new Set(
        completed.map((b: any) => b.restaurant?.id).filter(Boolean),
      );

      // Find favorite cuisine
      const cuisineCount: Record<string, number> = {};
      completed.forEach((b: any) => {
        if (b.restaurant?.cuisine_type) {
          cuisineCount[b.restaurant.cuisine_type] =
            (cuisineCount[b.restaurant.cuisine_type] || 0) + 1;
        }
      });
      const favoriteCuisine =
        Object.entries(cuisineCount).sort(([, a], [, b]) => b - a)[0]?.[0] ||
        null;

      // Find favorite restaurant
      const restaurantCount: Record<
        string,
        { name: string; count: number; id: string }
      > = {};
      completed.forEach((b: any) => {
        if (b.restaurant?.id) {
          const id = b.restaurant.id;
          if (!restaurantCount[id]) {
            restaurantCount[id] = {
              name: b.restaurant.name,
              count: 0,
              id: id,
            };
          }
          restaurantCount[id].count++;
        }
      });
      const favoriteRestaurant =
        Object.values(restaurantCount).sort((a, b) => b.count - a.count)[0] ||
        null;

      // Find favorite day and time
      const dayCount: Record<string, number> = {};
      const timeCount: Record<string, number> = {};
      completed.forEach((b: any) => {
        const date = new Date(b.booking_time);
        const day = date.toLocaleDateString("en-US", { weekday: "long" });
        const hour = date.getHours();
        const timeSlot =
          hour < 12
            ? "Morning"
            : hour < 17
              ? "Afternoon"
              : hour < 21
                ? "Evening"
                : "Night";

        dayCount[day] = (dayCount[day] || 0) + 1;
        timeCount[timeSlot] = (timeCount[timeSlot] || 0) + 1;
      });
      const favoriteDay =
        Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0]?.[0] || null;
      const favoriteTime =
        Object.entries(timeCount).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      // Calculate average party size and total guests
      const totalGuests = completed.reduce(
        (sum, b: any) => sum + (b.party_size || 0),
        0,
      );
      const averagePartySize =
        completed.length > 0
          ? Math.round((totalGuests / completed.length) * 10) / 10
          : 0;

      // Calculate streaks
      const monthlyBookings = new Map<string, number>();
      completed.forEach((b: any) => {
        const monthKey = new Date(b.booking_time).toISOString().substring(0, 7);
        monthlyBookings.set(monthKey, (monthlyBookings.get(monthKey) || 0) + 1);
      });

      const sortedMonths = Array.from(monthlyBookings.keys()).sort();
      let longestStreak = 0;
      let currentStreak = 0;
      let tempStreak = 0;

      for (let i = 0; i < sortedMonths.length; i++) {
        if (
          i === 0 ||
          isConsecutiveMonth(sortedMonths[i - 1], sortedMonths[i])
        ) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      // Current streak
      const currentMonth = now.toISOString().substring(0, 7);
      if (monthlyBookings.has(currentMonth)) {
        currentStreak = 1;
        let checkMonth = currentMonth;
        for (let i = 1; i < 12; i++) {
          const prevMonth = getPreviousMonth(checkMonth);
          if (monthlyBookings.has(prevMonth)) {
            currentStreak++;
            checkMonth = prevMonth;
          } else {
            break;
          }
        }
      }

      // Most expensive restaurant
      const expensiveRestaurants = completed
        .filter((b: any) => b.restaurant?.price_range)
        .sort(
          (a: any, b: any) =>
            (b.restaurant?.price_range || 0) - (a.restaurant?.price_range || 0),
        );
      const mostExpensiveRestaurant = (expensiveRestaurants[0] as any)?.restaurant
        ? {
            name: (expensiveRestaurants[0] as any).restaurant.name,
            priceRange: (expensiveRestaurants[0] as any).restaurant.price_range,
            id: (expensiveRestaurants[0] as any).restaurant.id,
          }
        : null;

      // Explorer score
      const explorerScore =
        completed.length > 0
          ? Math.round((uniqueRestaurants.size / completed.length) * 100)
          : 0;

      // Time stats
      const firstBooking = completed[completed.length - 1];
      const firstBookingDate = firstBooking?.created_at || null;
      const daysSinceFirstBooking = firstBookingDate
        ? Math.floor(
            (now.getTime() - new Date(firstBookingDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      const bookingsThisMonth = completed.filter((b: any) => {
        const bookingDate = new Date(b.booking_time);
        return (
          bookingDate.getMonth() === now.getMonth() &&
          bookingDate.getFullYear() === now.getFullYear()
        );
      }).length;

      const bookingsThisYear = completed.filter((b: any) => {
        const bookingDate = new Date(b.booking_time);
        return bookingDate.getFullYear() === now.getFullYear();
      }).length;

      // Busiest month
      const busiestMonth =
        Array.from(monthlyBookings.entries()).sort(
          ([, a], [, b]) => b - a,
        )[0]?.[0] || null;

      // Top 5 restaurants
      const topRestaurants = Object.values(restaurantCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((r) => ({
          name: r.name,
          visits: r.count,
          id: r.id,
        }));

      // Cuisine breakdown
      const totalCompleted = completed.length;
      const cuisineBreakdown = Object.entries(cuisineCount)
        .map(([cuisine, count]) => ({
          cuisine,
          count,
          percentage: Math.round((count / totalCompleted) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Monthly trend (last 6 months)
      const monthlyTrend: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7);
        const monthName = date.toLocaleDateString("en-US", { month: "short" });
        monthlyTrend.push({
          month: monthName,
          count: monthlyBookings.get(monthKey) || 0,
        });
      }

      // Achievements
      const achievements = calculateAchievements(completed.length, {
        totalRestaurants: uniqueRestaurants.size,
        longestStreak,
        explorerScore,
        bookingsThisMonth,
      });

      // Next milestone
      const nextMilestone = calculateNextMilestone(completed.length, {
        totalRestaurants: uniqueRestaurants.size,
        currentStreak,
      });

      const insightsData: BookingInsights = {
        totalBookings: bookings?.length || 0,
        totalRestaurants: uniqueRestaurants.size,
        completedBookings: completed.length,
        upcomingBookings: upcoming.length,
        cancelledBookings: cancelled.length,
        favoriteCuisine,
        favoriteRestaurant: favoriteRestaurant
          ? {
              name: favoriteRestaurant.name,
              visits: favoriteRestaurant.count,
              id: favoriteRestaurant.id,
            }
          : null,
        favoriteDay,
        favoriteTime,
        averagePartySize,
        totalGuests,
        longestStreak,
        currentStreak,
        mostExpensiveRestaurant,
        explorerScore,
        firstBookingDate,
        daysSinceFirstBooking,
        bookingsThisMonth,
        bookingsThisYear,
        busiestMonth,
        achievements,
        nextMilestone,
        topRestaurants,
        cuisineBreakdown,
        monthlyTrend,
      };

      // Cache the result
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: insightsData, timestamp: Date.now() }),
      );

      setInsights(insightsData);
    } catch (err) {
      console.error("Error calculating insights:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    calculateInsights();
  }, [calculateInsights]);

  const refresh = useCallback(async () => {
    if (user?.id) {
      const cacheKey = `${INSIGHTS_CACHE_KEY}${user.id}`;
      await AsyncStorage.removeItem(cacheKey);
      await calculateInsights();
    }
  }, [user?.id, calculateInsights]);

  return {
    insights,
    loading,
    error,
    refresh,
  };
}

// Helper functions
function isConsecutiveMonth(month1: string, month2: string): boolean {
  const date1 = new Date(month1 + "-01");
  const date2 = new Date(month2 + "-01");
  date1.setMonth(date1.getMonth() + 1);
  return date1.getTime() === date2.getTime();
}

function getPreviousMonth(monthStr: string): string {
  const date = new Date(monthStr + "-01");
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().substring(0, 7);
}

function calculateAchievements(
  totalBookings: number,
  stats: {
    totalRestaurants: number;
    longestStreak: number;
    explorerScore: number;
    bookingsThisMonth: number;
  },
): Achievement[] {
  const achievements: Achievement[] = [];
  const now = new Date().toISOString();

  // Booking milestones
  if (totalBookings >= 1) {
    achievements.push({
      id: "first_booking",
      title: "First Bite",
      description: "Completed your first booking",
      icon: "🎉",
      unlockedAt: now,
      rarity: "common",
    });
  }
  if (totalBookings >= 10) {
    achievements.push({
      id: "regular",
      title: "Regular Diner",
      description: "Completed 10 bookings",
      icon: "🍽️",
      unlockedAt: now,
      rarity: "common",
    });
  }
  if (totalBookings >= 25) {
    achievements.push({
      id: "foodie",
      title: "Foodie",
      description: "Completed 25 bookings",
      icon: "👨‍🍳",
      unlockedAt: now,
      rarity: "rare",
    });
  }
  if (totalBookings >= 50) {
    achievements.push({
      id: "connoisseur",
      title: "Connoisseur",
      description: "Completed 50 bookings",
      icon: "🌟",
      unlockedAt: now,
      rarity: "epic",
    });
  }
  if (totalBookings >= 100) {
    achievements.push({
      id: "legend",
      title: "Dining Legend",
      description: "Completed 100 bookings!",
      icon: "👑",
      unlockedAt: now,
      rarity: "legendary",
    });
  }

  // Explorer achievements
  if (stats.totalRestaurants >= 10) {
    achievements.push({
      id: "explorer",
      title: "Explorer",
      description: "Visited 10 different restaurants",
      icon: "🗺️",
      unlockedAt: now,
      rarity: "rare",
    });
  }
  if (stats.explorerScore >= 80) {
    achievements.push({
      id: "adventurer",
      title: "Adventurer",
      description: "80% of bookings at unique restaurants",
      icon: "🧭",
      unlockedAt: now,
      rarity: "epic",
    });
  }

  // Streak achievements
  if (stats.longestStreak >= 3) {
    achievements.push({
      id: "consistent",
      title: "Consistent",
      description: "3-month dining streak",
      icon: "🔥",
      unlockedAt: now,
      rarity: "rare",
    });
  }
  if (stats.longestStreak >= 6) {
    achievements.push({
      id: "dedicated",
      title: "Dedicated",
      description: "6-month dining streak",
      icon: "💪",
      unlockedAt: now,
      rarity: "epic",
    });
  }

  // Activity achievements
  if (stats.bookingsThisMonth >= 5) {
    achievements.push({
      id: "active_month",
      title: "Busy Month",
      description: "5+ bookings this month",
      icon: "📅",
      unlockedAt: now,
      rarity: "rare",
    });
  }

  return achievements;
}

function calculateNextMilestone(
  totalBookings: number,
  stats: { totalRestaurants: number; currentStreak: number },
): Milestone | null {
  const milestones = [
    { total: 10, title: "Regular Diner", reward: "🍽️ Badge" },
    { total: 25, title: "Foodie Status", reward: "👨‍🍳 Badge" },
    { total: 50, title: "Connoisseur", reward: "🌟 Badge" },
    { total: 100, title: "Dining Legend", reward: "👑 Badge" },
  ];

  const nextBookingMilestone = milestones.find((m) => totalBookings < m.total);
  if (nextBookingMilestone) {
    return {
      title: nextBookingMilestone.title,
      description: `Complete ${nextBookingMilestone.total} bookings`,
      progress: totalBookings,
      total: nextBookingMilestone.total,
      reward: nextBookingMilestone.reward,
    };
  }

  // Restaurant explorer milestone
  const restaurantMilestones = [10, 25, 50, 100];
  const nextRestaurantMilestone = restaurantMilestones.find(
    (m) => stats.totalRestaurants < m,
  );
  if (nextRestaurantMilestone) {
    return {
      title: "Restaurant Explorer",
      description: `Visit ${nextRestaurantMilestone} different restaurants`,
      progress: stats.totalRestaurants,
      total: nextRestaurantMilestone,
      reward: "🗺️ Badge",
    };
  }

  return null;
}
