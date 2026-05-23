// hooks/use-restaurant-sections.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"

// Helper to extract error message from various error types
function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.details) return error.details
  if (error?.hint) return error.hint
  return JSON.stringify(error) || 'Unknown error'
}

export interface RestaurantSection {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  color: string
  icon: string
  created_at: string
  updated_at: string
  decor_items?: any[]
  max_covers?: number | null
  min_party_size?: number | null
  max_party_size?: number | null
}

export interface CreateSectionData {
  name: string
  description?: string
  color?: string
  icon?: string
  is_active?: boolean
  min_party_size?: number | null
  max_party_size?: number | null
}

export interface UpdateSectionData {
  name?: string
  description?: string
  color?: string
  icon?: string
  is_active?: boolean
  display_order?: number
  min_party_size?: number | null
  max_party_size?: number | null
}

export function useRestaurantSections(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId
  })
}

export function useActiveSections(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["restaurant-sections-active", restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId
  })
}

export function useCreateSection(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateSectionData) => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      // Get current max order
      const { data: existingSections } = await supabase
        .from("restaurant_sections")
        .select("display_order")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: false })
        .limit(1)

      const maxOrder = existingSections?.[0]?.display_order || 0

      const { error } = await supabase
        .from("restaurant_sections")
        .insert({
          restaurant_id: restaurantId,
          name: data.name,
          description: data.description || null,
          color: data.color || "#3b82f6",
          icon: data.icon || "grid",
          is_active: data.is_active ?? true,
          display_order: maxOrder + 1,
          min_party_size: data.min_party_size ?? null,
          max_party_size: data.max_party_size ?? null,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Section created successfully")
    },
    onError: (error) => {
      const errorMsg = getErrorMessage(error)
      toast.error("Failed to create section")
      console.error("Error creating section:", errorMsg, error)
    }
  })
}

export function useUpdateSection(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: UpdateSectionData }) => {
      const { error } = await supabase
        .from("restaurant_sections")
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Section updated successfully")
    },
    onError: (error) => {
      const errorMsg = getErrorMessage(error)
      toast.error("Failed to update section")
      console.error("Error updating section:", errorMsg, error)
    }
  })
}

export function useDeleteSection(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Look up section name first — preferred_section stores the name, not the ID
      const { data: section, error: sectionLookupError } = await supabase
        .from("restaurant_sections")
        .select("name")
        .eq("id", id)
        .single()

      if (sectionLookupError) throw sectionLookupError

      // Check if section name is being used in any bookings (scoped to this restaurant)
      const { data: bookingsWithSection, error: bookingError } = await supabase
        .from("bookings")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("preferred_section", section.name)
        .limit(1)

      if (bookingError) throw bookingError

      if (bookingsWithSection && bookingsWithSection.length > 0) {
        throw new Error("Cannot delete section that is referenced in existing bookings")
      }

      const { error } = await supabase
        .from("restaurant_sections")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Section deleted successfully")
    },
    onError: (error) => {
      const errorMsg = getErrorMessage(error)
      if (errorMsg.includes("referenced in existing bookings")) {
        toast.error("Cannot delete section that has existing bookings. Deactivate it instead.")
      } else {
        toast.error("Failed to delete section")
      }
      console.error("Error deleting section:", errorMsg, error)
    }
  })
}

export function useReorderSections(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sections: { id: string, display_order: number }[]) => {
      const updates = sections.map(section => 
        supabase
          .from("restaurant_sections")
          .update({ 
            display_order: section.display_order,
            updated_at: new Date().toISOString()
          })
          .eq("id", section.id)
      )

      const results = await Promise.all(updates)
      
      for (const { error } of results) {
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
    },
    onError: (error) => {
      toast.error("Failed to reorder sections")
      console.error("Error reordering sections:", error)
    }
  })
}

// ============================================================================
// SECTION CLOSURES - Allows sections to be closed for specific date/time ranges
// ============================================================================

export interface SectionClosure {
  id: string
  section_id: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  reason: string
  created_at: string
  created_by: string
  updated_at: string
}

export interface CreateClosureData {
  section_id: string
  start_date: string
  end_date: string
  start_time?: string | null
  end_time?: string | null
  reason: string
}

export interface UpdateClosureData {
  start_date?: string
  end_date?: string
  start_time?: string | null
  end_time?: string | null
  reason?: string
}

