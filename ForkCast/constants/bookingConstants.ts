import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Award,
  Star,
  Crown,
  Sparkles,
  Timer, // Added for pending status
  CreditCard, // Added for pending_payment status
} from "lucide-react-native";

// --- Booking Statuses ---
// Merged configuration with improved labels and the 'Timer' icon for pending requests.
export const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Approval",
    icon: Timer, // Using 'Timer' for a more specific UX
    color: "#f97316", // Orange for pending state
    bgColor: "#ffedd5", // Light orange background
    description:
      "The restaurant is reviewing your request. We'll notify you upon confirmation.",
  },
  pending_payment: {
    label: "Payment Required",
    icon: CreditCard,
    color: "#8b5cf6", // Purple for payment state
    bgColor: "#ede9fe", // Light purple background
    description:
      "Please complete payment to confirm your booking. Your spot is reserved for 10 minutes.",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981",
    bgColor: "#d1fae5",
    description:
      "Your table is confirmed! Please arrive on time and show your confirmation.",
  },
  cancelled_by_user: {
    label: "Cancelled",
    icon: XCircle,
    color: "#6b7280",
    bgColor: "#f3f4f6",
    description: "You cancelled this booking.",
  },
  declined_by_restaurant: {
    label: "Declined",
    icon: XCircle,
    color: "#ef4444",
    bgColor: "#fee2e2",
    description: "The restaurant was unable to accommodate this request.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6",
    bgColor: "#dbeafe",
    description:
      "Thank you for dining with us! We hope you had a great experience.",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626",
    bgColor: "#fee2e2",
    description: "This booking was marked as a no-show.",
  },
  auto_declined: {
    label: "Declined",
    icon: XCircle,
    color: "#ef4444",
    bgColor: "#fee2e2",
    description:
      "This booking was automatically declined as the restaurant did not respond in time.",
  },
} as const;

// --- Booking Policies (from AI suggestion) ---
// Defines the type of booking available at a restaurant.
export const BOOKING_POLICIES = {
  instant: {
    label: "Instant Booking",
    description: "Your table is confirmed immediately.",
    icon: "⚡",
    color: "#10b981",
  },
  request: {
    label: "Request to Book",
    description: "The restaurant will confirm your request shortly.",
    icon: "⏰",
    color: "#f97316",
  },
} as const;

// --- User Tiers (from your original) ---
// Configuration for displaying user loyalty tiers.
export const TIER_DISPLAY_CONFIG = {
  bronze: { name: "Bronze", color: "#CD7F32", icon: Award },
  silver: { name: "Silver", color: "#C0C0C0", icon: Star },
  gold: { name: "Gold", color: "#FFD700", icon: Crown },
  platinum: { name: "Platinum", color: "#E5E4E2", icon: Sparkles },
} as const;

// --- Booking Logic Timers (from AI suggestion) ---
// Timeout in minutes for a pending request to be automatically handled.
export const REQUEST_BOOKING_TIMEOUT = 120; // 2 hours

// Time in minutes after which a warning or follow-up might be displayed.
export const REQUEST_BOOKING_WARNING_TIME = 90; // 1.5 hours

// --- Map Configuration (from your original) ---
// Default map coordinates (Beirut, Lebanon) for when user location is unavailable.
export const DEFAULT_MAP_COORDINATES = {
  latitude: 33.8938,
  longitude: 35.5018,
};

// Default zoom level for the map.
export const MAP_REGION_CONFIG = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};
