// app/(protected)/booking/create.tsx
import React, { useCallback, useEffect } from "react";
import { ScrollView, View, KeyboardAvoidingView, Platform } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { router } from "expo-router";
import { useVerifyPhoneModal } from "@/context/verify-phone-modal-context";

import { SafeAreaView } from "@/components/safe-area-view";
import { LoadingScreen } from "@/components/ui/loading.screen";
import { useBookingCreate } from "@/hooks/useBookingCreate";
import {
  createToggleDietaryRestriction,
  createToggleTablePreference,
  getDefaultFormValues,
} from "@/lib/bookingFormHelpers";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { OffersSelection } from "@/components/offers/OffersSelection";
import { SpecialRequirementsForm } from "@/components/booking/SpecialRequirementsForm";
import { TermsAcceptance } from "@/components/booking/TermsAcceptance";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { BookingCTA } from "@/components/booking/BookingCTA";
import { FriendsInvitationSection } from "@/components/booking/invite-friend";
import BookingCreateScreenSkeleton from "@/components/skeletons/BookingCreateScreenSkeleton";
import { BookingConfirmationModal } from "@/components/booking/BookingConfirmationModal";
import { isPhoneVerificationRequired } from "@/config/features";

import { CardGuaranteeInline } from "@/components/booking/CardGuaranteeSheet";
import {
  DepositPaymentSheet,
  DepositPaymentMethod,
} from "@/components/booking/DepositPaymentSheet";

// Form validation schema
const bookingFormSchema = z.object({
  specialRequests: z.string().max(500, "Maximum 500 characters").optional(),
  occasion: z.string().optional(),
  dietaryRestrictions: z.array(z.string()),
  tablePreferences: z.array(z.string()),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "You must accept the booking terms"),
});

// Types
interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

