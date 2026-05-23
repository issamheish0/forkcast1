// components/booking/BookingCard.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Share,
} from "react-native";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Info,
  Navigation,
  Phone,
  Star,
  Copy,
  CalendarPlus,
  Share2,
  Timer, // Added for pending status
  RotateCcw, // Added for rebooking
  X,
  Check,
  UserPlus, // Added for invitation indicator
  Sparkles, // Added for event bookings
  CreditCard, // Added for pending_payment status
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Calendar from "expo-calendar";

import { Image as CustomImage } from "@/components/image";
import { Image as ExpoImage } from "expo-image";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { supabase } from "@/config/supabase";
import { cn } from "@/lib/utils";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";
import { formatDateShort } from "@/utils/birthday";
import { useShare } from "@/hooks/useShare";
import {
  parseFromLebanonTZ,
  isLebanonToday,
  isLebanonTomorrow,
  formatLebanonDateShort,
  formatLebanonTime,
  getCurrentLebanonTime,
} from "@/utils/lebanonTime";
import { useRouter } from "expo-router";

// Enhanced booking type that includes invitation info
interface EnhancedBooking {
  id: string;
  user_id: string;
  restaurant_id: string;
  booking_time: string;
  party_size: number;
  status: string;
  special_requests?: string;
  occasion?: string;
  dietary_notes?: string[];
  confirmation_code?: string;
  table_preferences?: string[];
  reminder_sent?: boolean;
  checked_in_at?: string;
  loyalty_points_earned?: number;
  created_at?: string;
  updated_at?: string;
  applied_offer_id?: string;
  expected_loyalty_points?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  is_group_booking?: boolean;
  organizer_id?: string;
  attendees?: number;
  turn_time_minutes: number;
  applied_loyalty_rule_id?: string;
  actual_end_time?: string;
  seated_at?: string;
  meal_progress?: any;
  request_expires_at?: string;
  auto_declined?: boolean;
  acceptance_attempted_at?: string;
  acceptance_failed_reason?: string;
  suggested_alternative_time?: string;
  suggested_alternative_tables?: string[];
  source: string;
  is_shared_booking?: boolean;
  decline_note?: string;
  deposit_status?: string | null;
  payment_expires_at?: string | null;
  restaurant: {
    id: string;
    name: string;
    main_image_url?: string;
    address?: string;
    [key: string]: any;
  };
  // Invitation-related fields for bookings where user was invited
  invitation_id?: string;
  invited_by?: {
    id: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    avatar_url?: string;
  };
  is_invitee?: boolean;
}

interface BookingCardProps {
  booking: EnhancedBooking;
  variant?: "upcoming" | "past";
  onPress?: () => void;
  onCancel?: (bookingId: string) => void;
  onRebook?: (booking: EnhancedBooking) => void;
  onReview?: (booking: EnhancedBooking) => void;
  onLeave?: (booking: EnhancedBooking) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  onPayDeposit?: (booking: EnhancedBooking) => void;
  className?: string;
  showQuickActions?: boolean;
  processingBookingId?: string | null;
}

// --- Status Configuration (Enhanced) ---
const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Awaiting Restaurant Confirmation",
    icon: Timer, // Using Timer for pending
    color: "#f97316", // Orange
    description: "Waiting for restaurant confirmation",
  },
  pending_payment: {
    label: "Payment Required",
    icon: CreditCard,
    color: "#8b5cf6", // Purple
    description: "Complete payment to confirm booking",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981", // Green
    description: "Your table is reserved",
  },
  cancelled_by_user: {
    label: "Cancelled by You",
    icon: XCircle,
    color: "#6b7280", // Gray
    description: "You cancelled this booking",
  },
  declined_by_restaurant: {
    label: "Restaurant Could Not Accommodate",
    icon: XCircle,
    color: "#ef4444", // Red
    description: "Restaurant couldn't accommodate this request",
  },
  cancelled_by_restaurant: {
    label: "Cancelled",
    icon: XCircle,
    color: "#ef4444", // Red
    description: "Restaurant cancelled this booking",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6", // Blue
    description: "Thank you for dining with us",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626", // Dark Red
    description: "Booking was missed",
  },
  auto_declined: {
    label: "Automatically Declined",
    icon: XCircle,
    color: "#ef4444", // Red
    description: "Restaurant did not respond in time",
  },
};

