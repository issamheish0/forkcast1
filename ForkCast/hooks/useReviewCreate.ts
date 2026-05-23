// hooks/useReviewCreate.ts — Mock stub
import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

interface UseReviewCreateParams {
  bookingId: string;
  restaurantId: string;
}

export function useReviewCreate({ bookingId: _b, restaurantId: _r }: UseReviewCreateParams) {
  const router = useRouter();
  const [overallRating, setOverallRating] = useState(0);
  const [detailedRatings, setDetailedRatings] = useState({ food: 0, service: 0, ambiance: 0, value: 0 });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  return {
    restaurant: null,
    booking: null,
    loading: false,
    submitting: false,
    form: {} as any,
    overallRating,
    setOverallRating,
    detailedRatings,
    setDetailedRatings,
    selectedTags,
    setSelectedTags,
    photos,
    setPhotos,
    currentStep,
    setCurrentStep,
    submitReview: async () => {
      Alert.alert("Mock Mode", "Review submitted (mock)!");
      router.back();
    },
    validateStep: (_step: number) => true,
  };
}