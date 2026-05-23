// hooks/useProfileData.ts — Mock stub
import { useAuth } from "@/context/supabase-provider";

const DEFAULT_STATS = {
  totalBookings: 5,
  completedBookings: 3,
  cancelledBookings: 1,
  upcomingBookings: 1,
  favoriteRestaurants: 2,
  totalReviews: 2,
  averageSpending: 0,
  mostVisitedCuisine: "Lebanese",
  mostVisitedRestaurant: null,
  diningStreak: 1,
  memberSince: new Date().toISOString(),
  totalFriends: 0,
  pendingFriendRequests: 0,
  recentFriendActivity: 0,
};

const MOCK_MENU_SECTIONS = [
  {
    title: "Account",
    items: [
      { title: "Edit Profile", icon: "user", route: "edit-profile" },
      { title: "Favorites", icon: "heart", route: "favorites" },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Notifications", icon: "bell", route: "notifications" },
    ],
  },
];

export const useProfileData = () => {
  const { profile, user, signOut, updateProfile } = useAuth();

  return {
    profile,
    user,
    stats: DEFAULT_STATS,
    loading: false,
    refreshing: false,
    uploadingAvatar: false,
    ratingStats: null,
    ratingLoading: false,
    currentRating: 5.0,
    handleAvatarUpload: async () => {},
    handleRefresh: async () => {},
    menuSections: MOCK_MENU_SECTIONS,
  };
};