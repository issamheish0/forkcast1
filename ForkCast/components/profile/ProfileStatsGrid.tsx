import React from "react";
import { View } from "react-native";
import {
  Calendar,
  Users,
  Heart,
  Star,
  TrendingUp,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";

interface ProfileStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  upcomingBookings: number;
  favoriteRestaurants: number;
  totalReviews: number;
  averageSpending: number;
  mostVisitedCuisine: string;
  mostVisitedRestaurant: {
    id: string;
    name: string;
    visits: number;
  } | null;
  diningStreak: number;
  memberSince: string;
  totalFriends: number;
  pendingFriendRequests: number;
  recentFriendActivity: number;
}

interface ProfileStatsGridProps {
  stats: ProfileStats;
}

export const ProfileStatsGrid: React.FC<ProfileStatsGridProps> = ({
  stats,
}) => {
  return (
    <View className="mx-4 mb-6">
      <H3 className="mb-3">Your Dining Journey</H3>
      <View className="flex-row flex-wrap gap-3">
        <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
          <View className="flex-row items-center gap-2 mb-1">
            <Calendar size={20} color="#3b82f6" />
            <Text className="font-bold text-2xl">{stats.totalBookings}</Text>
          </View>
          <Muted className="text-sm">Total Bookings</Muted>
          {stats.upcomingBookings > 0 && (
            <Text className="text-xs text-primary mt-1">
              {stats.upcomingBookings} upcoming
            </Text>
          )}
        </View>

        <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
          <View className="flex-row items-center gap-2 mb-1">
            <Users size={20} color="#10b981" />
            <Text className="font-bold text-2xl">{stats.totalFriends}</Text>
          </View>
          <Muted className="text-sm">Friends</Muted>
          {stats.pendingFriendRequests > 0 && (
            <Text className="text-xs text-red-600 mt-1">
              {stats.pendingFriendRequests} pending
            </Text>
          )}
        </View>

        <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
          <View className="flex-row items-center gap-2 mb-1">
            <Heart size={20} color="#ef4444" />
            <Text className="font-bold text-2xl">
              {stats.favoriteRestaurants}
            </Text>
          </View>
          <Muted className="text-sm">Favorites</Muted>
        </View>

        <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
          <View className="flex-row items-center gap-2 mb-1">
            <Star size={20} color="#f59e0b" />
            <Text className="font-bold text-2xl">{stats.totalReviews}</Text>
          </View>
          <Muted className="text-sm">Reviews</Muted>
        </View>

        <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
          <View className="flex-row items-center gap-2 mb-1">
            <TrendingUp size={20} color="#8b5cf6" />
            <Text className="font-bold text-2xl">{stats.diningStreak}w</Text>
          </View>
          <Muted className="text-sm">Dining Streak</Muted>
        </View>

      </View>
    </View>
  );
};
