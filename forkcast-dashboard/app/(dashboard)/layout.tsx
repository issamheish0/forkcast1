// app/(dashboard)/layout.tsx
export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StaffChatProvider } from "@/lib/contexts/staff-chat-context"
import StaffChatToggle from "@/components/chat/chat-toggle"
import StaffChatPanel from "@/components/chat/staff-chat-panel"
import { SidebarProvider } from "@/lib/contexts/sidebar-context"
import { RestaurantProvider } from "@/lib/contexts/restaurant-context"
import { DashboardLayoutInner } from "@/components/layout/dashboard-layout-inner"
import { EnhancedPWAProvider } from "@/components/pwa/enhanced-pwa-provider"
import { NotificationManager } from "@/components/notification-manager"
import { GlobalLayoutNotifications } from "@/components/notifications/global-layout-notifications"
import { BookingAlarmWatcher } from "@/components/booking-alarm/booking-alarm-watcher"
import { BookingAlarmOverlay } from "@/components/booking-alarm/booking-alarm-overlay"
import { getMfaState, isStaffMfaEnforced } from "@/lib/auth/mfa-enforcement"


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirectTo=/bookings")
  }

  // -------------------------------------------------------------------------
  // Forced password reset (W02): if an admin has flagged this user as
  // "must reset password", divert them to the reset flow before showing
  // any dashboard content. The forced_password_resets table has an RLS
  // policy that lets users read their own row.
  // -------------------------------------------------------------------------
  const { data: forcedReset } = await supabase
    .from("forced_password_resets")
    .select("user_id, reason")
    .eq("user_id", user.id)
    .is("consumed_at", null)
    .maybeSingle()

  if (forcedReset) {
    redirect("/reset-password?reason=forced")
  }

  // -------------------------------------------------------------------------
  // MFA enforcement (W02): when ENFORCE_STAFF_MFA=true, every staff
  // session needs a verified TOTP factor before reaching the dashboard.
  // -------------------------------------------------------------------------
  if (isStaffMfaEnforced()) {
    const mfa = await getMfaState()
    if (!mfa.hasVerifiedFactor) {
      redirect("/mfa-enroll?redirectTo=/bookings")
    }
    if (mfa.currentLevel === "aal1" && mfa.nextLevel === "aal2") {
      redirect("/login?redirectTo=/bookings&error=mfa_required")
    }
  }

  // Check if user is an RBS admin — admins bypass restaurant-staff requirement
  const { data: adminData } = await supabase
    .from("rbs_admins")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  const userIsAdmin = !!adminData
  const userIsSuperAdmin = adminData?.role === 'super_admin'

  // Get all restaurants where user is staff or creator
  const { data: staffData } = await supabase
    .from("restaurant_staff")
    .select(`
      id,
      role,
      permissions,
      restaurant_id,
      restaurant:restaurants(*)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)

  // Also get restaurants created by this user
  const { data: createdRestaurants } = await supabase
    .from("restaurants")
    .select("*")
    .eq("created_by", user.id)

  // Combine staff data and created restaurants for access control
  const allRestaurants = [
    ...(staffData?.map(s => ({ ...s, restaurant: Array.isArray(s.restaurant) ? s.restaurant[0] : s.restaurant, isStaff: true })) || []),
    ...(createdRestaurants?.map(r => ({ restaurant: r, restaurant_id: r.id, role: 'owner', isCreator: true })) || [])
  ]

  // Admins can access dashboard even without restaurant assignments.
  // For non-admins, enforce restaurant access.
  if (!userIsAdmin && (!allRestaurants || allRestaurants.length === 0)) {
    redirect("/login?error=no_access")
  }

  const headersList = await headers()
  const pathname = headersList.get("x-pathname") || ""

  // Admins have their own area — send them there instead of blocking access.
  // Skip this check if the user also has restaurant staff access (they can use both).
  const hasRestaurantAccess = allRestaurants.length > 0
  if (userIsAdmin && !userIsSuperAdmin && !hasRestaurantAccess && adminData && pathname) {
    if (!pathname.startsWith('/super-admin')) {
      const { data: permData } = await supabase
        .from("admin_permissions")
        .select("allowed_sections")
        .eq("admin_id", adminData.id)
        .maybeSingle()

      if (permData) {
        const allowed: string[] = permData.allowed_sections || []
        const segment = pathname.split('/')[1] ?? ''
        const sectionAllowed = allowed.includes('*') || allowed.includes(segment) || segment === ''
        if (!sectionAllowed) {
          redirect('/super-admin')
        }
      }
    }
  }

  // Get the current restaurant ID for notifications
  const restaurantId = allRestaurants[0]?.restaurant_id

  return (
    <EnhancedPWAProvider restaurantId={restaurantId}>
      <RestaurantProvider>
        <SidebarProvider>
          <DashboardLayoutInner staffData={allRestaurants} isAdmin={userIsAdmin} isSuperAdmin={userIsSuperAdmin}>
          <NotificationManager />
            <GlobalLayoutNotifications />
            <BookingAlarmWatcher />
            <BookingAlarmOverlay />
            {children}
          </DashboardLayoutInner>
        </SidebarProvider>
      </RestaurantProvider>
    </EnhancedPWAProvider>
  )
}