export default function BookingCreateScreen() {
  // Use the custom hook for all booking logic
  const {
    restaurant,
    loading,
    submitting,
    availableOffers,
    invitedFriends,
    selectedOffer,
    selectedOfferUserId,
    profile,
    bookingDate,
    bookingTime,
    partySize,
    totalPartySize,
    isRequestBooking,
    showConfirmationModal,
    handleConfirmBooking,
    handleCancelBooking,
    submitBooking,
    setSelectedOfferUserId,
    handleInvitesSent,
    turnTime,
    // Card Guarantee
    guaranteeInfo,
    paymentMethods,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    openCheckout,
    // Deposit Payment
    depositInfo,
    showDepositPaymentSheet,
    handleDepositSuccess,
    handleDepositClose,
    currentBookingId,
    initiateDepositPayment,
    depositPaymentLoading,
  } = useBookingCreate();
  const { openVerifyPhoneModal } = useVerifyPhoneModal();

  // When phone is not verified, open verify modal (no redirect to profile)
  useEffect(() => {
    if (!isPhoneVerificationRequired()) return;
    if (!loading && profile && !profile.phone_verified) {
      const t = setTimeout(openVerifyPhoneModal, 300);
      return () => clearTimeout(t);
    }
  }, [loading, profile, openVerifyPhoneModal]);

  // Form setup with default values from helper
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: getDefaultFormValues(profile),
  });

  // Watch form values
  const watchedValues = watch();

  // Create form helper functions
  const toggleDietaryRestriction = useCallback(
    createToggleDietaryRestriction(getValues, setValue),
    [getValues, setValue],
  );

  const toggleTablePreference = useCallback(
    createToggleTablePreference(getValues, setValue),
    [getValues, setValue],
  );

  // Loading state
  if (loading) {
    return <BookingCreateScreenSkeleton />;
  }

  // No restaurant found
  if (!restaurant) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {restaurant && (
          <BookingHeader
            title="Complete Booking"
            subtitle={restaurant.name}
            onBack={() => router.back()}
          />
        )}

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Booking Summary */}
          {restaurant && (
            <BookingSummaryCard
              restaurant={{
                ...restaurant,
                main_image_url: restaurant.main_image_url || "",
              }}
              date={bookingDate}
              time={bookingTime}
              partySize={partySize}
              invitedFriendsCount={invitedFriends.length}
              userProfile={profile || {}}
              appliedOffer={selectedOffer}
              onRemoveOffer={() => setSelectedOfferUserId(null)}
              className="mt-4"
              diningDurationMinutes={turnTime}
              showDiningDuration={restaurant.show_dining_duration}
            />
          )}

          {/* Offers Selection */}
          <OffersSelection
            availableOffers={availableOffers}
            selectedOfferUserId={selectedOfferUserId}
            onSelectOffer={setSelectedOfferUserId}
            partySize={totalPartySize}
          />

          {/* Friends Invitation */}
          {restaurant && (
            <FriendsInvitationSection
              invitedFriends={invitedFriends}
              restaurantName={restaurant.name}
              bookingTime={bookingTime}
              partySize={partySize}
              onInvitesSent={handleInvitesSent}
            />
          )}

          {/* Special Requirements Form */}
          <SpecialRequirementsForm
            control={control}
            watchedValues={watchedValues}
            onToggleDietaryRestriction={toggleDietaryRestriction}
            onToggleTablePreference={toggleTablePreference}
            onSetOccasion={(occasionId) => setValue("occasion", occasionId)}
            errors={errors}
          />

          {/* Terms Acceptance */}
          <TermsAcceptance
            control={control}
            errors={errors}
            invitedFriendsCount={invitedFriends.length}
          />

          {/* Card Guarantee Section */}
          {guaranteeInfo?.required && (
            <CardGuaranteeInline
              guaranteeInfo={guaranteeInfo}
              paymentMethods={paymentMethods}
              selectedPaymentMethodId={selectedPaymentMethodId}
              onSelectPaymentMethod={setSelectedPaymentMethodId}
              onAddNewCard={() => {
                openCheckout({ returnPath: "booking/create" });
              }}
              partySize={totalPartySize}
            />
          )}

          {/* Bottom spacing */}
          <View className="h-6" />
        </ScrollView>

        {/* Booking CTA */}
        <BookingCTA
          onSubmit={handleSubmit(submitBooking)}
          isSubmitting={submitting}
          isDisabled={submitting || !watchedValues.acceptTerms}
          disabledHint={
            !watchedValues.acceptTerms
              ? "Please accept the terms and conditions to continue"
              : undefined
          }
          bookingPolicy={
            restaurant.booking_policy === "request"
              ? "approval"
              : (restaurant.booking_policy as
                  | "instant"
                  | "request"
                  | "approval") || "instant"
          }
          invitedFriendsCount={invitedFriends.length}
          selectedOfferDiscount={
            selectedOffer?.special_offer.discount_percentage
          }
        />

        {/* Booking Confirmation Modal */}
        <BookingConfirmationModal
          visible={showConfirmationModal}
          isRequestBooking={isRequestBooking}
          restaurantName={restaurant?.name || ""}
          restaurantAddress={restaurant?.address}
          restaurantImageUrl={restaurant?.main_image_url || undefined}
          bookingDate={bookingDate}
          bookingTime={bookingTime}
          partySize={totalPartySize}
          selectedOffer={selectedOffer}
          diningDurationMinutes={turnTime}
          showDiningDuration={restaurant?.show_dining_duration}
          onConfirm={handleConfirmBooking}
          onCancel={handleCancelBooking}
          isSubmitting={submitting}
          useSlideToConfirm={true}
        />

        {/* Deposit Payment Sheet */}
        {depositInfo && (
          <DepositPaymentSheet
            visible={showDepositPaymentSheet}
            onClose={handleDepositClose}
            onConfirm={async (method, pricing) => {
              if (currentBookingId) {
                await initiateDepositPayment({
                  bookingId: currentBookingId,
                  provider: method,
                  pricing: pricing,
                  depositSettingId: depositInfo.settingId || undefined,
                  partySize: totalPartySize,
                  source: "app",
                });
                // Success is handled via redirect or callback
              }
            }}
            depositInfo={depositInfo}
            restaurantName={restaurant.name}
            partySize={totalPartySize}
            bookingDate={bookingDate.toDateString()} // Format as needed
            bookingTime={bookingTime}
            loading={depositPaymentLoading}
            isNewBooking={true}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
