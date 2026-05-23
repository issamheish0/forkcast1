// lib/contexts/restaurant-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUserRestaurants, type RestaurantStaffInfo } from "@/lib/hooks/use-restaurants"
import { hasFeature, type RestaurantTier } from "@/lib/utils/tier"
import { persistRestaurantSelection, clearRestaurantSelection } from "@/lib/utils/restaurant-selection"

interface RestaurantContextType {
  restaurants: RestaurantStaffInfo[]
  currentRestaurant: RestaurantStaffInfo | null
  isLoading: boolean
  isMultiRestaurant: boolean
  tier: RestaurantTier | null
  hasFeature: (feature: string) => boolean
  switchRestaurant: (restaurantId: string) => void
  goToOverview: () => void
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined)

interface RestaurantProviderProps {
  children: ReactNode
  forcedRestaurantId?: string // For single restaurant mode
}

export function RestaurantProvider({ children, forcedRestaurantId }: RestaurantProviderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: restaurants = [], isLoading } = useUserRestaurants()
  const [currentRestaurant, setCurrentRestaurant] = useState<RestaurantStaffInfo | null>(null)
  
  const isMultiRestaurant = restaurants.length > 1
  
  // All restaurants are treated as pro — tier restrictions are removed
  const tier: RestaurantTier = 'pro'
  
  // Feature checker — all features enabled
  const checkFeature = useCallback((_feature: string) => true, [])
  
  useEffect(() => {
    if (isLoading || restaurants.length === 0) return

    // If we have a forced restaurant ID (single restaurant mode), use it
    if (forcedRestaurantId) {
      const restaurant = restaurants.find(r => r.restaurant.id === forcedRestaurantId)
      if (restaurant) {
        setCurrentRestaurant(restaurant)
      }
      return
    }

    // Check for restaurant ID in URL params first
    const urlRestaurantId = searchParams.get('restaurant')
    if (urlRestaurantId) {
      const restaurant = restaurants.find(r => r.restaurant.id === urlRestaurantId)
      if (restaurant) {
        setCurrentRestaurant(restaurant)
        persistRestaurantSelection(urlRestaurantId, 'pro')
        return
      }
    }

    // Check localStorage for last selected restaurant (only on client side)
    if (typeof window !== 'undefined') {
      const savedRestaurantId = localStorage.getItem('selected-restaurant-id')
      if (savedRestaurantId) {
        const restaurant = restaurants.find(r => r.restaurant.id === savedRestaurantId)
        if (restaurant) {
          setCurrentRestaurant(restaurant)
          persistRestaurantSelection(savedRestaurantId, 'pro')
          return
        }
      }
    }

    // Auto-select if only one restaurant
    if (restaurants.length === 1) {
      setCurrentRestaurant(restaurants[0])
      persistRestaurantSelection(restaurants[0].restaurant.id, 'pro')
      return
    }

    // Multiple restaurants and no selection — default to first
    if (typeof window !== 'undefined' && restaurants.length > 1) {
      const preferred = restaurants[0]
      setCurrentRestaurant(preferred)
      persistRestaurantSelection(preferred.restaurant.id, 'pro')
    }
  }, [restaurants, isLoading, searchParams, forcedRestaurantId])

  const switchRestaurant = (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.restaurant.id === restaurantId)
    if (!restaurant) return

    setCurrentRestaurant(restaurant)
    persistRestaurantSelection(restaurantId, 'pro')
    
    if (typeof window !== 'undefined') {
      // Stay on current path — just update the restaurant param
      const currentPath = window.location.pathname
      const targetUrl = new URL(currentPath, window.location.origin)
      targetUrl.searchParams.set('restaurant', restaurantId)
      router.replace(targetUrl.pathname + targetUrl.search)
    }
  }

  const goToOverview = () => {
    setCurrentRestaurant(null)
    clearRestaurantSelection()
    router.replace('/bookings')
  }

  return (
    <RestaurantContext.Provider
      value={{
        restaurants,
        currentRestaurant,
        isLoading,
        isMultiRestaurant,
        tier,
        hasFeature: checkFeature,
        switchRestaurant,
        goToOverview,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  )
}

export function useRestaurantContext() {
  const context = useContext(RestaurantContext)
  if (context === undefined) {
    throw new Error('useRestaurantContext must be used within a RestaurantProvider')
  }
  return context
}