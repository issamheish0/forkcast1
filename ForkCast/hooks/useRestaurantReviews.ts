// hooks/useRestaurantReviews.ts — Supabase-backed with mock fallback
import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "expo-router";
import { supabase } from "@/config/supabase";
import { MOCK_RESTAURANTS } from "@/lib/mockData";

const FILTER_OPTIONS = [
  { id: "all", label: "All Reviews" },
  { id: "recent", label: "Most Recent" },
  { id: "highest", label: "Highest Rated" },
  { id: "lowest", label: "Lowest Rated" },
  { id: "photos", label: "With Photos" },
  { id: "verified", label: "Verified Diners" },
];

const RATING_FILTER_OPTIONS = [
  { id: "all", label: "All Ratings" },
  { id: "5", label: "5 Stars" },
  { id: "4", label: "4 Stars" },
  { id: "3", label: "3 Stars" },
  { id: "2", label: "2 Stars" },
  { id: "1", label: "1 Star" },
];

const MOCK_REVIEWS = [
  {
    id: "review-01",
    user_id: "user-a",
    restaurant_id: "",
    rating: 5,
    comment: "Absolutely amazing food and service. Will definitely come back!",
    photos: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    food_rating: 5,
    service_rating: 5,
    ambiance_rating: 4,
    value_rating: 4,
    recommend_to_friend: true,
    visit_again: true,
    tags: ["Great Food", "Good Service"],
    user: { full_name: "Sarah M.", avatar_url: "https://i.pravatar.cc/150?img=5" },
  },
  {
    id: "review-02",
    user_id: "user-b",
    restaurant_id: "",
    rating: 4,
    comment: "Great atmosphere and delicious dishes. Slightly slow service but worth it.",
    photos: null,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    food_rating: 4,
    service_rating: 3,
    ambiance_rating: 5,
    value_rating: 4,
    recommend_to_friend: true,
    visit_again: true,
    tags: ["Nice Ambiance"],
    user: { full_name: "James K.", avatar_url: "https://i.pravatar.cc/150?img=8" },
  },
  {
    id: "review-03",
    user_id: "user-c",
    restaurant_id: "",
    rating: 4,
    comment: "Solid experience overall. The menu has great variety and prices are fair.",
    photos: null,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    food_rating: 4,
    service_rating: 4,
    ambiance_rating: 4,
    value_rating: 5,
    recommend_to_friend: true,
    visit_again: false,
    tags: ["Good Value"],
    user: { full_name: "Layla R.", avatar_url: "https://i.pravatar.cc/150?img=9" },
  },
];

export const useRestaurantReviews = (restaurantId: string) => {
  const router = useRouter();

  // Restaurant: try Supabase first, fall back to mock
  const [restaurant, setRestaurant] = useState<any>(() => {
    const found = MOCK_RESTAURANTS.find((r) => r.id === restaurantId);
    if (!found) return null;
    return {
      ...found,
      review_summary: {
        average_rating: found.average_rating ?? 4.5,
        total_reviews: 3,
        rating_distribution: { "5": 1, "4": 2, "3": 0, "2": 0, "1": 0 },
        detailed_ratings: { food_avg: 4.3, service_avg: 4.0, ambiance_avg: 4.3, value_avg: 4.3 },
        recommendation_percentage: 100,
      },
    };
  });

  const [allReviews, setAllReviews] = useState<any[]>(
    MOCK_REVIEWS.map((r) => ({ ...r, restaurant_id: restaurantId })),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!restaurantId) return;

    // Fetch restaurant
    supabase
      .from("restaurants")
      .select(`
        id, name, cuisine_type, address, main_image_url, average_rating, total_reviews,
        price_range, review_summary, latitude, longitude, status
      `)
      .eq("id", restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setRestaurant(data);
      });

    // Fetch reviews
    const { data: reviewData } = await supabase
      .from("reviews")
      .select(`
        id, user_id, restaurant_id, rating, comment, photos,
        food_rating, service_rating, ambiance_rating, value_rating,
        recommend_to_friend, visit_again, tags, created_at,
        user:profiles(full_name, avatar_url)
      `)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (reviewData && reviewData.length > 0) {
      setAllReviews(reviewData);
    }
    // else keep mock reviews
  }, [restaurantId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedSort, setSelectedSort] = useState("recent");
  const [selectedRating, setSelectedRating] = useState("all");

  const handleLikeReview = useCallback((_reviewId: string) => {}, []);
  const handleWriteReview = useCallback(() => {
    router.push(`/(protected)/review/create?restaurantId=${restaurantId}`);
  }, [router, restaurantId]);
  const handleDeleteReview = useCallback((_reviewId: string) => {}, []);
  const handleSortChange = useCallback((sort: string) => setSelectedSort(sort), []);
  const handleRatingChange = useCallback((rating: string) => setSelectedRating(rating), []);
  const handleFilterToggle = useCallback(() => setShowFilters((v) => !v), []);
  const handleFilterClose = useCallback(() => setShowFilters(false), []);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);
  const loadMore = useCallback(() => {}, []);

  const displayReviews = useMemo(() => {
    let filtered = [...allReviews];
    if (selectedRating !== "all") {
      filtered = filtered.filter((r) => r.rating === parseInt(selectedRating));
    }
    if (selectedSort === "highest") filtered.sort((a, b) => b.rating - a.rating);
    else if (selectedSort === "lowest") filtered.sort((a, b) => a.rating - b.rating);
    else if (selectedSort === "photos") filtered = filtered.filter((r) => r.photos?.length);
    else filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  }, [allReviews, selectedSort, selectedRating]);

  const hasFilters = selectedSort !== "recent" || selectedRating !== "all";

  return {
    restaurant,
    reviews: displayReviews,
    loading,
    refreshing,
    loadingMore: false,
    hasMore: false,
    showFilters,
    selectedSort,
    selectedRating,
    hasFilters,
    FILTER_OPTIONS,
    RATING_FILTER_OPTIONS,
    handleLikeReview,
    handleWriteReview,
    handleDeleteReview,
    handleSortChange,
    handleRatingChange,
    handleFilterToggle,
    handleFilterClose,
    handleRefresh,
    loadMore,
  };
};

