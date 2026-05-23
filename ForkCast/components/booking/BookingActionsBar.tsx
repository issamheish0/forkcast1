import React, { useState } from "react";
import {
  View,
  Alert,
  Linking,
  Platform,
  Share,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Phone,
  MessageCircle,
  Navigation,
  Share2,
  Copy,
  Edit3,
  XCircle,
  Star,
  Calendar,
  Tag,
  MapPin,
  RefreshCw,
  CreditCard,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { formatTimeFromDate } from "@/utils/timeFormat";

// Guarantee info type for penalty display
interface GuaranteeInfo {
  hasGuarantee: boolean;
  guaranteeId: string | null;
  lateCancelFee: number;
  noShowFee: number;
  feeType: "per_cover" | "fixed";
  currency: string;
  totalLateCancelFee: number;
  totalNoShowFee: number;
}

interface BookingActionsBarProps {
  booking: {
    id: string;
    status: string;
    confirmation_code: string;
    booking_time: string;
    party_size: number;
    restaurant: {
      id: string;
      name: string;
      phone_number?: string | null;
      whatsapp_number?: string | null;
      location: any;
      staticCoordinates?: { lat: number; lng: number };
      coordinates?: { latitude: number; longitude: number };
    };
  };
  appliedOfferDetails?: {
    discount_percentage: number;
    redemption_code: string;
  } | null;
  hasReview?: boolean;
  isUpcoming?: boolean;
  processing?: boolean;
  isWithinCancellationWindow?: boolean;
  cancellationWindowHours?: number;
  guaranteeInfo?: GuaranteeInfo | null;
  // Pending payment props
  isPendingPayment?: boolean;
  isPaymentExpired?: boolean;
  paymentLoading?: boolean;
  onCompletePayment?: () => void;
  // Deposit pending payment props
  isDepositPending?: boolean;
  depositPaymentLoading?: boolean;
  onPayDeposit?: () => void;
  onCancel?: () => void;
  onReview?: () => void;
  onBookAgain?: () => void;
  onNavigateToOffers?: () => void;
  onEdit?: () => void;
}

export const BookingActionsBar: React.FC<BookingActionsBarProps> = ({
  booking,
  appliedOfferDetails,
  hasReview,
  isUpcoming,
  processing,
  isWithinCancellationWindow = false,
  cancellationWindowHours = 0,
  guaranteeInfo,
  isPendingPayment = false,
  isPaymentExpired = false,
  paymentLoading = false,
  onCompletePayment,
  isDepositPending = false,
  depositPaymentLoading = false,
  onPayDeposit,
  onCancel,
  onReview,
  onBookAgain,
  onNavigateToOffers,
  onEdit,
}:any) => {
  const [showContactModal, setShowContactModal] = useState(false);
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // For late cancellation within window - if there's no guarantee, still allow contact option
  const handleContactRestaurant = () => {
    const windowText =
      cancellationWindowHours === 1
        ? "1 hour"
        : `${cancellationWindowHours} hours`;

    Alert.alert(
      "Within Cancellation Window",
      `You're within the ${windowText} cancellation window. You can still cancel, but would you like to contact the restaurant first?`,
      [
        {
          text: "Call Restaurant",
          onPress: callRestaurant,
          style: "default",
        },
        {
          text: "Message on WhatsApp",
          onPress: messageRestaurant,
          style: "default",
        },
        {
          text: "Cancel Booking",
          onPress: onCancel,
          style: "destructive",
        },
        {
          text: "Keep Booking",
          style: "cancel",
        },
      ],
    );
  };

  const callRestaurant = async () => {
    if (!booking.restaurant.phone_number) return;

    const url = `tel:${booking.restaurant.phone_number}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  };

  const messageRestaurant = async () => {
    if (!booking.restaurant.whatsapp_number) return;

    const offerText = appliedOfferDetails
      ? ` I have a ${appliedOfferDetails.discount_percentage}% discount offer applied (Code: ${appliedOfferDetails.redemption_code.slice(-6).toUpperCase()}).`
      : "";

    const message = encodeURIComponent(
      `Hi! I have a booking at ${booking.restaurant.name} on ${formatDateToDDMMYYYY(
        new Date(booking.booking_time),
      )} at ${formatTimeFromDate(new Date(booking.booking_time))} for ${
        booking.party_size
      } people. Confirmation code: ${booking.confirmation_code}${offerText}`,
    );

    // Clean phone number: remove all non-numeric characters
    const cleanedNumber = booking.restaurant.whatsapp_number.replace(
      /[^\d]/g,
      "",
    );

    // Use https://wa.me/ format which works on both platforms
    const waUrl = `https://wa.me/${cleanedNumber}?text=${message}`;
    const whatsappUrl = `whatsapp://send?phone=${cleanedNumber}&text=${message}`;

    try {
      const canOpenWa = await Linking.canOpenURL(waUrl);
      if (canOpenWa) {
        await Linking.openURL(waUrl);
        return;
      }

      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
        return;
      }

      Alert.alert("Error", "WhatsApp is not installed");
    } catch (error) {
      console.error("Error opening WhatsApp:", error);
      Alert.alert(
        "Error",
        "Unable to open WhatsApp. Please check if it's installed.",
      );
    }
  };

  const shareBooking = async () => {
    const offerText = appliedOfferDetails
      ? ` Plus I saved ${appliedOfferDetails.discount_percentage}% with a special offer!`
      : "";

    const shareMessage = `I have a reservation at ${booking.restaurant.name} on ${formatDateToDDMMYYYY(
      new Date(booking.booking_time),
    )} at ${formatTimeFromDate(new Date(booking.booking_time))} for ${
      booking.party_size
    } people.${offerText} Confirmation code: ${booking.confirmation_code}`;

    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${booking.restaurant.name}`,
      });
    } catch (error) {
      console.error("Error sharing booking:", error);
    }
  };

  const copyConfirmationCode = async () => {
    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `Confirmation code ${booking.confirmation_code} copied to clipboard`,
    );
  };

  // Fixed: This function now returns JSX, not a string
  const renderBottomMessage = () => {
    if (!appliedOfferDetails) {
      return null;
    }

    let message = "";

    if (appliedOfferDetails) {
      message = `💰 You saved ${appliedOfferDetails.discount_percentage}% with your special offer`;
    }

    if (!message) {
      return null;
    }

    return (
      <Text className="text-center text-xs text-muted-foreground mt-3">
        {message}
      </Text>
    );
  };

  const isPending = booking.status === "pending";
  const isConfirmed = booking.status === "confirmed";
  const isCompleted = booking.status === "completed";
  const isCancelled = booking.status === "cancelled_by_user";
  const isDeclined =
    booking.status === "declined_by_restaurant" ||
    booking.status === "auto_declined";
  // For deposit bookings in pending_payment status (not event bookings)
  const isDepositPendingPayment =
    booking.status === "pending_payment" && !isPendingPayment;

  return (
    <View
      className="px-6 pt-6 border-t border-border bg-white dark:bg-black"
      style={{ paddingBottom: Math.max(insets.bottom, 24) }}
    >
      {/* Pending Payment Actions */}
      {isPendingPayment && !isPaymentExpired ? (
        <View className="mb-3">
          <Button
            variant="default"
            onPress={onCompletePayment}
            disabled={paymentLoading}
            className="w-full bg-purple-600 dark:bg-purple-700 h-12 rounded-lg mb-3"
          >
            <View className="flex-row items-center justify-center gap-2">
              <CreditCard size={18} color="white" />
              <Text className="text-white font-semibold">
                {paymentLoading ? "Processing..." : "Complete Payment"}
              </Text>
            </View>
          </Button>

          {/* Cancel pending payment booking */}
          <Button
            variant="ghost"
            size="lg"
            onPress={onCancel}
            disabled={processing}
            className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
          >
            <View className="flex-row items-center justify-center gap-2">
              <XCircle size={16} color="#ef4444" />
              <Text className="text-red-600 dark:text-red-400 text-base">
                Cancel Booking
              </Text>
            </View>
          </Button>
        </View>
      ) : isPendingPayment && isPaymentExpired ? (
        <View className="mb-3">
          <Button
            variant="default"
            onPress={onBookAgain}
            className="w-full bg-primary h-12 rounded-lg"
          >
            <View className="flex-row items-center justify-center gap-2">
              <RefreshCw
                size={16}
                color={colors[colorScheme].primaryForeground}
              />
              <Text className="text-primary-foreground font-medium">
                Create New Booking
              </Text>
            </View>
          </Button>
        </View>
      ) : null}

      {/* Deposit Pending Payment Actions */}
      {(isDepositPendingPayment || isDepositPending) && onPayDeposit ? (
        <View className="mb-3">
          <Button
            variant="default"
            onPress={onPayDeposit}
            disabled={depositPaymentLoading}
            className="w-full bg-purple-600 dark:bg-purple-700 h-12 rounded-lg mb-3"
          >
            <View className="flex-row items-center justify-center gap-2">
              <CreditCard size={18} color="white" />
              <Text className="text-white font-semibold">
                {depositPaymentLoading ? "Processing..." : "Pay Deposit"}
              </Text>
            </View>
          </Button>

          {/* Cancel deposit booking */}
          <Button
            variant="ghost"
            size="lg"
            onPress={onCancel}
            disabled={processing}
            className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
          >
            <View className="flex-row items-center justify-center gap-2">
              <XCircle size={16} color="#ef4444" />
              <Text className="text-red-600 dark:text-red-400 text-base">
                Cancel Booking
              </Text>
            </View>
          </Button>
        </View>
      ) : null}

      {/* Primary Actions for Upcoming Bookings */}
      {isUpcoming &&
      (isPending || isConfirmed) &&
      !isDepositPendingPayment &&
      !isDepositPending ? (
        <View className="mb-3">
          {/* Call button - full width */}
          {booking.restaurant.phone_number ? (
            <Button
              variant="default"
              onPress={callRestaurant}
              className="w-full bg-primary h-12 rounded-lg mb-3"
            >
              <View className="flex-row items-center justify-center gap-2">
                <Phone
                  size={16}
                  color={colors[colorScheme].primaryForeground}
                />
                <Text className="text-primary-foreground font-medium">
                  Call
                </Text>
              </View>
            </Button>
          ) : null}

          {/* Cancel and Modify buttons side by side */}
          <View className="flex-row gap-3">
            {/* Cancel button - allows cancellation with penalty */}
            <Button
              variant="ghost"
              size="lg"
              onPress={onCancel}
              disabled={processing}
              className="flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
            >
              <View className="flex-row items-center justify-center gap-2">
                <XCircle size={16} color="#ef4444" />
                <Text className="text-red-600 dark:text-red-400 text-base">
                  Cancel
                </Text>
              </View>
            </Button>

            {(isPending || isConfirmed) && onEdit ? (
              <Button
                variant="outline"
                size="lg"
                onPress={() => {
                  if (isConfirmed) {
                    setShowContactModal(true);
                  } else {
                    onEdit();
                  }
                }}
                className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <Edit3 size={16} color="#3b82f6" />
                  <Text className="text-blue-600 dark:text-blue-400 font-medium text-base">
                    Modify
                  </Text>
                </View>
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Review Button for Completed Bookings */}
      {isCompleted && !hasReview ? (
        <Button
          variant="default"
          onPress={onReview}
          className="w-full mb-3 rounded-lg"
        >
          <View className="flex-row items-center justify-center gap-2">
            <Star size={16} color={colors[colorScheme].primaryForeground} />
            <Text className="text-primary-foreground">
              Rate Your Experience
            </Text>
          </View>
        </Button>
      ) : null}

      {/* Try Different Time for Declined Bookings */}
      {isDeclined ? (
        <Button
          variant="default"
          onPress={onBookAgain}
          className="w-full mb-3 bg-primary rounded-lg"
        >
          <View className="flex-row items-center justify-center gap-2">
            <RefreshCw
              size={16}
              color={colors[colorScheme].primaryForeground}
            />
            <Text className="text-primary-foreground font-medium">
              Try Different Time
            </Text>
          </View>
        </Button>
      ) : null}

      {/* Quick Actions Row */}
      <View className="flex-row gap-3">
        {/* Book Again for Completed/Cancelled */}
        {isCompleted || isCancelled ? (
          <Button
            variant="default"
            onPress={onBookAgain}
            className="flex-1 bg-primary rounded-lg"
            style={{ minHeight: 48, paddingVertical: 12 }}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Calendar
                size={16}
                color={colors[colorScheme].primaryForeground}
              />
              <Text
                className="text-primary-foreground font-medium"
                numberOfLines={1}
              >
                Book Again
              </Text>
            </View>
          </Button>
        ) : null}

        {/* Offers Button */}
        {appliedOfferDetails ? (
          <Button
            variant="outline"
            onPress={onNavigateToOffers}
            className="flex-none px-4 rounded-lg"
          >
            <Tag size={16} color="#16a34a" />
          </Button>
        ) : null}
      </View>

      {/* Fixed: Now properly renders JSX instead of string */}
      {renderBottomMessage()}

      {/* Contact Restaurant Modal */}
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowContactModal(false)}
        >
          <Pressable
            className="bg-card rounded-t-3xl border-t border-border"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </View>

            <View className="px-6 pt-4 pb-8">
              {/* Header */}
              <View className="mb-5">
                <Text className="text-xl font-bold mb-1">
                  Contact Restaurant
                </Text>
                <Text className="text-sm text-muted-foreground">
                  This booking is confirmed. Contact {booking.restaurant.name} directly to request any changes.
                </Text>
              </View>

              <View className="gap-3">
                {/* WhatsApp Button */}
                {booking.restaurant.whatsapp_number ? (
                  <Button
                    onPress={() => {
                      setShowContactModal(false);
                      messageRestaurant();
                    }}
                    className="w-full h-12 rounded-xl bg-[#25D366]"
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <MessageCircle size={18} color="white" />
                      <Text className="text-white font-semibold text-base">WhatsApp</Text>
                    </View>
                  </Button>
                ) : null}

                {/* Call Button */}
                {booking.restaurant.phone_number ? (
                  <Button
                    onPress={() => {
                      setShowContactModal(false);
                      callRestaurant();
                    }}
                    className="w-full h-12 rounded-xl"
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <Phone size={18} color={colors[colorScheme].primaryForeground} />
                      <Text className="text-primary-foreground font-semibold text-base">Call Restaurant</Text>
                    </View>
                  </Button>
                ) : null}

                {/* Dismiss */}
                <Button
                  variant="outline"
                  onPress={() => setShowContactModal(false)}
                  className="w-full h-12 rounded-xl"
                >
                  <Text className="font-semibold text-base">Not Now</Text>
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
