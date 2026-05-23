// hooks/useBookingModification.ts
import { useState, useCallback, useMemo, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, addHours } from "date-fns";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useBookingDetails } from "./useBookingDetails";
import { parseFromLebanonTZ } from "@/utils/lebanonTime";
import {
  GuaranteeCheckResult,
  useCardGuarantee,
} from "@/hooks/useCardGuarantee";
import { PaymentMethod, usePaymentMethods } from "@/hooks/usePaymentMethods";
import {
  DepositCheckResult,
  useDepositPayment,
} from "@/hooks/useDepositPayment";
import { useDepositCheckout } from "@/hooks/useDepositCheckout";

// Types
interface BookingChanges {
  date?: boolean;
  time?: boolean;
  partySize?: boolean;
  offerId?: boolean;
  section?: boolean;
  tablePreferences?: boolean;
  specialRequests?: boolean;
  occasion?: boolean;
  dietaryNotes?: boolean;
  invitedFriends?: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface ModifiedBookingData {
  booking_time?: string;
  party_size?: number;
  applied_offer_id?: string | null;
  preferred_section?: string | null;
  table_preferences?: string[];
  special_requests?: string;
  occasion?: string;
  dietary_notes?: string[];
}

export interface UseBookingModificationReturn {
  // Original booking data
  originalBooking: any;
  loading: boolean;

  // Modified state
  modifiedFields: ModifiedBookingData;
  changes: BookingChanges;
  hasChanges: boolean;

  // Validation
  validationErrors: ValidationError[];
  canSave: boolean;
  canModify: boolean;

  // Actions
  updateField: (field: keyof ModifiedBookingData, value: any) => void;
  resetChanges: () => void;
  saveModification: () => Promise<boolean>;
  saveModificationForDeposit: () => Promise<boolean>;

  // Side effects tracking
  willReleaseOffer: boolean;
  needsTableReassignment: boolean;
  newExpiryDate: Date;

  // Submitting state
  submitting: boolean;

  // Card Guarantee
  guaranteeInfo: GuaranteeCheckResult | null;
  requiresNewGuarantee: boolean;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  setSelectedPaymentMethodId: (id: string | null) => void;
  openCheckout: (options?: { returnPath?: string }) => void;
  guaranteeLoading: boolean;

  // Deposit Payment
  depositInfo: DepositCheckResult | null;
  requiresNewDeposit: boolean;
  showDepositPaymentSheet: boolean;
  setShowDepositPaymentSheet: (show: boolean) => void;
  initiateDepositPayment: (params: any) => Promise<boolean>;
  depositPaymentLoading: boolean;

  // Payment requirements check loading state
  checkingPaymentRequirements: boolean;
}

export function useBookingModification(
  bookingId: string,
): UseBookingModificationReturn {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    booking: originalBooking,
    loading,
    guaranteeInfo: existingGuaranteeInfo,
    depositInfo: existingDepositInfo,
  } = useBookingDetails(bookingId);

  const [modifiedFields, setModifiedFields] = useState<ModifiedBookingData>({});
  const [submitting, setSubmitting] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [bookingConflictError, setBookingConflictError] =
    useState<ValidationError | null>(null);

