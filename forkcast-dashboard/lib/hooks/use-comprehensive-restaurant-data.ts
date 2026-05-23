// lib/hooks/use-comprehensive-restaurant-data.ts
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { format, startOfDay, endOfDay, addHours } from "date-fns"

export interface ComprehensiveRestaurantData {
  restaurant: {
    id: string
    name: string
    address: string
    main_image_url: string | null
    cuisine_type: string
    secondary_cuisines?: string[] | null
    status: string
    phone_number: string | null
  }
  staff: {
    id: string
    role: string
    permissions: string[]
  }
  todayStats: {
    totalBookings: number
    confirmedBookings: number
    completedBookings: number
    currentlyDining: number
    totalGuests: number
    pendingRequests: number
    waitlistActive: number
    revenue: number
    occupancyRate: number
  }
  tables: {
    total: number
    occupied: number
    available: number
    reserved: number
    outOfService: number
    tableBreakdown: Array<{
      id: string
      table_number: number
      max_capacity: number
      status: 'available' | 'occupied' | 'reserved' | 'out_of_service'
      current_booking?: any
    }>
  }
  upcomingBookings: Array<{
    id: string
    booking_time: string
    party_size: number
    guest_name: string
    status: string
    table_numbers: string[]
    is_vip: boolean
    special_requests?: string
    time_until: number // minutes until booking
  }>
  criticalAlerts: Array<{
    type: 'overdue' | 'no_show' | 'capacity_warning' | 'staff_needed'
    message: string
    severity: 'low' | 'medium' | 'high'
    booking_id?: string
    count?: number
  }>
  recentActivity: Array<{
    id: string
    type: 'booking_created' | 'check_in' | 'completed' | 'cancelled'
    message: string
    time: string
    guest_name?: string
  }>
}

