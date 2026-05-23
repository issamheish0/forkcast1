// components/booking/PostBookingReviewModal.tsx
import React from "react";
import {
  View,
  Modal,
  Pressable,
  Dimensions,
  ScrollView,
  useColorScheme,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Calendar,
  Clock,
  Users,
  Star,
  X,
  MessageSquare,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { Database } from "@/types/supabase";
import { formatTimeFromDate } from "@/utils/timeFormat";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface BookingWithRestaurant extends Booking {
  restaurant: Restaurant;
}

interface PostBookingReviewModalProps {
  visible: boolean;
  booking: BookingWithRestaurant | null;
  onWriteReview: () => void;
  onSkip: () => void;
}

function InfoRow({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string | number;
}): React.ReactElement {
  return (
    <View className="flex-row items-center py-2">
      <View className="mr-3 p-1.5 rounded-full bg-muted">{icon}</View>
      <Text className="text-sm text-foreground">{String(value)}</Text>
    </View>
  );
}

export function PostBookingReviewModal({
  visible,
  booking,
  onWriteReview,
  onSkip,
}: PostBookingReviewModalProps): React.ReactElement {
  const colorScheme = useColorScheme();
  const slideAnim = useSharedValue(SCREEN_HEIGHT);
  const opacityAnim = useSharedValue(0);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  React.useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, {
        stiffness: 220,
        damping: 22,
        mass: 0.9,
      });
      opacityAnim.value = withTiming(1, { duration: 180 });
    } else {
      slideAnim.value = SCREEN_HEIGHT;
      opacityAnim.value = 0;
    }
  }, [visible]);

  if (!visible || !booking) return <></>;

  const bookingDate = new Date(booking.booking_time);
  const timeString = formatTimeFromDate(bookingDate);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <Pressable className="flex-1 bg-black/65" onPress={onSkip}>
        <Animated.View
          style={[sheetStyle, {
            width: SCREEN_WIDTH,
            maxHeight: SCREEN_HEIGHT * 0.85,
            position: "absolute",
            bottom: 0,
          }]}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="overflow-hidden rounded-t-3xl bg-card border border-border mx-3"
            style={{ marginTop: 40 }}
          >
            {/* Header with close button */}
            <View className="px-6 pt-4 pb-2 border-b border-border">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-xl font-bold text-foreground">
                    How was your visit?
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-1">
                    Share your experience with others
                  </Text>
                </View>
                <Pressable
                  onPress={onSkip}
                  className="p-2 rounded-full bg-muted/50 active:bg-muted"
                >
                  <X size={20} className="text-muted-foreground" />
                </Pressable>
              </View>
            </View>

            {/* Content */}
            <ScrollView
              className="px-6 py-5"
              style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Restaurant card */}
              <View className="mb-5 rounded-2xl border border-border bg-muted/40 p-4">
                <View className="flex-row items-start">
                  {booking.restaurant.main_image_url && (
                    <Image
                      source={{ uri: booking.restaurant.main_image_url }}
                      optimizationPreset="medium"
                      className="w-20 h-20 rounded-xl mr-4"
                      contentFit="cover"
                    />
                  )}
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">
                      {booking.restaurant.name}
                    </Text>
                    {!!booking.restaurant.address && (
                      <Text className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {booking.restaurant.address}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Booking details */}
              <View className="rounded-2xl border border-border bg-background p-4">
                <Text className="text-sm font-semibold text-foreground mb-3">
                  Visit Details
                </Text>
                <InfoRow
                  icon={<Calendar size={16} className="text-foreground" />}
                  value={formatDateToDDMMYYYY(bookingDate)}
                />
                <View className="h-[1px] bg-border my-1" />
                <InfoRow
                  icon={<Clock size={16} className="text-foreground" />}
                  value={timeString}
                />
                <View className="h-[1px] bg-border my-1" />
                <InfoRow
                  icon={<Users size={16} className="text-foreground" />}
                  value={`${booking.party_size} ${booking.party_size === 1 ? "Guest" : "Guests"}`}
                />
              </View>

              {/* Benefits notice */}
              <View className="mt-5 rounded-2xl border border-primary/25 bg-primary/10 p-4">
                <View className="flex-row items-start">
                  <View className="mr-3 mt-0.5">
                    <Star
                      size={20}
                      className="text-primary"
                      fill="currentColor"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-primary mb-1">
                      Your review helps others
                    </Text>
                    <Text className="text-xs leading-5 text-primary/80">
                      Share your experience to help fellow diners make informed
                      decisions about their next meal.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer with actions */}
            <View className="border-t border-border px-6 pb-6 pt-4 bg-card">
              <View className="gap-3">
                <Button
                  onPress={onWriteReview}
                  className="h-14 rounded-2xl bg-primary"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <MessageSquare size={20} color="white" />
                    <Text className="text-base font-bold text-primary-foreground">
                      Write Review
                    </Text>
                  </View>
                </Button>
                <Button
                  variant="ghost"
                  onPress={onSkip}
                  className="h-12 rounded-xl"
                >
                  <Text className="text-sm font-medium text-muted-foreground">
                    Maybe Later
                  </Text>
                </Button>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
