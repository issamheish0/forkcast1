// components/layout/restaurant-selector.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useSidebar } from "@/lib/contexts/sidebar-context"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { 
  Building2, 
  ChevronDown, 
  Check, 
  MapPin, 
  ChefHat,
  Grid3X3,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function RestaurantSelector() {
  const { 
    restaurants, 
    currentRestaurant, 
    switchRestaurant, 
    goToOverview 
  } = useRestaurantContext()
  
  const [isOpen, setIsOpen] = useState(false)

  if (!restaurants || restaurants.length <= 1) {
    return null
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'owner': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'staff': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // This component is now only used for the dropdown menu content
  // The trigger button is moved to the sidebar
  return null
}

// Export a separate component for the dropdown menu that can be used in sidebar
export function RestaurantSwitcherDropdown() {
  const { 
    restaurants, 
    currentRestaurant, 
    switchRestaurant, 
    goToOverview 
  } = useRestaurantContext()
  const { isCollapsed } = useSidebar()
  
  const [isOpen, setIsOpen] = useState(false)

  if (!restaurants || restaurants.length <= 1) {
    return null
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'owner': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'staff': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground w-full",
          isCollapsed && "justify-center"
        )}>
          <Building2 className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
          {!isCollapsed && (
            <span className="text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap ml-3">
              Switch Restaurant
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 max-h-96 overflow-y-auto" 
        align="start"
        sideOffset={8}
      >
        {/* Overview Option */}
        <DropdownMenuItem 
          onClick={goToOverview}
          className="p-3 cursor-pointer hover:bg-muted"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Grid3X3 className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Dashboard Overview</div>
                <div className="text-xs text-muted-foreground text-sm">View all {restaurants.length} restaurants
                </div>
              </div>
            </div>
            {!currentRestaurant && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Restaurant List */}
        {restaurants.map((restaurant) => (
          <DropdownMenuItem 
            key={restaurant.restaurant.id}
            onClick={() => switchRestaurant(restaurant.restaurant.id)}
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
                  <div className="flex items-center gap-1 text-xs text-muted-foreground text-sm"><MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">
                      {restaurant.restaurant.cuisine_type}
                      {restaurant.restaurant.secondary_cuisines && restaurant.restaurant.secondary_cuisines.length > 0 && (
                        <span className="opacity-70"> +{restaurant.restaurant.secondary_cuisines.length}</span>
                      )}
                    </span>
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
  )
}