export function useComprehensiveRestaurantData(restaurantIds: string[]) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ["comprehensive-restaurant-data", restaurantIds],
    queryFn: async (): Promise<ComprehensiveRestaurantData[]> => {
      if (restaurantIds.length === 0) return []

      const today = new Date()
      const todayStart = startOfDay(today)
      const todayEnd = endOfDay(today)
      const next4Hours = addHours(today, 4)

      // Get all restaurant staff info
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

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
        .in("restaurant_id", restaurantIds)
        .eq("is_active", true)

      if (!staffData) return []

      // Get comprehensive data for each restaurant
      const restaurantData = await Promise.all(
        staffData.map(async (staff) => {
          const restaurantId = staff.restaurant_id
          
          // Get today's bookings
          const { data: bookings } = await supabase
            .from("bookings")
            .select(`
              *,
              profiles!bookings_user_id_fkey(full_name, phone_number),
              booking_tables(
                table:restaurant_tables(id, table_number, max_capacity, section_id)
              ),
              restaurant_customers!bookings_user_id_fkey(vip_status)
            `)
            .eq("restaurant_id", restaurantId)
            .gte("booking_time", todayStart.toISOString())
            .lte("booking_time", todayEnd.toISOString())
            .order("booking_time", { ascending: true })

          // Get tables info
          const { data: tables } = await supabase
            .from("restaurant_tables")
            .select("*")
            .eq("restaurant_id", restaurantId)
            .eq("is_active", true)

          // Get waitlist count
          const { count: waitlistCount } = await supabase
            .from("waitlist")
            .select("*", { count: "exact" })
            .eq("restaurant_id", restaurantId)
            .eq("status", "active")
            .eq("desired_date", format(today, "yyyy-MM-dd"))

          // Process bookings data
          const todayBookings = bookings || []
          const currentlyDining = todayBookings.filter(b => 
            ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
          )
          
          // Calculate table statuses
          const totalTables = tables?.length || 0
          const occupiedTables = currentlyDining.reduce((count, booking) => 
            count + (booking.booking_tables?.length || 0), 0
          )
          const reservedTables = todayBookings.filter(b => 
            b.status === 'confirmed' && new Date(b.booking_time) > today
          ).reduce((count, booking) => count + (booking.booking_tables?.length || 0), 0)
          
          // Get upcoming bookings (next 4 hours)
          const upcomingBookings = todayBookings
            .filter(b => {
              const bookingTime = new Date(b.booking_time)
              return b.status === 'confirmed' && bookingTime >= today && bookingTime <= next4Hours
            })
            .slice(0, 5) // Limit to 5 upcoming bookings
            .map(booking => ({
              id: booking.id,
              booking_time: booking.booking_time,
              party_size: booking.party_size,
              guest_name: booking.profiles?.full_name || booking.guest_name || 'Walk-in',
              status: booking.status,
              table_numbers: booking.booking_tables?.map((bt: any) => bt.table.table_number.toString()) || [],
              is_vip: booking.restaurant_customers?.vip_status || false,
              special_requests: booking.special_requests,
              time_until: Math.round((new Date(booking.booking_time).getTime() - today.getTime()) / (1000 * 60))
            }))

          // Generate critical alerts
          const criticalAlerts = []
          
          // Overdue arrivals
          const overdueArrivals = todayBookings.filter(b => {
            const bookingTime = new Date(b.booking_time)
            const minutesLate = Math.round((today.getTime() - bookingTime.getTime()) / (1000 * 60))
            return b.status === 'confirmed' && minutesLate > 15
          })
          
          if (overdueArrivals.length > 0) {
            criticalAlerts.push({
              type: 'overdue' as const,
              message: `${overdueArrivals.length} guest${overdueArrivals.length > 1 ? 's' : ''} overdue for arrival`,
              severity: overdueArrivals.length > 3 ? 'high' as const : 'medium' as const,
              count: overdueArrivals.length
            })
          }

          // Capacity warnings
          const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0
          if (occupancyRate > 90) {
            criticalAlerts.push({
              type: 'capacity_warning' as const,
              message: `Restaurant at ${occupancyRate}% capacity`,
              severity: 'high' as const
            })
          }

          // Pending requests
          const pendingRequests = todayBookings.filter(b => b.status === 'pending').length
          if (pendingRequests > 0) {
            criticalAlerts.push({
              type: 'staff_needed' as const,
              message: `${pendingRequests} booking request${pendingRequests > 1 ? 's' : ''} need attention`,
              severity: pendingRequests > 5 ? 'high' as const : 'medium' as const,
              count: pendingRequests
            })
          }

          // Recent activity (last 2 hours)
          const recentCutoff = new Date(today.getTime() - (2 * 60 * 60 * 1000))
          const recentActivity = todayBookings
            .filter(b => new Date(b.updated_at || b.created_at) >= recentCutoff)
            .slice(0, 3)
            .map(booking => ({
              id: booking.id,
              type: booking.status === 'completed' ? 'completed' as const :
                    booking.status === 'arrived' || booking.status === 'seated' ? 'check_in' as const :
                    booking.status === 'cancelled_by_user' || booking.status === 'cancelled_by_restaurant' ? 'cancelled' as const :
                    'booking_created' as const,
              message: `${booking.profiles?.full_name || booking.guest_name} - Party of ${booking.party_size}`,
              time: booking.updated_at || booking.created_at,
              guest_name: booking.profiles?.full_name || booking.guest_name
            }))

          // Table breakdown with current status
          const tableBreakdown = (tables || []).map(table => {
            const currentBooking = currentlyDining.find(booking => 
              booking.booking_tables?.some((bt: any) => bt.table.id === table.id)
            )
            
            let status: 'available' | 'occupied' | 'reserved' | 'out_of_service' = 'available'
            
            if (!table.is_active) {
              status = 'out_of_service'
            } else if (currentBooking) {
              status = 'occupied'
            } else {
              const hasReservation = todayBookings.some(booking => 
                booking.status === 'confirmed' && 
                new Date(booking.booking_time) > today &&
                booking.booking_tables?.some((bt: any) => bt.table.id === table.id)
              )
              if (hasReservation) status = 'reserved'
            }
            
            return {
              id: table.id,
              table_number: table.table_number,
              max_capacity: table.max_capacity,
              status,
              current_booking: currentBooking ? {
                guest_name: currentBooking.profiles?.full_name || currentBooking.guest_name,
                party_size: currentBooking.party_size,
                start_time: currentBooking.booking_time,
                status: currentBooking.status
              } : undefined
            }
          })

          return {
            restaurant: staff.restaurant as any,
            staff: {
              id: staff.id,
              role: staff.role,
              permissions: staff.permissions
            },
            todayStats: {
              totalBookings: todayBookings.length,
              confirmedBookings: todayBookings.filter(b => b.status === 'confirmed').length,
              completedBookings: todayBookings.filter(b => b.status === 'completed').length,
              currentlyDining: currentlyDining.length,
              totalGuests: currentlyDining.reduce((sum, b) => sum + b.party_size, 0),
              pendingRequests,
              waitlistActive: waitlistCount || 0,
              revenue: todayBookings.filter(b => b.status === 'completed').length * 85, // Rough estimate
              occupancyRate
            },
            tables: {
              total: totalTables,
              occupied: occupiedTables,
              available: totalTables - occupiedTables - reservedTables,
              reserved: reservedTables,
              outOfService: (tables || []).filter(t => !t.is_active).length,
              tableBreakdown
            },
            upcomingBookings,
            criticalAlerts,
            recentActivity
          } as ComprehensiveRestaurantData
        })
      )

      return restaurantData
    },
    enabled: restaurantIds.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}