/**
 * Hook to fetch sections filtered by closures for a specific date/time
 * Use this when showing available sections during booking
 */
export function useActiveSectionsWithClosures(
  restaurantId: string | undefined,
  bookingDate?: Date,
  bookingTime?: string
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["restaurant-sections-with-closures", restaurantId, bookingDate?.toISOString(), bookingTime],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      // Fetch active sections
      const { data: sections, error: sectionsError } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (sectionsError) throw sectionsError
      if (!sections || sections.length === 0) return []

      // If no booking date provided, return all active sections
      if (!bookingDate) return sections as RestaurantSection[]

      // Format date in YYYY-MM-DD format without timezone conversion
      const year = bookingDate.getFullYear()
      const month = String(bookingDate.getMonth() + 1).padStart(2, '0')
      const day = String(bookingDate.getDate()).padStart(2, '0')
      const bookingDateStr = `${year}-${month}-${day}`
      
      const { data: closures, error: closuresError } = await supabase
        .from("section_closures")
        .select("*")
        .in("section_id", sections.map(s => s.id))
        .lte("start_date", bookingDateStr)
        .gte("end_date", bookingDateStr)

      if (closuresError) throw closuresError

      // If no closures found, return all sections
      if (!closures || closures.length === 0) return sections as RestaurantSection[]

      // Filter out sections with active closures
      const filteredSections = sections.filter((section) => {
        const sectionClosures = closures.filter(
          (c) => c.section_id === section.id
        )

        // Check if any closure applies to this section
        return !sectionClosures.some((closure) => {
          // If no time range specified, closure applies all day
          if (!closure.start_time || !closure.end_time || !bookingTime) {
            return true // Section is closed all day
          }

          // Check if booking time falls within closure time range
          const bookingTimeFormatted = bookingTime.substring(0, 5) // HH:mm
          const startTimeFormatted = closure.start_time.substring(0, 5)
          const endTimeFormatted = closure.end_time.substring(0, 5)

          return (
            bookingTimeFormatted >= startTimeFormatted &&
            bookingTimeFormatted < endTimeFormatted
          )
        })
      })

      return filteredSections as RestaurantSection[]
    },
    enabled: !!restaurantId
  })
}

/**
 * Hook to fetch all closures for a restaurant's sections
 */
export function useSectionClosures(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["section-closures", restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      // First get all sections for this restaurant
      const { data: sections, error: sectionsError } = await supabase
        .from("restaurant_sections")
        .select("id")
        .eq("restaurant_id", restaurantId)

      if (sectionsError) throw sectionsError
      if (!sections || sections.length === 0) return []

      const sectionIds = sections.map(s => s.id)

      // Fetch all closures for these sections
      const { data, error } = await supabase
        .from("section_closures")
        .select(`
          *,
          section:restaurant_sections(id, name, color)
        `)
        .in("section_id", sectionIds)
        .order("start_date", { ascending: false })

      if (error) throw error
      return data as (SectionClosure & { section: { id: string, name: string, color: string } })[]
    },
    enabled: !!restaurantId
  })
}

/**
 * Hook to create a new section closure
 */
export function useCreateClosure(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateClosureData) => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      // Dates are already in YYYY-MM-DD format from form, no conversion needed
      const { error } = await supabase
        .from("section_closures")
        .insert({
          section_id: data.section_id,
          start_date: data.start_date,
          end_date: data.end_date,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          reason: data.reason,
          created_by: user.id
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-closures", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-with-closures", restaurantId] })
      toast.success("Section closure created successfully")
    },
    onError: (error) => {
      toast.error("Failed to create section closure")
      console.error("Error creating section closure:", error)
    }
  })
}

/**
 * Hook to update an existing section closure
 */
export function useUpdateClosure(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: UpdateClosureData }) => {
      const { error } = await supabase
        .from("section_closures")
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-closures", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-with-closures", restaurantId] })
      toast.success("Section closure updated successfully")
    },
    onError: (error) => {
      toast.error("Failed to update section closure")
      console.error("Error updating section closure:", error)
    }
  })
}

/**
 * Hook to delete a section closure
 */
export function useDeleteClosure(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("section_closures")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-closures", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-with-closures", restaurantId] })
      toast.success("Section closure deleted successfully")
    },
    onError: (error) => {
      toast.error("Failed to delete section closure")
      console.error("Error deleting section closure:", error)
    }
  })
}