// hooks/useRestaurantReviewsWithReplies.ts — Mock stub
import { useState, useCallback } from "react";

const FILTER_OPTIONS = [
  { id: "all", label: "All Reviews" },
  { id: "recent", label: "Most Recent" },
  { id: "highest", label: "Highest Rated" },
  { id: "lowest", label: "Lowest Rated" },
];

const RATING_FILTER_OPTIONS = [
  { id: "all", label: "All Ratings" },
  { id: "5", label: "5 Stars" },
  { id: "4", label: "4 Stars" },
  { id: "3", label: "3 Stars" },
  { id: "2", label: "2 Stars" },
  { id: "1", label: "1 Star" },
];

export const useRestaurantReviewsWithReplies = (_restaurantId: string) => {
  const [selectedSort, setSelectedSort] = useState("all");
  const [selectedRating, setSelectedRating] = useState("all");

  return {
    restaurant: null,
    reviews: [],
    reviewStats: null,
    loading: false,
    refreshing: false,
    selectedSort,
    selectedRating,
    setSelectedSort,
    setSelectedRating,
    onRefresh: async () => {},
    handleLikeReview: async (_reviewId: string) => {},
    handleWriteReview: () => {},
    filterOptions: FILTER_OPTIONS,
    ratingFilterOptions: RATING_FILTER_OPTIONS,
  };
};