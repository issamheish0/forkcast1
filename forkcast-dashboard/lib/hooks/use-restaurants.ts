// lib/hooks/use-restaurants.ts
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface RestaurantStaffInfo {
  id: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  permissions: string[]
  is_active: boolean
  restaurant: {
    id: string
    name: string
    address: string
    main_image_url: string | null
    cuisine_type: string
    secondary_cuisines?: string[] | null
    status: 'active' | 'inactive' | 'suspended'
    phone_number: string | null
    tier: 'basic' | 'pro'
    addons: string[]
    created_at: string
    table_turnover_minutes?: number
  }
}

export function useUserRestaurants() {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ["user-restaurants"],
    queryFn: async (): Promise<RestaurantStaffInfo[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("restaurant_staff")
        .select(`
          id,
          role,
          permissions,
          is_active,
          restaurant:restaurants(
            id,
            name,
            address,
            main_image_url,
            cuisine_type,
            secondary_cuisines,
            status,
            phone_number,
            tier,
            addons,
            created_at,
            table_turnover_minutes
          )
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error fetching user restaurants:", error)
        throw error
      }

      return (data || []) as unknown as RestaurantStaffInfo[]
    },
  })
}

export function useRestaurantStats(restaurantId: string, enabled = true) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ["restaurant-stats", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null

      const today = new Date().toISOString().split('T')[0]
      
      // Get today's bookings stats
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, status, party_size, booking_time, created_at")
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", `${today}T00:00:00`)
        .lte("booking_time", `${today}T23:59:59`)

      if (bookingsError) throw bookingsError

      // Get table count
      const { count: tableCount, error: tableError } = await supabase
        .from("restaurant_tables")
        .select("*", { count: "exact" })
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (tableError) throw tableError

      // Get waitlist count
      const { count: waitlistCount, error: waitlistError } = await supabase
        .from("waitlist")
        .select("*", { count: "exact" })
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .eq("desired_date", today)

      if (waitlistError) throw waitlistError

      const bookings = bookingsData || []
      
      // Calculate stats
      const todayBookings = bookings.length
      const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length
      const completedBookings = bookings.filter(b => b.status === 'completed').length
      const currentlyDining = bookings.filter(b => 
        ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
      ).length
      const totalGuests = bookings.filter(b => 
        ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
      ).reduce((sum, b) => sum + b.party_size, 0)
      
      const pendingRequests = bookings.filter(b => b.status === 'pending').length
      const revenue = completedBookings * 85 // Rough estimate
      
      return {
        todayBookings,
        confirmedBookings,
        completedBookings,
        currentlyDining,
        totalGuests,
        pendingRequests,
        tableCount: tableCount || 0,
        waitlistCount: waitlistCount || 0,
        revenue,
        occupancyRate: tableCount ? Math.round((currentlyDining / tableCount) * 100) : 0
      }
    },
    enabled: enabled && !!restaurantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}