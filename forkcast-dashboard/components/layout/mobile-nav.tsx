// components/layout/mobile-nav.tsx

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut, Building2, Check, Grid3X3, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Role } from '@/lib/restaurant-auth'
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/components/layout/nav-config'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { getNavigationItems } from '@/lib/utils/tier'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

interface MobileNavProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  // No props needed as data is fetched from context
}

// Navigation items sourced from centralized config

export function MobileNav({}: MobileNavProps) {
  const { currentRestaurant, tier, hasFeature, restaurants, switchRestaurant, goToOverview } = useRestaurantContext()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [restaurantMenuOpen, setRestaurantMenuOpen] = useState(false)
  const [isRouteLoading, setIsRouteLoading] = useState(false)

  // Get navigation items based on tier and addons
  const navItems = getNavigationItems(
    tier,
    currentRestaurant?.restaurant?.addons || []
  )

  const handleSignOut = () => {
    // Full navigation to /logout so server middleware can revoke the
    // refresh token and emit Clear-Site-Data (pentest W11).
    window.location.href = '/logout'
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'owner': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'staff': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  useEffect(() => {
    setIsRouteLoading(false)
  }, [pathname])

  useEffect(() => {
    if (!isRouteLoading) return

    const timer = setTimeout(() => {
      setIsRouteLoading(false)
    }, 10000)

    return () => clearTimeout(timer)
  }, [isRouteLoading])

  const startRouteLoading = () => {
    setIsRouteLoading(true)
  }

  const filteredNavItems = NAV_ITEMS.filter(item => {
    // Check permission first
    if (item.permission && !restaurantAuth.hasPermission(currentRestaurant?.permissions || [], item.permission, (currentRestaurant?.role || 'viewer') as Role)) {
      return false
    }

    // Check tier feature
    if (item.tierFeature && !hasFeature(item.tierFeature)) {
      return false
    }


    return true
  }).map(item => {
    // Transform Sections href based on tier (only if no floor_plan addon)
    if (item.title === 'Sections' && tier === 'basic' && !hasFeature('floor_plan')) {
      return { ...item, href: '/sections' }
    }
    return item
  })

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter(item => {
    // Check permission first
    if (item.permission && !restaurantAuth.hasPermission(currentRestaurant?.permissions || [], item.permission, (currentRestaurant?.role || 'viewer') as Role)) {
      return false
    }
    
    // Check tier feature (skip if no tierFeature specified - like Help)
    if (item.tierFeature && !hasFeature(item.tierFeature)) {
      return false
    }
    
    return true
  })

  if (!currentRestaurant) return null

  return (
    <>
      {/* Mobile Header - Optimized for small tablets */}
      <header className="sticky top-0 z-50 w-full border-b bg-background">
        <div className="flex h-12 sm:h-14 md:h-16 items-center px-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="md:hidden h-6 w-6 sm:h-9 sm:w-9 touch-manipulation"
          >
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>

          <div className="ml-3 sm:ml-4">
            <h1 className="text-base sm:text-lg font-semibold truncate">{currentRestaurant.restaurant.name}</h1>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet - Optimized for tablets */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] sm:w-[280px] p-0">
          <SheetHeader className="p-3 sm:p-4 border-b">
            <SheetTitle className="text-left">
              <div>
                <div className="font-semibold text-sm sm:text-base">{currentRestaurant.restaurant.name}</div>
                <div className="text-xs sm:text-sm text-muted-foreground capitalize">{currentRestaurant.role}</div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)]">
            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto px-1.5 sm:px-2 py-3 sm:py-4">
              <div className="space-y-0.5 sm:space-y-1">
                {filteredNavItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        startRouteLoading()
                        setOpen(false)
                      }}
                      className={cn(
                        "flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Bottom Items */}
            <div className="border-t p-1.5 sm:p-2 pb-[env(safe-area-inset-bottom)] space-y-0.5 sm:space-y-1">
              {restaurants && restaurants.length > 1 && (
                <DropdownMenu open={restaurantMenuOpen} onOpenChange={setRestaurantMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2.5 sm:gap-3 py-2.5 sm:py-2 h-auto touch-manipulation"
                    >
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm">Switch Restaurant</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="start" sideOffset={8}>
                    <DropdownMenuItem
                      onClick={() => {
                        startRouteLoading()
                        goToOverview()
                        setOpen(false)
                      }}
                      className="p-3 cursor-pointer hover:bg-muted"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="h-6 w-6 rounded bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <Grid3X3 className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">Dashboard Overview</div>
                            <div className="text-xs text-muted-foreground">View all {restaurants.length} restaurants</div>
                          </div>
                        </div>
                        {!currentRestaurant && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {restaurants.map((restaurant) => (
                      <DropdownMenuItem
                        key={restaurant.restaurant.id}
                        onClick={() => {
                          startRouteLoading()
                          switchRestaurant(restaurant.restaurant.id)
                          setOpen(false)
                        }}
                        className="p-3 cursor-pointer hover:bg-muted"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            {restaurant.restaurant.main_image_url ? (
                              <Image
                                src={restaurant.restaurant.main_image_url}
                                alt={restaurant.restaurant.name}
                                width={32}
                                height={32}
                                className="h-6 w-6 rounded object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                                <ChefHat className="h-4 w-4 text-primary/60" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {restaurant.restaurant.name}
                              </div>
                            </div>
                            <Badge className={cn("text-xs ml-2", getRoleColor(restaurant.role))}>
                              {restaurant.role}
                            </Badge>
                          </div>
                          {currentRestaurant?.restaurant.id === restaurant.restaurant.id && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-2.5 sm:gap-3 py-2.5 sm:py-2 h-auto touch-manipulation"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm">Sign Out</span>
              </Button>

              {filteredBottomItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      startRouteLoading()
                      setOpen(false)
                    }}
                                          className={cn(
                      "flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation",
                        isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                      )}
                  >
                    <div className="relative">
                      <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      {(item as any).badge && (item as any).badge > 0 && (
                        <span className="absolute -right-1 -top-1 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-red-600 text-[8px] sm:text-[9px] font-medium text-white flex items-center justify-center">
                          {(item as any).badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {isRouteLoading && (
        <div className="fixed inset-0 z-[9999] bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-[#7A2E4A]/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#7A2E4A] animate-spin" />
          </div>
        </div>
      )}
    </>
  )
}
