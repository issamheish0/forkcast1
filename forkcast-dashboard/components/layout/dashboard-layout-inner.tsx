// components/layout/dashboard-layout-inner.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useSidebar } from "@/lib/contexts/sidebar-context"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StaffChatProvider } from "@/lib/contexts/staff-chat-context"
import { useAdminPermissions } from "@/hooks/use-admin-permissions"

interface DashboardLayoutInnerProps {
  children: React.ReactNode
  staffData: any[]
  isAdmin?: boolean
  isSuperAdmin?: boolean
}

export function DashboardLayoutInner({ children, staffData, isAdmin: isAdminProp = false, isSuperAdmin: isSuperAdminProp = false }: DashboardLayoutInnerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { restaurants, currentRestaurant, isLoading, isMultiRestaurant } = useRestaurantContext()
  const { isCollapsed } = useSidebar()
  const { isSuperAdmin: hookIsSuperAdmin, loading: adminLoading } = useAdminPermissions()

  // Server-provided values are authoritative — hook values are supplementary (for sidebar)
  const isSuperAdmin = isSuperAdminProp || hookIsSuperAdmin
  const isAdmin = isAdminProp || isSuperAdmin

  const [isNavigating, setIsNavigating] = useState(false)

  // Only show spinner if navigation takes longer than 150ms, hide immediately when done
  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>
    let hideTimer: ReturnType<typeof setTimeout>

    showTimer = setTimeout(() => setIsNavigating(true), 150)

    hideTimer = setTimeout(() => setIsNavigating(false), 800)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
      setIsNavigating(false)
    }
  }, [pathname])

  // These pages don't require a restaurant to be selected
  const isOverviewPage = false
  const isSuperAdminPage = pathname.startsWith('/super-admin')
  const isNoRestaurantPage = isOverviewPage || isSuperAdminPage

  useEffect(() => {
    if (isLoading) return

    // Any admin with no restaurants → super-admin panel
    // Use server-provided isAdminProp which is reliable (service role, no RLS)
    if (isAdmin && restaurants.length === 0 && pathname === '/bookings') {
      router.replace('/super-admin')
      return
    }

    // If single restaurant, auto-redirect to its home page
    if (restaurants.length === 1 && !searchParams.get('restaurant') && pathname === '/bookings') {
      const restaurantId = restaurants[0].restaurant.id
      router.replace(`/bookings?restaurant=${restaurantId}`)
      return
    }

    // If multi-restaurant and no current selection and not on overview, redirect to overview
    if (isMultiRestaurant && !currentRestaurant && pathname === '/bookings' && !searchParams.get('restaurant')) {
      router.replace('/bookings')
      return
    }
  }, [
    restaurants,
    restaurants.length,
    currentRestaurant,
    isLoading,
    isAdmin,
    isMultiRestaurant,
    router,
    pathname,
    searchParams
  ])

  // Show loading state — don't block on adminLoading since admin status comes from server props
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="motion-safe:animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 motion-safe:animate-pulse" />
            </div>
          </div>
          <p className="text-lg font-medium text-foreground">Setting up your dashboard...</p>
          <p className="text-sm text-muted-foreground text-sm">Loading restaurant data</p>
        </div>
      </div>
    )
  }

  // For overview/super-admin pages, render without restaurant-specific layout
  if (isNoRestaurantPage) {
    return (
      <div className="min-h-screen bg-background relative">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    )
  }

  // Render restaurant-specific layout - only if we need a restaurant but don't have one
  // Admins with no restaurants are handled by the useEffect redirect above — don't show error flash
  if (!currentRestaurant && !isNoRestaurantPage && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">No restaurant selected</p>
          <p className="text-sm text-muted-foreground text-sm">Redirecting to overview...</p>
        </div>
      </div>
    )
  }

  // If we have a current restaurant, render the restaurant-specific layout
  if (currentRestaurant) {
    return (
      <div className="min-h-screen bg-background relative">
        {/* Sidebar Container - Show on tablets and up */}
        <div className="hidden sm:block fixed inset-y-0 left-0 z-30">
          <Sidebar 
            restaurant={{
              id: currentRestaurant.restaurant.id,
              name: currentRestaurant.restaurant.name,
              main_image_url: currentRestaurant.restaurant.main_image_url || undefined
            }}
            role={currentRestaurant.role}
            permissions={currentRestaurant.permissions}
          />
        </div>

        {/* Mobile Navigation - Show on phones only */}
        <div className="sm:hidden">
          <MobileNav 
            restaurant={{
              id: currentRestaurant.restaurant.id,
              name: currentRestaurant.restaurant.name,
              main_image_url: currentRestaurant.restaurant.main_image_url || undefined
            }}
          />
        </div>

        {/* Main Content - Full height optimization without header */}
        <div className={`transition-all duration-200 ease-out ${isCollapsed ? 'sm:ml-16' : 'sm:ml-72'}`}>
          <StaffChatProvider restaurantId={currentRestaurant.restaurant.id}>
            {/* Page transition loading overlay */}
            {isNavigating && (
              <div className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-4 border-[#7A2E4A]/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#7A2E4A] animate-spin" />
                  </div>
                </div>
              </div>
            )}
            <main className="min-h-screen">
              {children}
            </main>
          </StaffChatProvider>
        </div>
      </div>
    )
  }

  // Fallback - this shouldn't normally be reached
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">Loading dashboard...</p>
      </div>
    </div>
  )
}
