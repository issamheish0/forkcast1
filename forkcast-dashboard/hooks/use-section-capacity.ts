// hooks/use-section-capacity.ts — React Query hooks for section capacity
"use client"

import { useQuery } from "@tanstack/react-query"
import { getSectionMaxCovers, getSectionCurrentCovers, type CapacityInfo } from "@/lib/section-capacity"
import type { RestaurantSection, RestaurantTable } from "@/types"

/**
 * Hook to get real-time capacity data for a single section
 */
export function useSectionCapacity(
  sectionId: string | undefined,
  restaurantId: string | undefined,
  date: Date,
  timeSlot?: string,
  sections?: RestaurantSection[],
  tables?: RestaurantTable[]
) {
  return useQuery({
    queryKey: ["section-capacity", restaurantId, sectionId, date.toISOString().split("T")[0], timeSlot],
    queryFn: async (): Promise<CapacityInfo | null> => {
      if (!sectionId || !restaurantId || !sections || !tables) return null

      const section = sections.find(s => s.id === sectionId)
      if (!section) return null

      const { maxCovers, isManualOverride } = getSectionMaxCovers(section, tables)
      const { seatedCovers, bookedCovers, totalCovers } = await getSectionCurrentCovers(sectionId, restaurantId, date, timeSlot)
      const percentage = maxCovers > 0 ? Math.round((totalCovers / maxCovers) * 100) : 0

      return { currentCovers: totalCovers, seatedCovers, bookedCovers, maxCovers, percentage, isManualOverride }
    },
    enabled: !!sectionId && !!restaurantId && !!sections && !!tables,
    refetchInterval: 30000,
  })
}

/**
 * Hook to get capacity across all sections for a restaurant.
 * Uses Promise.all for parallel section lookups.
 */
export function useRestaurantCapacity(
  restaurantId: string | undefined,
  date: Date,
  timeSlot?: string,
  sections?: RestaurantSection[],
  tables?: RestaurantTable[]
) {
  return useQuery({
    queryKey: ["restaurant-capacity", restaurantId, date.toISOString().split("T")[0], timeSlot],
    queryFn: async () => {
      if (!restaurantId || !sections || !tables) return null

      const activeSections = sections.filter(s => s.is_active)

      const results = await Promise.all(
        activeSections.map(async (section) => {
          const { maxCovers, isManualOverride } = getSectionMaxCovers(section, tables)
          const { seatedCovers, bookedCovers, totalCovers } = await getSectionCurrentCovers(section.id, restaurantId, date, timeSlot)
          const percentage = maxCovers > 0 ? Math.round((totalCovers / maxCovers) * 100) : 0
          return { sectionId: section.id, currentCovers: totalCovers, seatedCovers, bookedCovers, maxCovers, percentage, isManualOverride }
        })
      )

      let totalCurrentCovers = 0
      let totalMaxCovers = 0
      const sectionCapacities: Record<string, CapacityInfo> = {}

      for (const r of results) {
        sectionCapacities[r.sectionId] = {
          currentCovers: r.currentCovers,
          seatedCovers: r.seatedCovers,
          bookedCovers: r.bookedCovers,
          maxCovers: r.maxCovers,
          percentage: r.percentage,
          isManualOverride: r.isManualOverride,
        }
        totalCurrentCovers += r.currentCovers
        totalMaxCovers += r.maxCovers
      }

      return {
        totalCurrentCovers,
        totalMaxCovers,
        totalPercentage: totalMaxCovers > 0
          ? Math.round((totalCurrentCovers / totalMaxCovers) * 100)
          : 0,
        sectionCapacities,
      }
    },
    enabled: !!restaurantId && !!sections && !!tables,
    refetchInterval: 30000,
  })
}
