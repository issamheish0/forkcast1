// app/(protected)/review/create.tsx
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, Muted, P } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useAuth } from "@/context/supabase-provider";
import { useReviewCreate } from "@/hooks/useReviewCreate";
import { REVIEW_TAGS } from "@/constants/reviewConstants";
import ReviewCreateScreenSkeleton from "@/components/skeletons/ReviewCreateScreenSkeleton";

// Extracted Components
import { ReviewHeader } from "@/components/review/ReviewHeader";
import { ReviewRatingStep } from "@/components/rating/ReviewRatingStep";
import { DetailedRatingsStep } from "@/components/rating/DetailedRatingsStep";
import { ReviewTagsStep } from "@/components/rating/ReviewTagsStep";
import { ReviewWriteStep } from "@/components/review/ReviewWriteStep";

export default function ReviewCreateScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId: string;
    restaurantId: string;
    restaurantName: string;
  }>();

  const {
    // Data
    restaurant,
    booking,
    loading,
    submitting,

    // Form state
    form,
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

    // Actions
    submitReview,
    validateStep,
  } = useReviewCreate({
    bookingId: params.bookingId,
    restaurantId: params.restaurantId,
  });

  // Review steps configuration
  const reviewSteps = [
    {
      title: "Overall Experience",
      subtitle: "How was your visit?",
      component: (
        <ReviewRatingStep
          rating={overallRating}
          onRatingChange={setOverallRating}
          recommendToFriend={form.watch("recommendToFriend")}
          onRecommendChange={(recommend) =>
            form.setValue("recommendToFriend", recommend)
          }
          visitAgain={form.watch("visitAgain")}
          onVisitAgainChange={(visitAgain) =>
            form.setValue("visitAgain", visitAgain)
          }
        />
      ),
    },
    {
      title: "Detailed Ratings",
      subtitle: "Rate specific aspects",
      component: (
        <DetailedRatingsStep
          ratings={detailedRatings}
          onRatingsChange={setDetailedRatings}
          onIndividualRatingChange={(category, rating) => {
            form.setValue(`${category}Rating` as any, rating);
          }}
        />
      ),
    },
    {
      title: "Quick Tags",
      subtitle: "What stood out?",
      component: (
        <ReviewTagsStep
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          positiveTagOptions={REVIEW_TAGS.positive}
          negativeTagOptions={REVIEW_TAGS.negative}
        />
      ),
    },
    {
      title: "Share Your Experience",
      subtitle: "Tell others about your visit",
      component: (
        <ReviewWriteStep
          form={form}
          comment={form.watch("comment")}
          photos={photos}
          onPhotosChange={setPhotos}
          userId={profile?.id}
          bookingId={params.bookingId}
        />
      ),
    },
  ];

  const currentStepData = reviewSteps[currentStep];
  const totalSteps = reviewSteps.length;

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === totalSteps - 1) {
      submitReview();
    } else {
      setCurrentStep(currentStep + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Loading state
  if (loading) {
    return <ReviewCreateScreenSkeleton />;
  }

  // Error state
  if (!restaurant || !booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <AlertCircle size={48} color="#ef4444" />
          <H2 className="mt-4 text-center">Booking not found</H2>
          <P className="text-center text-muted-foreground mt-2">
            Unable to load the booking details needed to create a review.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ReviewHeader
        title="Review Your Visit"
        subtitle={restaurant.name}
        currentStep={currentStep}
        totalSteps={totalSteps}
        showProgress
      />

      {/* Restaurant Info Card */}
      <View className="mx-4 mt-4 p-4 bg-card rounded-lg shadow-sm border border-border">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: restaurant.main_image_url }}
            optimizationPreset="thumbnail"
            className="w-16 h-16 rounded-lg"
            contentFit="cover"
          />
          <View className="flex-1">
            <Text className="font-semibold">{restaurant.name}</Text>
            <Text className="text-sm text-muted-foreground">
              Visited on{" "}
              {new Date(booking.booking_time).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Party of {booking.party_size}
            </Text>
          </View>
        </View>
      </View>

      {/* Step Content */}
      <View className="flex-1 px-4 mt-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <H2>{currentStepData.title}</H2>
            <Muted className="text-sm">{currentStepData.subtitle}</Muted>
          </View>
          <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-primary text-sm font-medium">
              {currentStep + 1}/{totalSteps}
            </Text>
          </View>
        </View>

        <View className="flex-1">{currentStepData.component}</View>
      </View>

      {/* Navigation Buttons */}
      <View className="p-4 border-t border-border bg-background">
        <View className="flex-row gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onPress={handlePrevious}
              className="flex-1"
              disabled={submitting}
            >
              <Text>Previous</Text>
            </Button>
          )}

          <Button
            variant="default"
            onPress={handleNext}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text>Submitting...</Text>
              </View>
            ) : currentStep === totalSteps - 1 ? (
              <View className="flex-row items-center justify-center gap-2">
                <CheckCircle size={20} color="white" />
                <Text>Submit Review</Text>
              </View>
            ) : (
              <Text>Next</Text>
            )}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