  // --- Card Guarantee State ---
  const [guaranteeInfo, setGuaranteeInfo] =
    useState<GuaranteeCheckResult | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);

  // --- Deposit Payment State ---
  const [depositInfo, setDepositInfo] = useState<DepositCheckResult | null>(
    null,
  );
  const [showDepositPaymentSheet, setShowDepositPaymentSheet] = useState(false);

  // --- Payment Requirements Check Loading ---
  const [checkingPaymentRequirements, setCheckingPaymentRequirements] =
    useState(true);

  // --- Card Guarantee Hooks ---
  const { checkGuaranteeRequired, loading: guaranteeLoading } =
    useCardGuarantee();
  const {
    paymentMethods,
    loading: paymentMethodsLoading,
    fetchPaymentMethods,
    openCheckout,
  } = usePaymentMethods();

  // --- Deposit Hooks ---
  const { checkDepositRequired } = useDepositPayment();
  const {
    initiatePayment: initiateDepositPayment,
    loading: depositPaymentLoading,
  } = useDepositCheckout();

  // Check if user can modify this booking
  const canModify = useMemo(() => {
    if (!originalBooking) return false;
    return originalBooking.status === "pending";
  }, [originalBooking]);

  // Calculate what changed
  const changes = useMemo<BookingChanges>(() => {
    if (!originalBooking) return {};

    const detectedChanges: BookingChanges = {};

    // Check date/time changes
    if (modifiedFields.booking_time) {
      const originalTime = parseFromLebanonTZ(originalBooking.booking_time);
      const modifiedTime = new Date(modifiedFields.booking_time);

      if (originalTime.toISOString() !== modifiedTime.toISOString()) {
        // Check if date changed
        if (
          format(originalTime, "yyyy-MM-dd") !==
          format(modifiedTime, "yyyy-MM-dd")
        ) {
          detectedChanges.date = true;
        }
        // Check if time changed
        if (format(originalTime, "HH:mm") !== format(modifiedTime, "HH:mm")) {
          detectedChanges.time = true;
        }
      }
    }

    // Check party size
    if (
      modifiedFields.party_size !== undefined &&
      modifiedFields.party_size !== originalBooking.party_size
    ) {
      detectedChanges.partySize = true;
    }

    // Check offer
    if (
      modifiedFields.applied_offer_id !== undefined &&
      modifiedFields.applied_offer_id !== originalBooking.applied_offer_id
    ) {
      detectedChanges.offerId = true;
    }

    // Check section
    if (
      modifiedFields.preferred_section !== undefined &&
      modifiedFields.preferred_section !== originalBooking.preferred_section
    ) {
      detectedChanges.section = true;
    }

    // Check table preferences
    if (modifiedFields.table_preferences !== undefined) {
      const originalPrefs = originalBooking.table_preferences || [];
      const modifiedPrefs = modifiedFields.table_preferences || [];
      if (JSON.stringify(originalPrefs) !== JSON.stringify(modifiedPrefs)) {
        detectedChanges.tablePreferences = true;
      }
    }

    // Check special requests
    if (
      modifiedFields.special_requests !== undefined &&
      modifiedFields.special_requests !== originalBooking.special_requests
    ) {
      detectedChanges.specialRequests = true;
    }

    // Check occasion
    if (
      modifiedFields.occasion !== undefined &&
      modifiedFields.occasion !== originalBooking.occasion
    ) {
      detectedChanges.occasion = true;
    }

    // Check dietary notes
    if (modifiedFields.dietary_notes !== undefined) {
      const originalNotes = originalBooking.dietary_notes || [];
      const modifiedNotes = modifiedFields.dietary_notes || [];
      if (JSON.stringify(originalNotes) !== JSON.stringify(modifiedNotes)) {
        detectedChanges.dietaryNotes = true;
      }
    }

    return detectedChanges;
  }, [originalBooking, modifiedFields]);

  const hasChanges = useMemo(() => {
    return Object.keys(changes).length > 0 || invitedFriends.length > 0;
  }, [changes, invitedFriends]);

  // Determine if table reassignment is needed (for Pro tier restaurants)
  const needsTableReassignment = useMemo(() => {
    if (!originalBooking?.restaurant) return false;

    const isPro = (originalBooking.restaurant as any)?.tier === "pro";
    const hasTimeChange = changes.date || changes.time || changes.partySize;

    return !!(isPro && hasTimeChange);
  }, [originalBooking, changes]);

  // Check if offer will be released
  const willReleaseOffer = useMemo(() => {
    return !!(changes.offerId && !!originalBooking?.applied_offer_id);
  }, [changes.offerId, originalBooking]);

  // Calculate new expiry date
  const newExpiryDate = useMemo(() => {
    return addHours(new Date(), 24);
  }, []);

  // Check for card guarantee and deposit requirements when booking parameters change
  useEffect(() => {
    async function checkPaymentRequirements() {
      if (!originalBooking?.restaurant_id) return;

      setCheckingPaymentRequirements(true);

      // Get the effective booking time and party size (use modified values if they exist, otherwise use original)
      const effectiveBookingTime = modifiedFields.booking_time
        ? new Date(modifiedFields.booking_time)
        : parseFromLebanonTZ(originalBooking.booking_time);

      const effectivePartySize =
        modifiedFields.party_size ?? originalBooking.party_size;

      // Determine if there are relevant changes that might affect payment requirements
      const hasRelevantChanges =
        changes.date || changes.time || changes.partySize;

      // Check if the original booking already has payment covered
      const originalHasGuarantee = existingGuaranteeInfo?.hasGuarantee ?? false;
      const originalHasDepositPaid =
        existingDepositInfo?.hasDeposit &&
        existingDepositInfo?.status === "paid";

      // If no relevant changes, check if the original booking already satisfies payment requirements
      if (!hasRelevantChanges) {
        // Original booking already has payment covered - no new payment needed
        if (originalHasDepositPaid || originalHasGuarantee) {
          setGuaranteeInfo(null);
          setDepositInfo(null);
          return;
        }
        // Otherwise, still need to check if the original booking parameters require payment
        // (This handles the case where a booking was created before payment requirements were added)
      }

      try {
        // Check card guarantee requirements for the effective booking parameters
        const guaranteeResult = await checkGuaranteeRequired(
          originalBooking.restaurant_id,
          effectiveBookingTime,
          effectivePartySize,
        );
        setGuaranteeInfo(guaranteeResult);

        // If guarantee is required and booking doesn't already have one, fetch payment methods
        if (guaranteeResult.required && !originalHasGuarantee) {
          await fetchPaymentMethods();
        }

        // Check deposit requirements for the effective booking parameters
        const depositResult = await checkDepositRequired(
          originalBooking.restaurant_id,
          effectiveBookingTime,
          effectivePartySize,
        );
        setDepositInfo(depositResult);
      } catch (error) {
        console.error("Error checking payment requirements:", error);
      } finally {
        setCheckingPaymentRequirements(false);
      }
    }

    checkPaymentRequirements();
  }, [
    originalBooking,
    modifiedFields.booking_time,
    modifiedFields.party_size,
    changes.date,
    changes.time,
    changes.partySize,
    checkGuaranteeRequired,
    checkDepositRequired,
    fetchPaymentMethods,
    existingGuaranteeInfo,
    existingDepositInfo,
  ]);

  // Determine if new guarantee is required (modification triggers guarantee where original didn't have one)
  const requiresNewGuarantee = useMemo(() => {
    if (!guaranteeInfo?.required) return false;
    // If the original booking already has a card guarantee, no new one needed
    if (existingGuaranteeInfo?.hasGuarantee) return false;
    // If the original booking already had deposit paid, no card guarantee needed
    if (
      existingDepositInfo?.hasDeposit &&
      existingDepositInfo?.status === "paid"
    )
      return false;
    return true;
  }, [guaranteeInfo, existingGuaranteeInfo, existingDepositInfo]);

  // Determine if new deposit is required (modification triggers deposit where original didn't have one)
  const requiresNewDeposit = useMemo(() => {
    if (!depositInfo?.required) return false;
    // If the original booking already has deposit paid, no new one needed
    if (
      existingDepositInfo?.hasDeposit &&
      existingDepositInfo?.status === "paid"
    )
      return false;
    // If the original booking has a card guarantee, no deposit needed (card guarantee takes precedence)
    if (existingGuaranteeInfo?.hasGuarantee) return false;
    // If new guarantee is required and selected, deposit is not needed
    if (requiresNewGuarantee && selectedPaymentMethodId) return false;
    return true;
  }, [
    depositInfo,
    existingDepositInfo,
    existingGuaranteeInfo,
    requiresNewGuarantee,
    selectedPaymentMethodId,
  ]);

  // Check for booking conflicts with other bookings (2-hour buffer rule)
  useEffect(() => {
    async function checkBookingConflicts() {
      if (!modifiedFields.booking_time || !profile?.id || !originalBooking) {
        setBookingConflictError(null);
        return;
      }

      try {
        const newBookingTime = new Date(modifiedFields.booking_time);

        // Fetch user's other bookings (excluding the current booking being modified)
        const { data: otherBookings, error } = await supabase
          .from("bookings")
          .select(
            "id, booking_time, restaurant_id, restaurant:restaurants(name)",
          )
          .eq("user_id", profile.id)
          .neq("id", bookingId)
          .in("status", ["pending", "confirmed"])
          .gte("booking_time", new Date().toISOString()); // Only future bookings

        if (error) {
          console.error("Error fetching other bookings:", error);
          setBookingConflictError(null);
          return;
        }

        if (!otherBookings || otherBookings.length === 0) {
          setBookingConflictError(null);
          return;
        }

        // Fixed 2-hour buffer before and after each booking (120 minutes)
        const BUFFER_MINUTES = 120;

        // Check each existing booking for conflicts
        for (const existingBooking of otherBookings) {
          const existingBookingTime = parseFromLebanonTZ(
            existingBooking.booking_time,
          );

          // Calculate the time window: 2 hours before to 2 hours after the existing booking
          const existingBookingStartWindow = new Date(existingBookingTime);
          existingBookingStartWindow.setMinutes(
            existingBookingStartWindow.getMinutes() - BUFFER_MINUTES,
          );
          const existingBookingEndWindow = new Date(existingBookingTime);
          existingBookingEndWindow.setMinutes(
            existingBookingEndWindow.getMinutes() + BUFFER_MINUTES,
          );

          // Check if new booking time falls within the 2-hour buffer window (before or after) of existing booking
          if (
            newBookingTime >= existingBookingStartWindow &&
            newBookingTime <= existingBookingEndWindow
          ) {
            const restaurantName =
              (existingBooking as any).restaurant?.name || "another restaurant";
            setBookingConflictError({
              field: "booking_time",
              message: `This booking time conflicts with your existing booking at ${restaurantName}. You must leave at least 2 hours before and 2 hours after each booking.`,
              severity: "error",
            });
            return;
          }
        }

        // No conflicts found
        setBookingConflictError(null);
      } catch (error) {
        console.error("Error checking booking conflicts:", error);
        setBookingConflictError(null);
      }
    }

    checkBookingConflicts();
  }, [modifiedFields.booking_time, profile?.id, bookingId, originalBooking]);

  // Validation
  const validationErrors = useMemo<ValidationError[]>(() => {
    const errors: ValidationError[] = [];

    // Validate booking time is in the future
    if (modifiedFields.booking_time) {
      const bookingTime = new Date(modifiedFields.booking_time);
      const now = new Date();

      if (bookingTime <= now) {
        errors.push({
          field: "booking_time",
          message: "Booking time must be in the future",
          severity: "error",
        });
      }
    }

    // Validate party size
    if (modifiedFields.party_size !== undefined) {
      if (modifiedFields.party_size < 1) {
        errors.push({
          field: "party_size",
          message: "Party size must be at least 1",
          severity: "error",
        });
      }

      const maxSize = originalBooking?.restaurant?.max_party_size || 20;
      if (modifiedFields.party_size > maxSize) {
        errors.push({
          field: "party_size",
          message: `Party size cannot exceed ${maxSize}`,
          severity: "error",
        });
      }
    }

    // Add booking conflict error if present
    if (bookingConflictError) {
      errors.push(bookingConflictError);
    }

    // Add payment requirement errors
    if (requiresNewGuarantee && !selectedPaymentMethodId) {
      errors.push({
        field: "payment",
        message:
          "This booking now requires a card guarantee. Please select a payment method.",
        severity: "error",
      });
    }

    if (requiresNewDeposit) {
      errors.push({
        field: "payment",
        message: "This booking now requires a deposit payment.",
        severity: "error",
      });
    }

    return errors;
  }, [
    modifiedFields,
    originalBooking,
    bookingConflictError,
    requiresNewGuarantee,
    requiresNewDeposit,
    selectedPaymentMethodId,
  ]);

  const canSave = useMemo(() => {
    // Block saving if deposit is required (user needs to pay via sheet)
    if (requiresNewDeposit) return false;

    return (
      hasChanges && validationErrors.length === 0 && canModify && !submitting
    );
  }, [hasChanges, validationErrors, canModify, submitting, requiresNewDeposit]);

  // Update a single field
  const updateField = useCallback(
    (field: keyof ModifiedBookingData, value: any) => {
      setModifiedFields((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  // Reset all changes
  const resetChanges = useCallback(() => {
    setModifiedFields({});
    setInvitedFriends([]);
  }, []);

  // Save modification
  const saveModification = useCallback(async (): Promise<boolean> => {
    if (!canSave || !originalBooking) {
      return false;
    }

    setSubmitting(true);

    try {
      // 1. Handle offer replacement if needed
      if (willReleaseOffer) {
        // Release old offer
        await supabase
          .from("user_offers")
          .update({
            status: "active",
            used_at: null,
            booking_id: null,
          })
          .eq("offer_id", originalBooking.applied_offer_id)
          .eq("user_id", profile?.id);
      }

      // 2. Apply new offer if selected
      if (changes.offerId && modifiedFields.applied_offer_id) {
        const now = new Date();
        const thirtyDaysFromNow = addHours(now, 30 * 24);

        await supabase.from("user_offers").insert({
          user_id: profile?.id,
          offer_id: modifiedFields.applied_offer_id,
          booking_id: bookingId,
          claimed_at: now.toISOString(),
          used_at: now.toISOString(),
          expires_at: thirtyDaysFromNow.toISOString(),
          status: "used",
        });
      }

      // 3. Clear table assignments if needed (Pro tier with time/date/size change)
      if (needsTableReassignment) {
        await supabase
          .from("booking_tables")
          .delete()
          .eq("booking_id", bookingId);
      }

      // 4. Update booking record
      const updateData: any = {
        ...modifiedFields,
        request_expires_at: newExpiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Handle card guarantee - create booking_guarantees record if new guarantee is required
      if (requiresNewGuarantee && selectedPaymentMethodId && guaranteeInfo) {
        // Delete any existing guarantee record first (in case of re-edit)
        await supabase
          .from("booking_guarantees")
          .delete()
          .eq("booking_id", bookingId);

        // Create new booking_guarantees record
        const { error: guaranteeError } = await supabase
          .from("booking_guarantees")
          .insert({
            booking_id: bookingId,
            payment_method_id: selectedPaymentMethodId,
            guarantee_setting_id: guaranteeInfo.settingId,
            no_show_fee: guaranteeInfo.noShowFee,
            cancellation_fee: guaranteeInfo.lateCancelFee,
            fee_type: guaranteeInfo.feeType || "per_cover",
            party_size: modifiedFields.party_size || originalBooking.party_size,
            status: "held",
          });

        if (guaranteeError) {
          console.error("Error creating booking guarantee:", guaranteeError);
          throw guaranteeError;
        }
      } else if (!requiresNewGuarantee) {
        // Delete any existing booking_guarantees record if no longer required
        await supabase
          .from("booking_guarantees")
          .delete()
          .eq("booking_id", bookingId);
      }

      // Clear deposit status if this modification doesn't require a deposit
      // This handles the case where user previously initiated deposit flow but cancelled
      if (!requiresNewDeposit) {
        updateData.deposit_status = "not_required";
        updateData.payment_expires_at = null;

        // Delete any pending deposit record
        await supabase
          .from("booking_deposits")
          .delete()
          .eq("booking_id", bookingId)
          .eq("status", "pending");
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId)
        .eq("status", "pending"); // Safety check

      if (updateError) throw updateError;

      // 5. Handle friend invitations
      // Delete existing invitations
      await supabase
        .from("booking_invites")
        .delete()
        .eq("booking_id", bookingId)
        .eq("from_user_id", profile?.id);

      // Add new invitations
      if (invitedFriends.length > 0) {
        const invites = invitedFriends.map((friendId) => ({
          booking_id: bookingId,
          from_user_id: profile?.id,
          to_user_id: friendId,
          status: "pending",
          message: `Join me at ${(originalBooking as any).restaurant?.name}!`,
        }));

        await supabase.from("booking_invites").insert(invites);
      }

      // Success!
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "Booking Updated",
        "Your booking request has been successfully updated. The restaurant will have 24 hours to respond.",
        [
          {
            text: "OK",
            onPress: () => router.replace(`/booking/${bookingId}`),
          },
        ],
      );

      return true;
    } catch (error) {
      console.error("Error saving booking modification:", error);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert(
        "Update Failed",
        "Failed to update your booking. Please try again.",
        [{ text: "OK" }],
      );

      return false;
    } finally {
      setSubmitting(false);
    }
  }, [
    canSave,
    originalBooking,
    bookingId,
    profile,
    willReleaseOffer,
    changes,
    modifiedFields,
    needsTableReassignment,
    newExpiryDate,
    invitedFriends,
    router,
    requiresNewGuarantee,
    selectedPaymentMethodId,
    guaranteeInfo,
    requiresNewDeposit,
  ]);

  // Save modification and prepare for deposit payment
  // This saves the changes but marks the booking as pending deposit payment
  const saveModificationForDeposit = useCallback(async (): Promise<boolean> => {
    if (
      !originalBooking ||
      !hasChanges ||
      !requiresNewDeposit ||
      !depositInfo
    ) {
      return false;
    }

    // Check for validation errors (except deposit-related ones)
    const nonDepositErrors = validationErrors.filter(
      (e) => e.field !== "payment" || !e.message.includes("deposit"),
    );
    if (nonDepositErrors.length > 0) {
      return false;
    }

    setSubmitting(true);

    try {
      // 1. Handle offer replacement if needed
      if (willReleaseOffer) {
        await supabase
          .from("user_offers")
          .update({
            status: "active",
            used_at: null,
            booking_id: null,
          })
          .eq("offer_id", originalBooking.applied_offer_id)
          .eq("user_id", profile?.id);
      }

      // 2. Apply new offer if selected
      if (changes.offerId && modifiedFields.applied_offer_id) {
        const now = new Date();
        const thirtyDaysFromNow = addHours(now, 30 * 24);

        await supabase.from("user_offers").insert({
          user_id: profile?.id,
          offer_id: modifiedFields.applied_offer_id,
          booking_id: bookingId,
          claimed_at: now.toISOString(),
          used_at: now.toISOString(),
          expires_at: thirtyDaysFromNow.toISOString(),
          status: "used",
        });
      }

      // 3. Clear table assignments if needed
      if (needsTableReassignment) {
        await supabase
          .from("booking_tables")
          .delete()
          .eq("booking_id", bookingId);
      }

      // 4. Update booking record with deposit pending status
      const paymentExpiresAt = addHours(new Date(), 1); // 1 hour to complete payment

      // Get party size for deposit calculation
      const effectivePartySize =
        modifiedFields.party_size ?? originalBooking.party_size;

      // Calculate deposit amounts
      const depositAmount =
        depositInfo.feeType === "per_cover"
          ? depositInfo.depositAmount * effectivePartySize
          : depositInfo.depositAmount;
      const serviceFee = depositInfo.serviceFee || 0;
      const totalAmount = depositAmount + serviceFee;

      const updateData: any = {
        ...modifiedFields,
        request_expires_at: newExpiryDate.toISOString(),
        updated_at: new Date().toISOString(),
        // Only update deposit_status (the only deposit-related column in bookings table)
        deposit_status: "pending",
        payment_expires_at: paymentExpiresAt.toISOString(),
      };

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId)
        .eq("status", "pending");

      if (updateError) throw updateError;

      // 5. Create or update booking_deposits record
      const { error: depositError } = await supabase
        .from("booking_deposits")
        .upsert(
          {
            booking_id: bookingId,
            deposit_setting_id: depositInfo.settingId,
            amount: depositAmount,
            service_fee: serviceFee,
            total_amount: totalAmount,
            currency: depositInfo.currency || "USD",
            status: "pending",
            party_size: effectivePartySize,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "booking_id",
          },
        );

      if (depositError) {
        console.error("Error creating deposit record:", depositError);
        // Don't fail the whole operation if deposit record fails
        // The deposit info is still on the booking
      }

      return true;
    } catch (error) {
      console.error("Error saving booking modification for deposit:", error);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert(
        "Update Failed",
        "Failed to update your booking. Please try again.",
        [{ text: "OK" }],
      );

      return false;
    } finally {
      setSubmitting(false);
    }
  }, [
    originalBooking,
    hasChanges,
    requiresNewDeposit,
    depositInfo,
    validationErrors,
    willReleaseOffer,
    changes,
    modifiedFields,
    needsTableReassignment,
    newExpiryDate,
    bookingId,
    profile?.id,
  ]);

  return {
    originalBooking,
    loading,
    modifiedFields,
    changes,
    hasChanges,
    validationErrors,
    canSave,
    canModify,
    updateField,
    resetChanges,
    saveModification,
    saveModificationForDeposit,
    willReleaseOffer,
    needsTableReassignment,
    newExpiryDate,
    submitting,
    // Card Guarantee
    guaranteeInfo,
    requiresNewGuarantee,
    paymentMethods,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    openCheckout,
    guaranteeLoading,
    // Deposit Payment
    depositInfo,
    requiresNewDeposit,
    showDepositPaymentSheet,
    setShowDepositPaymentSheet,
    initiateDepositPayment,
    depositPaymentLoading,
    // Payment requirements check loading
    checkingPaymentRequirements,
  };
}