// --- Utility Functions ---

// Utility to format time since an event (Lebanon Time Aware)
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle negative values (future dates)
  if (seconds < 0) return "just now";

  // Years (365 days)
  const years = Math.floor(seconds / 31536000);
  if (years >= 1) return `${years}y ago`;

  // Months (30 days)
  const months = Math.floor(seconds / 2592000);
  if (months >= 1) return `${months}mo ago`;

  // Days
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d ago`;

  // Hours
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h ago`;

  // Minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return `${minutes}m ago`;

  // Seconds (only if less than 60 seconds)
  return `${seconds}s ago`;
};

// Utility to format relative future time (Lebanon Time Aware)
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  // Handle past dates (reuse formatTimeAgo for consistency)
  if (diffMs <= 0) {
    return formatTimeAgo(date);
  }

  // Calculate future time difference
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes === 0) {
    return "in < 1 min";
  }

  if (diffMinutes < 60) {
    return `in ${diffMinutes} min${diffMinutes === 1 ? "" : "s"}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    const minutes = diffMinutes % 60;
    return minutes === 0 ? `in ${diffHours}h` : `in ${diffHours}h ${minutes}m`;
  }

  const diffDays = Math.floor(diffMs / 86400000);

  if (isLebanonTomorrow(date)) {
    return "tomorrow";
  }

  if (diffDays < 7) {
    return `in ${diffDays} days`;
  }

  if (diffDays < 30) {
    const diffWeeks = Math.round(diffDays / 7);
    return diffWeeks <= 1 ? "in 1 week" : `in ${diffWeeks} weeks`;
  }

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths <= 1 ? "in 1 month" : `in ${diffMonths} months`;
  }

  const diffYears = Math.round(diffDays / 365);
  return diffYears <= 1 ? "in 1 year" : `in ${diffYears} years`;
};

const extractLocationCoordinates = (location: any) => {
  if (!location) return null;
  try {
    if (typeof location === "string" && location.includes("POINT(")) {
      const coordsMatch = location.match(/POINT\(([^)]+)\)/);
      if (coordsMatch && coordsMatch[1]) {
        const [lng, lat] = coordsMatch[1].split(" ").map(Number);
        return { latitude: lat, longitude: lng };
      }
    } else if (location.coordinates && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

const getDefaultCalendar = async () => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Calendar permission not granted");
  }
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  return (
    calendars.find((cal) => cal.source.name === "Default" || cal.isPrimary) ||
    calendars[0]
  );
};

// --- Main Component ---
export function BookingCard({
  booking,
  variant = "upcoming",
  onPress,
  onCancel,
  onRebook,
  onReview,
  onLeave,
  onNavigateToRestaurant,
  onPayDeposit,
  className,
  showQuickActions = true,
  processingBookingId,
}: BookingCardProps) {
  // React hooks must always be called before any early returns
  const [hasReview, setHasReview] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const [otherInvitees, setOtherInvitees] = useState<
    {
      id: string;
      first_name?: string;
      last_name?: string;
      full_name: string;
      avatar_url?: string;
      status: "pending" | "accepted" | "declined" | "cancelled";
    }[]
  >([]);
  const [loadingInvitees, setLoadingInvitees] = useState(false);
  const { colorScheme } = useColorScheme();
  const { shareBooking } = useShare();
  const router = useRouter();
  const theme = colors[(colorScheme ?? "light") as keyof typeof colors];

  // Early return AFTER hooks for invalid booking data
  if (!booking || !booking.id || !booking.booking_time || !booking.restaurant) {
    return null;
  }

  const imageUrl =
    booking.restaurant?.main_image_url || booking.restaurant?.image_url || null;

  // Safe date parsing with error handling using Lebanon Time
  let bookingDate: Date;
  try {
    // Parse the booking time as Lebanon time
    bookingDate = parseFromLebanonTZ(booking.booking_time);

    // Check if date is valid
    if (isNaN(bookingDate.getTime())) {
      throw new Error("Invalid date");
    }
  } catch {
    bookingDate = getCurrentLebanonTime(); // Fallback to current Lebanon time
  }

  // Safe date comparisons using Lebanon Time utilities
  let isToday = false;
  let isTomorrow = false;

  try {
    isToday = isLebanonToday(bookingDate);
    isTomorrow = isLebanonTomorrow(bookingDate);
  } catch {
    // Use defaults (isToday/isTomorrow stay false)
  }

  const isPast = variant === "past";
  const isProcessing = processingBookingId === booking.id;
  const isPending = booking.status === "pending";
  const isPendingPayment = booking.status === "pending_payment";
  const isDeclined =
    booking.status === "declined_by_restaurant" ||
    booking.status === "cancelled_by_restaurant" ||
    booking.status === "auto_declined";
  const isCompleted = booking.status === "completed";
  const isConfirmed = booking.status === "confirmed";

  // Check if pending booking has passed its time (should be treated as declined)
  // Use Lebanon time for comparison
  const isPendingAndPassed = isPending && bookingDate < getCurrentLebanonTime();

  // Check if pending_payment booking has expired (10 min payment window)
  const isPendingPaymentExpired =
    isPendingPayment && booking.payment_expires_at
      ? new Date(booking.payment_expires_at) < new Date()
      : false;

  // Use declined status for pending bookings that have passed their time
  const effectiveStatus = isPendingAndPassed
    ? "declined_by_restaurant"
    : isPendingPaymentExpired
      ? "cancelled_by_user" // Treat expired payment as cancelled
      : booking.status;

  const statusConfig =
    BOOKING_STATUS_CONFIG[
      effectiveStatus as keyof typeof BOOKING_STATUS_CONFIG
    ] || BOOKING_STATUS_CONFIG.pending;

  // Ensure we have a valid status config with proper fallback
  const finalStatusConfig = statusConfig || BOOKING_STATUS_CONFIG.pending;
  const StatusIcon = finalStatusConfig.icon;

  // Calculate time since request for pending bookings with safe date handling
  let timeSinceRequest = null;
  if (isPending && booking.created_at) {
    try {
      const createdDate = new Date(booking.created_at);
      if (!isNaN(createdDate.getTime())) {
        timeSinceRequest = formatTimeAgo(createdDate);
      }
    } catch {
      // Ignore date parse errors
    }
  }

  useEffect(() => {
    let isCancelled = false;

    const checkReview = async () => {
      if (isCompleted && booking?.id) {
        try {
          const { data, error } = await supabase
            .from("reviews")
            .select("id")
            .eq("booking_id", booking.id)
            .single();

          // Only update state if component hasn't been unmounted
          if (!isCancelled) {
            setHasReview(!!data && !error);
          }
        } catch {
          if (!isCancelled) {
            setHasReview(false);
          }
        }
      }
    };

    checkReview();

    // Cleanup function to prevent memory leaks
    return () => {
      isCancelled = true;
    };
  }, [booking.id, isCompleted]);

  // Fetch other invitees for this booking
  useEffect(() => {
    const fetchOtherInvitees = async () => {
      if (!booking.id) return;

      setLoadingInvitees(true);
      try {
        const { data, error } = await supabase
          .from("booking_invites")
          .select(
            `
            id,
            status,
            to_user:profiles!booking_invites_to_user_id_fkey (
              id,
              first_name,
              last_name,
              full_name,
              avatar_url
            )
          `,
          )
          .eq("booking_id", booking.id)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: true });

        if (!error && data) {
          const inviteesWithUser = data
            .filter((invite: any) => invite.to_user) // Filter out null users
            .map((invite: any) => ({
              id: invite.to_user.id,
              first_name: invite.to_user.first_name,
              last_name: invite.to_user.last_name,
              full_name: invite.to_user.full_name,
              avatar_url: invite.to_user.avatar_url,
              status: invite.status,
            }));

          setOtherInvitees(inviteesWithUser);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setLoadingInvitees(false);
      }
    };

    fetchOtherInvitees();
  }, [booking.id]);

  // --- Handlers (Unchanged from original) ---
  const handlePress = () => onPress?.();
  const handleCancelBooking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCancel?.(booking.id);
  };

  const handleLeaveBooking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLeave?.(booking);
  };
  const handleQuickCall = async () => {
    if (!booking.restaurant.phone) {
      Alert.alert(
        "No Phone Number",
        "Phone number is not available for this restaurant",
      );
      return;
    }

    const phoneUrl = `tel:${booking.restaurant.phone}`;

    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Error", "Unable to open phone application");
      }
    } catch {
      Alert.alert("Error", "Unable to make phone call");
    }
  };
  const handleDirections = async () => {
    if (!booking.restaurant) return;

    // Extract coordinates from restaurant location
    const coords = extractLocationCoordinates(booking.restaurant.location);

    if (!coords) {
      Alert.alert("Error", "Location information not available");
      return;
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = encodeURIComponent(booking.restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert("Error", "Unable to open maps application");
      }
    }
  };
  const handleCopyConfirmation = async () => {
    if (!booking.confirmation_code) return;

    try {
      await Clipboard.setStringAsync(booking.confirmation_code);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Copied", "Confirmation code copied to clipboard");
    } catch {
      Alert.alert("Error", "Unable to copy confirmation code");
    }
  };

  const handleShareBooking = async () => {
    if (!booking || !booking.id) return;

    try {
      await shareBooking(booking as any);
    } catch {
      Alert.alert("Error", "Unable to share booking");
    }
  };

  const handleAddToCalendar = async () => {
    if (isAddingToCalendar) return;

    try {
      // Request calendar permissions using Expo Calendar
      const { status } = await Calendar.requestCalendarPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Calendar Access Required",
          "We need access to your calendar to add this reservation. You can enable this in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      // Directly open the system calendar UI with pre-filled event data
      await openCalendarUIWithEvent();
    } catch {
      Alert.alert(
        "Calendar Error",
        "Unable to open your calendar. Please try again or add the event manually.",
      );
    }
  };

  /**
   * Opens the system calendar UI with pre-filled event data.
   * This provides a user-friendly experience where they can review and edit
   * the event details before saving to their preferred calendar.
   * Uses Calendar.createEventInCalendarAsync() for iOS/Android system UI.
   */
  const openCalendarUIWithEvent = async () => {
    setIsAddingToCalendar(true);

    try {
      // Prepare event details with smart duration calculation
      const bookingDate = new Date(booking.booking_time);
      const hour = bookingDate.getHours();

      // Smart duration based on meal time
      let durationHours = 2; // Default
      if (hour >= 6 && hour < 11) {
        durationHours = 1.5; // Breakfast/Brunch
      } else if (hour >= 11 && hour < 16) {
        durationHours = 1.5; // Lunch
      } else if (hour >= 16 && hour < 22) {
        durationHours = 2.5; // Dinner
      } else {
        durationHours = 2; // Late night
      }

      const endDate = new Date(
        bookingDate.getTime() + durationHours * 60 * 60 * 1000,
      );

      // Determine meal type for title
      const getMealType = (hour: number) => {
        if (hour >= 6 && hour < 11) return "Breakfast";
        if (hour >= 11 && hour < 16) return "Lunch";
        if (hour >= 16 && hour < 22) return "Dinner";
        return "Late Night";
      };

      const mealType = getMealType(hour);

      // Create comprehensive event details for the calendar UI
      const eventDetails = {
        title: `${mealType} at ${booking.restaurant.name}`,
        startDate: bookingDate,
        endDate: endDate,
        location: booking.restaurant.address || booking.restaurant.name,
        notes: [
          `🍽️ Table reservation for ${booking.party_size} ${booking.party_size === 1 ? "guest" : "guests"}`,
          booking.confirmation_code
            ? `📋 Confirmation Code: ${booking.confirmation_code}`
            : "",
          `🏪 Restaurant: ${booking.restaurant.name}`,
          (() => {
            const c = getDisplayCuisine(
              booking.restaurant.cuisine_type,
              (booking.restaurant as any).secondary_cuisines,
              "",
            );
            return c ? `🍜 Cuisine: ${c}` : "";
          })(),
          booking.restaurant.phone
            ? `📞 Phone: ${booking.restaurant.phone}`
            : "",
          booking.special_requests
            ? `💬 Special Requests: ${booking.special_requests}`
            : "",
          booking.occasion ? `🎉 Occasion: ${booking.occasion}` : "",
          "",
          "⏰ Please arrive 10-15 minutes early",
          "📱 Booked via ForkCast",
        ]
          .filter(Boolean)
          .join("\n"),
        alarms: [
          { relativeOffset: -120 }, // 2 hours before
          { relativeOffset: -60 }, // 1 hour before
          { relativeOffset: -15 }, // 15 minutes before
        ],
      };

      // Open the system calendar UI with pre-filled event data
      const result = await Calendar.createEventInCalendarAsync(eventDetails);

      // Handle the result based on user action
      if (result.action === "saved") {
        // User saved the event
        setAddedToCalendar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        Alert.alert(
          "📅 Added to Calendar!",
          `Your reservation at ${booking.restaurant.name} has been successfully added to your calendar!\n\nReminders have been set for:\n• 2 hours before\n• 1 hour before\n• 15 minutes before`,
          [
            {
              text: "View in Calendar",
              onPress: () => {
                // Try to open the calendar app
                const calendarUrl = Platform.select({
                  ios: "calshow:",
                  android: "content://com.android.calendar/time",
                });
                if (calendarUrl) {
                  Linking.canOpenURL(calendarUrl).then((supported) => {
                    if (supported) {
                      Linking.openURL(calendarUrl);
                    }
                  });
                }
              },
            },
            { text: "Done", style: "default" },
          ],
        );
      } else if (result.action === "canceled") {
        // User canceled without saving
        // No need to show an alert, just give subtle feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      // More specific error handling
      let errorMessage = "Unable to open calendar. Please try again.";

      if (error instanceof Error) {
        if (error.message?.includes("permission")) {
          errorMessage =
            "Calendar permission was revoked. Please check your settings.";
        } else if (error.message?.includes("calendar")) {
          errorMessage = "Calendar is not available. Please try again later.";
        }
      }

      Alert.alert("Calendar Error", errorMessage, [
        {
          text: "Try Again",
          onPress: () => {
            setIsAddingToCalendar(false);
            setTimeout(() => handleAddToCalendar(), 100);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleCalendarSelection = async () => {
    // This function is no longer needed since we're using the system UI
    // But keeping it for backward compatibility
    await openCalendarUIWithEvent();
  };
  const handleReview = () => {
    onReview?.(booking);
  };
  const handleRebook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRebook?.(booking);
  };

  const relativeLabel =
    !isPast && !isPendingAndPassed
      ? formatRelativeTime(bookingDate)
      : formatTimeAgo(bookingDate);

  return (
    <>
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-lg overflow-hidden mb-3 border border-border shadow-sm",
          className,
        )}
      >
        {/* Restaurant Header */}
        <View className="flex-row p-3">
          <ExpoImage
            source={{
              uri:
                imageUrl || "https://via.placeholder.com/60x60?text=No+Image",
            }}
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              backgroundColor: colorScheme === "dark" ? "#1f2937" : "#f3f4f6",
            }}
            contentFit="cover"
            onError={() => {}}
            transition={200}
          />
          <View className="flex-1 ml-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <H3 className="mb-1 text-base">
                  {booking.restaurant.name || "Restaurant"}
                </H3>

                {/* Invitation Indicator */}
                {booking.is_invitee && booking.invited_by && (
                  <View className="flex-row items-center gap-1 mb-1">
                    <UserPlus size={10} color="#10b981" />
                    <Text className="text-xs text-green-600 font-medium">
                      Invited by{" "}
                      {booking.invited_by.first_name &&
                      booking.invited_by.last_name
                        ? `${booking.invited_by.first_name} ${booking.invited_by.last_name}`
                        : booking.invited_by.full_name}
                    </Text>
                  </View>
                )}

                <Text className="text-muted-foreground text-xs mb-1">
                  {getDisplayCuisine(
                    (booking.restaurant as any).cuisine_type,
                    (booking.restaurant as any).secondary_cuisines,
                    "Cuisine",
                  )}
                </Text>
                <Text
                  className={`text-xs font-semibold ${
                    !isPast && !isPendingAndPassed
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {relativeLabel}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <ChevronRight size={16} color="#666" />
              </View>
            </View>
          </View>
        </View>

        {/* Event Badge - Show if this is an event booking */}
        {(booking as any).is_event_booking &&
          (booking as any).event_occurrence?.event && (
            <View className="mx-3 mb-3">
              <View className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <Sparkles size={16} color="#9333ea" />
                  <Text className="text-sm font-bold text-purple-900 dark:text-purple-100">
                    Special Event Booking
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-1">
                  {(booking as any).event_occurrence.event.title}
                </Text>
                {(booking as any).event_occurrence.event.description && (
                  <Text
                    className="text-xs text-purple-700 dark:text-purple-300"
                    numberOfLines={2}
                  >
                    {(booking as any).event_occurrence.event.description}
                  </Text>
                )}
                {(booking as any).event_occurrence.event.minimum_age && (
                  <View className="flex-row items-center gap-1 mt-2">
                    <AlertCircle size={12} color="#9333ea" />
                    <Text className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                      {(booking as any).event_occurrence.event.minimum_age}+
                      Only
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

        {/* Booking Details - Compact Layout */}
        <View className="px-3 pb-3">
          {/* Status Display for Upcoming Bookings */}
          {variant === "upcoming" && (
            <View className="mb-3">
              {isConfirmed && (
                <View className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <CheckCircle size={16} color="#16a34a" />
                      <Text className="text-sm font-semibold text-green-800 dark:text-green-200">
                        Confirmed
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {isPending && !isPendingAndPassed && (
                <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                  <View className="flex-row items-center justify-center gap-2">
                    <Clock size={16} color="#f59e0b" />
                    <Text className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                      Waiting for restaurant confirmation
                    </Text>
                  </View>
                </View>
              )}
              {isPendingPayment && !isPendingPaymentExpired && (
                <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                  <View className="flex-row items-center justify-center gap-2">
                    <CreditCard size={16} color="#8b5cf6" />
                    <Text className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                      Payment Required
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* --- Core Details Section - More Prominent --- */}
          <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center gap-2">
                <CalendarIcon size={14} color={theme.primary} />
                <View>
                  <Text className="text-sm text-muted-foreground">
                    {isToday
                      ? "Today"
                      : isTomorrow
                        ? "Tomorrow"
                        : formatLebanonDateShort(bookingDate)}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Clock size={14} color={theme.primary} />
                <View>
                  <Text className="text-sm text-muted-foreground">
                    {formatLebanonTime(bookingDate)}
                  </Text>
                </View>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={14} color={theme.primary} />
                <Text className="text-sm font-medium text-primary dark:text-white">
                  {booking.party_size || 1}{" "}
                  {(booking.party_size || 1) === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
              {booking.confirmation_code && !isPending && (
                <Pressable
                  onPress={handleCopyConfirmation}
                  className="flex-row items-center gap-1 bg-background px-2 py-1 rounded border border-border"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Copy size={12} color="#666" />
                  <Text className="text-xs font-mono font-medium">
                    {booking.confirmation_code || "N/A"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Other Invitees Section */}
          {otherInvitees.length > 0 && (
            <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3 border border-blue-200 dark:border-blue-800">
              <View className="flex-row items-center gap-2 mb-2">
                <UserPlus size={14} color="#3b82f6" />
                <Text className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Other Invitees ({otherInvitees.length})
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {otherInvitees.slice(0, 4).map((invitee) => (
                  <View
                    key={invitee.id}
                    className="flex-row items-center gap-2 bg-background/60 rounded-lg px-2 py-1"
                  >
                    <CustomImage
                      source={{
                        uri:
                          invitee.avatar_url ||
                          `https://ui-avatars.com/api/?name=${
                            invitee.first_name && invitee.last_name
                              ? `${invitee.first_name} ${invitee.last_name}`
                              : invitee.full_name
                          }&background=e5e7eb&color=374151`,
                      }}
                      optimizationPreset="thumbnail"
                      className="w-5 h-5 rounded-full bg-gray-100"
                    />
                    <Text className="text-xs font-medium">
                      {invitee.first_name && invitee.last_name
                        ? `${invitee.first_name} ${invitee.last_name}`
                        : invitee.full_name}
                    </Text>
                    {invitee.status === "accepted" && (
                      <Check size={10} color="#10b981" />
                    )}
                    {invitee.status === "pending" && (
                      <Clock size={10} color="#f59e0b" />
                    )}
                  </View>
                ))}
                {otherInvitees.length > 4 && (
                  <View className="flex-row items-center gap-1 bg-background/60 rounded-lg px-2 py-1">
                    <Text className="text-xs font-medium text-muted-foreground">
                      +{otherInvitees.length - 4} more
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Status Bar for Past Bookings */}
          {variant === "past" && (
            <View
              className="w-full py-3 px-4 mb-3 rounded-lg"
              style={{
                backgroundColor:
                  booking.status === "completed"
                    ? "#dcfce7" // Light green
                    : booking.status === "cancelled_by_user" ||
                        booking.status === "cancelled_by_restaurant" ||
                        booking.status === "declined_by_restaurant" ||
                        booking.status === "auto_declined"
                      ? "#fef2f2" // Light red
                      : booking.status === "no_show"
                        ? "#fef3c7" // Light orange
                        : "#f3f4f6", // Default light gray
              }}
            >
              <View className="flex-row items-center justify-center gap-2">
                <StatusIcon
                  size={16}
                  color={
                    booking.status === "completed"
                      ? "#16a34a" // Green
                      : booking.status === "cancelled_by_user" ||
                          booking.status === "cancelled_by_restaurant" ||
                          booking.status === "declined_by_restaurant" ||
                          booking.status === "auto_declined"
                        ? "#dc2626" // Red
                        : booking.status === "no_show"
                          ? "#ea580c" // Orange
                          : "#6b7280" // Default gray
                  }
                />
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color:
                      booking.status === "completed"
                        ? "#16a34a" // Green
                        : booking.status === "cancelled_by_user" ||
                            booking.status === "cancelled_by_restaurant" ||
                            booking.status === "declined_by_restaurant" ||
                            booking.status === "auto_declined"
                          ? "#dc2626" // Red
                          : booking.status === "no_show"
                            ? "#ea580c" // Orange
                            : "#6b7280", // Default gray
                  }}
                >
                  {booking.status === "cancelled_by_restaurant"
                    ? "Cancelled by Restaurant"
                    : finalStatusConfig.label}
                </Text>
              </View>
              {/* Show decline reason preview for declined bookings */}
              {booking.status === "declined_by_restaurant" &&
              booking.decline_note &&
              booking.decline_note.trim() ? (
                <Text
                  className="text-xs text-red-600 dark:text-red-400 text-center mt-2"
                  numberOfLines={1}
                >
                  Restaurant reply: {booking.decline_note.trim()}
                </Text>
              ) : null}
            </View>
          )}

          {/* --- Quick Action Buttons - Compact Layout --- */}
          {showQuickActions && (
            <View className="flex-row flex-wrap gap-2">
              {/* Add to Calendar: Show for confirmed or pending (not expired) or pending_payment */}
              {!isPast &&
                (isConfirmed ||
                  (isPending && !isPendingAndPassed) ||
                  (isPendingPayment && !isPendingPaymentExpired)) && (
                  <Button
                    size="sm"
                    variant={addedToCalendar ? "secondary" : "outline"}
                    onPress={handleAddToCalendar}
                    disabled={isAddingToCalendar}
                    className="flex-1 min-w-[48%] h-8 rounded-lg"
                  >
                    {isAddingToCalendar ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : addedToCalendar ? (
                      <View className="flex-row items-center gap-1">
                        <CheckCircle size={12} color="#10b981" />
                        <Text className="text-xs">Added ✓</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1">
                        <CalendarPlus size={12} color="#3b82f6" />
                        <Text className="text-xs">Calendar</Text>
                      </View>
                    )}
                  </Button>
                )}

              {/* Share Booking - available for upcoming bookings */}
              {!isPast &&
                (isConfirmed ||
                  (isPending && !isPendingAndPassed) ||
                  (isPendingPayment && !isPendingPaymentExpired)) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={handleShareBooking}
                    className="flex-1 min-w-[48%] h-8 rounded-lg"
                  >
                    <View className="flex-row items-center gap-1">
                      <Share2 size={12} color="#3b82f6" />
                      <Text className="text-xs">Share</Text>
                    </View>
                  </Button>
                )}

              {/* Directions & Call: Show for pending (not expired) or confirmed or pending_payment */}
              {!isPast &&
                (isConfirmed ||
                  (isPending && !isPendingAndPassed) ||
                  (isPendingPayment && !isPendingPaymentExpired)) && (
                  <>
                    <View className="flex-1 min-w-[48%]">
                      <DirectionsButton
                        restaurant={booking.restaurant}
                        variant="button"
                        size="sm"
                        className="w-full h-8 justify-center rounded-lg"
                        backgroundColor="bg-primary"
                        borderColor="border-primary"
                        iconColor={theme.primaryForeground}
                        textColor="text-primary-foreground"
                      />
                    </View>
                    {booking.restaurant.phone && (
                      <Button
                        size="sm"
                        variant="default"
                        onPress={handleQuickCall}
                        className="flex-1 min-w-[48%] h-8 rounded-lg bg-primary"
                      >
                        <View className="flex-row items-center gap-1">
                          <Phone size={12} color={theme.primaryForeground} />
                          <Text className="text-xs text-primary-foreground">
                            Call
                          </Text>
                        </View>
                      </Button>
                    )}
                  </>
                )}

              {/* Actions for Past / Declined Bookings */}
              {(isPast || isPendingAndPassed) &&
                isCompleted &&
                !hasReview &&
                onReview && (
                  <Button
                    size="default"
                    variant="default"
                    onPress={handleReview}
                    className="flex-1 min-w-[48%] h-8 rounded-lg"
                  >
                    <View className="flex-row items-center gap-1 h-full">
                      <Star size={12} color="#fff" />
                      <Text className="text-xs text-white">Rate</Text>
                    </View>
                  </Button>
                )}

              {/* Quick Rebook Button - Show for all past bookings */}
              {(isPast || isPendingAndPassed) && onRebook && (
                <Button
                  size="default"
                  variant="outline"
                  onPress={handleRebook}
                  className="flex-1 min-w-[48%] h-8 rounded-lg border-primary"
                >
                  <View className="flex-row items-center gap-1">
                    <RotateCcw size={12} color={theme.primary} />
                    <Text className="text-xs text-primary">Book Again</Text>
                  </View>
                </Button>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </>
  );
}

BookingCard.displayName = "BookingCard";
