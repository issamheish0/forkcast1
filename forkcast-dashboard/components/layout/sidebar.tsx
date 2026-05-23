// components/layout/sidebar.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/lib/contexts/sidebar-context'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { ChevronLeft, ChevronRight, LogOut, Building2, Grid3X3, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Role } from '@/lib/restaurant-auth'
import { NAV_ITEMS, BOTTOM_NAV_ITEMS, type NavigationItem } from '@/components/layout/nav-config'
import { RestaurantSwitcherDropdown } from '@/components/layout/restaurant-selector'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAdminPermissions } from '@/hooks/use-admin-permissions'

interface SidebarProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  permissions: string[]
}

// Navigation items sourced from centralized config

export function Sidebar({ restaurant, role, permissions }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isCollapsed, setIsCollapsed, toggleSidebar } = useSidebar()
  const { currentRestaurant, hasFeature, tier, restaurants } = useRestaurantContext()
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { isSuperAdmin } = useAdminPermissions()

  // Persist scroll position across navigations
  useEffect(() => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
    if (scrollElement) {
      // Restore saved scroll position
      const savedScrollTop = sessionStorage.getItem('sidebar-scroll-position')
      if (savedScrollTop) {
        scrollElement.scrollTop = parseInt(savedScrollTop, 10)
      }

      // Save scroll position on scroll
      const handleScroll = () => {
        sessionStorage.setItem('sidebar-scroll-position', scrollElement.scrollTop.toString())
      }
      
      scrollElement.addEventListener('scroll', handleScroll, { passive: true })
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Keyboard navigation support
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCollapsed) {
        setIsCollapsed(true)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isCollapsed, setIsCollapsed])

  // Prevent body scroll when sidebar is expanded
  useEffect(() => {
    if (!isCollapsed) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isCollapsed])

  const handleSignOut = () => {
    // Full navigation to /logout so server middleware can revoke the
    // refresh token and emit Clear-Site-Data (pentest W11).
    setShowSignOutConfirm(false)
    window.location.href = '/logout'
  }

  const filterNavItem = (item: NavigationItem): boolean => {
    // Super Admin item: only show for super admins
    if (item.permission === 'super_admin') {
      return isSuperAdmin
    }

    // Check permission first
    if (item.permission && !restaurantAuth.hasPermission(permissions, item.permission, role)) {
      return false
    }

    // Check tier feature
    if (item.tierFeature && !hasFeature(item.tierFeature)) {
      return false
    }

    // Filter children if they exist
    if (item.children) {
      item.children = item.children.filter(filterNavItem)
      // If no valid children, hide the parent
      if (item.children.length === 0) {
        return false
      }
    }

    return true
  }

  const filteredNavItems = NAV_ITEMS.filter(filterNavItem).map(item => {
    // Transform Sections href based on tier (only if no floor_plan addon)
    if (item.title === 'Sections' && tier === 'basic' && !hasFeature('floor_plan')) {
      return { ...item, href: '/sections' }
    }
    return item
  })

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter(item => {
    // Check permission first
    if (item.permission && !restaurantAuth.hasPermission(permissions, item.permission, role)) {
      return false
    }
    
    // Check tier feature (skip if no tierFeature specified - like Help)
    if (item.tierFeature && !hasFeature(item.tierFeature)) {
      return false
    }
    
    return true
  })

  return (
    <>
      {/* Backdrop blur when expanded - covers everything */}
      {!isCollapsed && (
        <button
          type="button"
          className="fixed inset-0 bg-black/30 backdrop-blur-md z-[59] transition-all duration-200 ease-out border-none cursor-default"
          onClick={() => setIsCollapsed(true)}
          onTouchEnd={() => setIsCollapsed(true)}
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}
      
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar/98 backdrop-blur-xl border-r border-sidebar-border transition-all duration-200 ease-out group fixed inset-y-0 left-0 overflow-hidden",
          // Always fixed position to prevent layout jumps
          // Collapsed: narrow width, normal z-index
          // Expanded: wider width, higher z-index
          isCollapsed
            ? "w-16 z-30 shadow-sm" 
            : "w-72 z-[60] shadow-2xl"
        )}
        role="complementary"
        aria-label="Navigation sidebar"
      >
      {/* Header - Optimized for tablets */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-sidebar-border">
        <RestaurantHeader 
          restaurant={restaurant}
          role={role}
          isCollapsed={isCollapsed}
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            "h-8 w-8 md:h-9 md:w-9 shrink-0 transition-all duration-150 ease-out hover:bg-sidebar-accent/30",
            isCollapsed ? "" : "ml-auto"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3 md:h-4 md:w-4" /> : <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />}
        </Button>
      </div>

      {/* Navigation - Optimized for tablets with proper scrolling */}
      <div ref={scrollRef} className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-1.5 md:px-2 py-3 md:py-4">
          <nav className="space-y-0.5 md:space-y-1">
          {filteredNavItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0
            const isParentActive = hasChildren && item.children!.some(child => {
              const childPath = child.href
              return pathname === childPath || pathname.startsWith(`${childPath}/`)
            })
            let isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            
            // Special handling for Dashboard root links to prevent them from being active for all sub-routes (like /bookings/guarantees)
            if (item.href === '/bookings') {
              isActive = pathname === item.href
            }
            
            // For items with children, check if any child is active
            if (hasChildren) {
              isActive = isParentActive || false
            }
            
            return (
              <div key={item.href} className="space-y-0.5">
                {hasChildren ? (
                  <NavItemWithSubmenu 
                    item={item} 
                    isActive={isActive}
                    isCollapsed={isCollapsed}
                    pathname={pathname}
                    setIsCollapsed={setIsCollapsed}
                  />
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => {
                      // Auto-collapse sidebar on navigation for better UX on tablets
                      if (window.innerWidth < 768 && !isCollapsed) {
                        setIsCollapsed(true)
                      }
                    }}
                    className={cn(
                      "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      isCollapsed && "justify-center"
                    )}
                    title={isCollapsed ? item.title : undefined}
                    data-tooltip={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                    <span className={cn(
                      "text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap",
                      isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto ml-3"
                    )}>
                      {item.title}
                    </span>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

      </ScrollArea>
      </div>

      {/* Bottom Section - Optimized for tablets */}
      <div className="border-t border-sidebar-border p-1.5 md:p-2 space-y-0.5 md:space-y-1">
        {restaurants && restaurants.length > 1 && (
          <RestaurantSwitcherDropdown />
        )}

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className={cn(
            "flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
          <span className={cn(
            "text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap",
            isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto ml-3"
          )}>
            Sign Out
          </span>
        </button>

        {filteredBottomItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                // Auto-collapse sidebar on navigation for better UX on tablets
                if (window.innerWidth < 768 && !isCollapsed) {
                  setIsCollapsed(true)
                }
              }}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <div className="relative">
                <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                {(item as any).badge && (item as any).badge > 0 && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full bg-red-600 text-[8px] md:text-[9px] font-medium text-white flex items-center justify-center">
                    {(item as any).badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap",
                isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto ml-3"
              )}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
      
      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        onConfirm={handleSignOut}
      />
    </aside>
    </>
  )
}

// Restaurant Header Component
interface RestaurantHeaderProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  isCollapsed: boolean
}

// NavItemWithSubmenu Component
interface NavItemWithSubmenuProps {
  item: NavigationItem
  isActive: boolean
  isCollapsed: boolean
  pathname: string
  setIsCollapsed: (collapsed: boolean) => void
}

function NavItemWithSubmenu({ item, isActive, isCollapsed, pathname, setIsCollapsed }: NavItemWithSubmenuProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasActiveChild = item.children?.some(child => {
    const childPath = child.href
    return pathname === childPath || pathname.startsWith(`${childPath}/`)
  })

  // Auto-expand if a child is active
  useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true)
    }
  }, [hasActiveChild])

  if (isCollapsed) {
    // When collapsed, show dropdown menu
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation justify-center",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
            title={item.title}
          >
            <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          {item.children?.map((child) => {
            const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
            return (
              <DropdownMenuItem key={child.href} asChild>
                <Link
                  href={child.href}
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      setIsCollapsed(true)
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2",
                    isChildActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  <span>{child.title}</span>
                </Link>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
        <span className="text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap opacity-100 w-auto ml-3 flex-1 text-left">
          {item.title}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 ml-auto" />
        )}
      </button>
      {isExpanded && item.children && (
        <div className="ml-4 space-y-0.5 pl-4 border-l border-sidebar-border">
          {item.children.map((child) => {
            const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsCollapsed(true)
                  }
                }}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation",
                  isChildActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <child.icon className="h-4 w-4 shrink-0" />
                <span className="text-xs md:text-sm ml-3">
                  {child.title}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RestaurantHeader({ restaurant, role, isCollapsed }: RestaurantHeaderProps) {


  // For now, just return the basic header without multi-restaurant features
  // This will be enhanced when the context is properly integrated
  return (
    <div className="transition-all duration-200 ease-out overflow-hidden w-auto opacity-100">
      <h2 className="text-base md:text-lg font-semibold truncate whitespace-nowrap">{restaurant.name}</h2>
      <p className="text-xs md:text-sm text-sidebar-foreground/60 capitalize whitespace-nowrap">{role}</p>
    </div>
  )
}
