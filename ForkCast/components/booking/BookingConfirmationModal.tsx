// components/booking/BookingConfirmationModal.tsx
import React from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import {
  Calendar,
  Clock,
  Users,
  Tag,
  LayoutGrid,
  Hourglass,
  X,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { TurnTimeService } from "@/lib/TurnTimeService";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";

interface BookingConfirmationModalProps {
  visible: boolean;
  isRequestBooking: boolean;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantImageUrl?: string;
  bookingDate: Date;
  bookingTime: string;
  partySize: number;
  sectionLabel?: string;
  selectedOffer?: {
    special_offer: { title: string; discount_percentage: number };
  } | null;
  appliedPromo?: {
    code: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
  } | null;
  /** Dining duration in minutes - shown as a note to set expectations */
  diningDurationMinutes?: number;
  /** Whether to show the dining duration notice (controlled by restaurant setting) */
  showDiningDuration?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  useSlideToConfirm?: boolean;
}

function InfoRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <View
      className={`flex-row items-start justify-between py-3 ${
        highlight ? "-mx-4 px-4 rounded-xl bg-red-100 dark:bg-rose-900/40" : ""
      }`}
    >
      <View className="flex-row items-center">
        <View className="mr-3 p-1 rounded-full light:bg-white dark:bg-primary">
          {icon}
        </View>
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-foreground max-w-[60%] text-right">
        {String(value)}
      </Text>
    </View>
  );
}

export function BookingConfirmationModal({
  visible,
  isRequestBooking,
  restaurantName,
  restaurantAddress,
  restaurantImageUrl,
  bookingDate,
  bookingTime,
  partySize,
  sectionLabel,
  selectedOffer,
  appliedPromo,
  diningDurationMinutes,
  showDiningDuration,
  onConfirm,
  onCancel,
  isSubmitting = false,
  useSlideToConfirm = false,
}: BookingConfirmationModalProps): React.ReactElement {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const isSectionMissing =
    !sectionLabel ||
    ["no section chosen", "any section"].includes(
      sectionLabel.trim().toLowerCase(),
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onCancel}>
        {/* Bottom Sheet Content */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-card rounded-t-3xl border-t border-x border-border"
          style={{ maxHeight: screenHeight * 0.75 }}
        >
          {/* Drag Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pb-4">
            <Text className="text-lg font-semibold text-foreground">
              Confirm Booking
            </Text>
            <Pressable
              onPress={onCancel}
              className="w-8 h-8 items-center justify-center rounded-full bg-muted"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color={isDark ? "#FFF" : "#000"} />
            </Pressable>
          </View>

          <ScrollView
            className="px-6"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Restaurant card */}
            <View className="mb-5 rounded-2xl border border-border bg-muted/40 p-4">
              <View className="flex-row items-start">
                {restaurantImageUrl && (
                  <Image
                    source={{ uri: restaurantImageUrl }}
                    optimizationPreset="medium"
                    className="w-16 h-16 rounded-lg mr-4"
                    contentFit="cover"
                  />
                )}
                <View className="flex-1">
                  <View className="flex-row items-start">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {restaurantName}
                      </Text>
                      {!!restaurantAddress && (
                        <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                          {restaurantAddress}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              Booking summary
            </Text>
            {/* Summary rows */}
            <View className="rounded-2xl border border-border bg-background px-4">
              <InfoRow
                icon={<Calendar size={18} className="text-foreground" />}
                label="Date"
                value={formatDateToDDMMYYYY(bookingDate)}
              />
              <View className="h-[1px] bg-border" />
              <InfoRow
                icon={<Clock size={18} className="text-foreground" />}
                label="Time"
                value={bookingTime}
              />
              <View className="h-[1px] bg-border" />
              <InfoRow
                icon={<Users size={18} className="text-foreground" />}
                label="Party Size"
                value={`${partySize} ${partySize === 1 ? "Guest" : "Guests"}`}
              />
              {typeof sectionLabel !== "undefined" ? (
                <>
                  <View className="h-[1px] bg-muted" />
                  <InfoRow
                    icon={<LayoutGrid size={18} className="text-foreground" />}
                    label="Section"
                    value={
                      sectionLabel.trim().length > 0
                        ? sectionLabel
                        : "Any Section"
                    }
                    highlight={isSectionMissing}
                  />
                </>
              ) : (
                <View className="h-[1px] bg-border" />
              )}
              {selectedOffer && (
                <>
                  <View className="h-[1px] bg-border" />
                  <InfoRow
                    icon={<Tag size={18} className="text-primary" />}
                    label="Offer"
                    value={`${selectedOffer.special_offer.title} · ${selectedOffer.special_offer.discount_percentage}% off`}
                  />
                </>
              )}
              {appliedPromo && (
                <>
                  <View className="h-[1px] bg-border" />
                  <InfoRow
                    icon={<Tag size={18} className="text-violet-500" />}
                    label="Promo Code"
                    value={
                      appliedPromo.discount_type === "percentage"
                        ? `${appliedPromo.code} · ${appliedPromo.discount_value}% off`
                        : `${appliedPromo.code} · $${appliedPromo.discount_value} off`
                    }
                  />
                </>
              )}
            </View>

            {/* Dining Duration Notice */}
            {showDiningDuration &&
              diningDurationMinutes &&
              diningDurationMinutes > 0 && (
                <View className="mt-3 flex-row items-center gap-1.5 px-1">
                  <Hourglass
                    size={14}
                    className="text-amber-600 dark:text-amber-400"
                  />
                  <Text className="text-[11px] text-amber-700 dark:text-amber-400">
                    Dining time limit:{" "}
                    {TurnTimeService.getTurnTimeSummary(diningDurationMinutes)}
                  </Text>
                </View>
              )}

            {/* Request notice */}
            {isRequestBooking && (
              <View className="mt-5 mb-4 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
                <Text className="text-center text-[12px] leading-5 text-blue-700 dark:text-blue-300">
                  The restaurant will receive your booking and we will notify
                  you once it&apos;s confirmed. If the restaurant is currently
                  closed, they&apos;ll respond as soon as they reopen.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <SafeAreaView
            edges={["bottom"]}
            className="border-t border-border px-6 pt-4 pb-4 bg-card"
          >
            <View className="gap-3">
              {useSlideToConfirm ? (
                <>
                  <SlideToConfirm
                    onConfirm={onConfirm}
                    disabled={isSubmitting}
                    confirmText={
                      isRequestBooking ? "Send Request" : "Confirm Booking"
                    }
                    slideText={
                      isRequestBooking
                        ? "Slide to book"
                        : "Slide to confirm booking"
                    }
                    width={screenWidth - 48} // Account for padding
                    height={60}
                  />
                  <Pressable onPress={onCancel} className="py-2 items-center">
                    <Text className="text-muted-foreground">Cancel</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Button
                    onPress={onConfirm}
                    disabled={isSubmitting}
                    className="h-14 rounded-2xl"
                  >
                    <Text className="text-base font-bold text-primary-foreground">
                      {isSubmitting
                        ? isRequestBooking
                          ? "Sending Request..."
                          : "Confirming..."
                        : isRequestBooking
                          ? "Confirm"
                          : "Confirm Booking"}
                    </Text>
                  </Button>
                  <Pressable onPress={onCancel} className="py-2 items-center">
                    <Text className="text-muted-foreground">Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
