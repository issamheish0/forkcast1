// components/layout/nav-config.ts
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Calendar,
  Clock,
  Crown,
  DollarSign,
  Gift,
  Grid,
  LayoutDashboard,
  Map,
  PartyPopper,
  Settings,
  Star,
  User,
  Users,
  Layout,
  List,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: string | null;
  tierFeature?: string; // Maps to tier feature from our tier utility
  badge?: number;
  children?: NavigationItem[]; // Submenu items
}

export const NAV_ITEMS: NavigationItem[] = [
  // --- Core Operations ---
  {
    title: "Dashboard",
    href: "/bookings",
    icon: LayoutDashboard,
    permission: null,
    tierFeature: "booking_management",
  },
  {
    title: "Bookings",
    href: "/bookings",
    icon: Calendar,
    permission: "bookings.view",
    tierFeature: "bookings_advanced",
  },
  {
    title: "Waiting List",
    href: "/waitlist",
    icon: Clock,
    permission: "bookings.view",
    tierFeature: "waitlist",
  },
  // --- Floor & Table Management ---
  {
    title: "Floor Plan",
    href: "/floorplan",
    icon: Map,
    permission: "tables.view",
    tierFeature: "floor_plan",
    children: [
      {
        title: "Tables",
        href: "/floorplan/tables",
        icon: Grid,
        permission: "tables.view",
        tierFeature: "floor_plan",
      },
      {
        title: "List",
        href: "/floorplan/list",
        icon: List,
        permission: "tables.view",
        tierFeature: "floor_plan",
      },
    ],
  },
  {
    title: "Floor Sections",
    href: "/floorsections",
    icon: Layout,
    permission: "tables.view",
    tierFeature: "floor_plan",
  },
  {
    title: "Sections",
    href: "/sections",
    icon: Grid,
    permission: null,
    tierFeature: "section_management",
  },
  // --- Customers ---
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    permission: "customers.view",
    tierFeature: "customer_management",
  },
  // --- Events & Scheduling ---
  {
    title: "Events",
    href: "/events",
    icon: PartyPopper,
    permission: null,
    tierFeature: "booking_management",
  },
  {
    title: "Schedules",
    href: "/schedules",
    icon: Clock,
    permission: "schedules.view",
    tierFeature: "schedules_management",
  },
  // --- Marketing & Engagement ---
  {
    title: "Special Offers",
    href: "/special-offers",
    icon: Gift,
    permission: null,
    tierFeature: "booking_management",
  },
  {
    title: "Offers",
    href: "/offers",
    icon: DollarSign,
    permission: "offers.view",
    tierFeature: "offers_management",
  },
  {
    title: "Loyalty",
    href: "/loyalty",
    icon: Gift,
    permission: "loyalty.view",
    tierFeature: "loyalty_management",
  },
  {
    title: "Reviews",
    href: "/reviews",
    icon: Star,
    permission: "reviews.view",
    tierFeature: "review_management",
  },
  // --- Analytics & Insights ---
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: "analytics.view",
    tierFeature: "advanced_analytics",
  },
  // --- Staff & Administration ---
  {
    title: "Staff",
    href: "/staff",
    icon: Users,
    permission: "staff.manage",
    tierFeature: "staff_management",
  },
  {
    title: "Super Admin",
    href: "/super-admin",
    icon: Crown,
    permission: "super_admin",
    tierFeature: "booking_management",
  },
  {
    title: "Profile",
    href: "/profile",
    icon: User,
    permission: null,
    tierFeature: "profile_management",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings.view",
    tierFeature: "settings_basic",
  },
];

export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    permission: null,
    tierFeature: "notifications_advanced",
  },
];

