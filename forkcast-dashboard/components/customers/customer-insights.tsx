// components/customers/customer-insights.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  AlertCircle,
  Star,
  Cake,
  Gift,
  Phone,
  Mail,
  Trophy,
  DollarSign,
  Heart,
  RefreshCw,
  Crown,
  PartyPopper,
  Target,
  Sparkles,
  Timer,
  Sun,
  Sunset,
  Moon,
  Info,
  CalendarDays,
  UsersRound,
  Utensils,
  Activity,
  BarChart3,
  Leaf,
  AlertTriangle,
  Hourglass,
  ChevronUp,
  ChevronDown,
  HeartHandshake,
  Medal,
  CalendarHeart,
  Glasses
} from 'lucide-react'
import { format, differenceInDays, addYears, isBefore, isAfter, startOfDay, getHours, parseISO, getDay, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CustomerInsightsProps {
  restaurantId: string
}

// Helper: pick the first non-empty, non-UUID candidate as a display name
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function resolveName(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (c && c.trim() && !UUID_RE.test(c.trim())) return c.trim()
  }
  return 'Guest'
}

interface InsightData {
  customerSegments: {
    vip: number
    regular: number
    atRisk: number
    new: number
    lost: number
  }
  trends: {
    newCustomersThisMonth: number
    newCustomersLastMonth: number
    returningRate: number
    averageVisitsPerCustomer: number
  }
  topMetrics: {
    mostFrequentCustomers: Array<{
      id: string
      name: string
      visits: number
      lastVisit: string
      email?: string
      phone?: string
      avatarUrl?: string
    }>
    upcomingBirthdays: Array<{
      id: string
      name: string
      birthday: string
      daysUntil: number
      age: number
      email?: string
      phone?: string
      avatarUrl?: string
      isVip: boolean
    }>
  }
  riskMetrics: {
    highCancellationCustomers: number
    highNoShowCustomers: number
    blacklistedCustomers: number
  }
  // NEW: Enhanced personalization metrics
  firstVisitAnniversaries: Array<{
    id: string
    name: string
    firstVisit: string
    yearsWithUs: number
    daysUntil: number
    totalSpent: number
    totalVisits: number
    isVip: boolean
    email?: string
    phone?: string
    avatarUrl?: string
  }>
  topSpenders: Array<{
    id: string
    name: string
    totalSpent: number
    averageSpendPerVisit: number
    visits: number
    lastVisit?: string
    isVip: boolean
    email?: string
    phone?: string
    avatarUrl?: string
  }>
  vipCandidates: Array<{
    id: string
    name: string
    visits: number
    totalSpent: number
    lastVisit?: string
    reasons: string[]
    email?: string
    phone?: string
    avatarUrl?: string
  }>
  visitMilestones: Array<{
    id: string
    name: string
    visits: number
    nextMilestone: number
    visitsToMilestone: number
    isVip: boolean
    email?: string
    phone?: string
    avatarUrl?: string
  }>
  winBackOpportunities: Array<{
    id: string
    name: string
    daysSinceLastVisit: number
    previousVisitCount: number
    totalSpent: number
    lastVisit?: string
    email?: string
    phone?: string
    avatarUrl?: string
  }>
  bookingTimeDistribution: {
    morning: number    // before 12pm
    lunch: number      // 12pm - 3pm
    afternoon: number  // 3pm - 5pm
    dinner: number     // 5pm - 9pm
    lateNight: number  // after 9pm
  }
  loyaltyStats: {
    averageCustomerLifetimeValue: number
    totalActiveCustomers: number
    customersWithMultipleVisits: number
    averageTimeBetweenVisits: number // in days
  }
  // NEW: Additional analytics metrics
  partySizeAnalytics: {
    averagePartySize: number
    distribution: {
      solo: number       // 1 person
      couple: number     // 2 people
      small: number      // 3-4 people
      medium: number     // 5-6 people
      large: number      // 7+ people
    }
    largePartyCustomers: Array<{
      id: string
      name: string
      averagePartySize: number
      bookings: number
      email?: string
      phone?: string
    }>
  }
  dayOfWeekPatterns: {
    distribution: {
      monday: number
      tuesday: number
      wednesday: number
      thursday: number
      friday: number
      saturday: number
      sunday: number
    }
    busiestDay: string
    slowestDay: string
  }
  bookingLeadTime: {
    averageDays: number
    distribution: {
      sameDay: number      // 0 days
      nextDay: number      // 1 day
      thisWeek: number     // 2-7 days
      nextWeek: number     // 8-14 days
      further: number      // 15+ days
    }
    lastMinuteBookers: Array<{
      id: string
      name: string
      sameDayBookings: number
      totalBookings: number
      email?: string
      phone?: string
    }>
  }
  customerPreferences: {
    dietaryBreakdown: {
      vegetarian: number
      vegan: number
      glutenFree: number
      dairyFree: number
      halal: number
      none: number
    }
    topAllergies: Array<{
      allergy: string
      count: number
    }>
    customersWithSpecialNeeds: number
  }
  monthlyGrowth: Array<{
    month: string
    newCustomers: number
    returningCustomers: number
    totalBookings: number
  }>
  visitFrequency: {
    weekly: number         // visits every week
    biweekly: number       // every 2 weeks
    monthly: number        // once a month
    quarterly: number      // every 3 months
    occasional: number     // less frequent
  }
  recentActivity: {
    last7DaysBookings: number
    last7DaysNewCustomers: number
    last7DaysReturning: number
    todayBookings: number
    comparedToLastWeek: number // percentage change
  }
  noShowRiskCustomers: Array<{
    id: string
    name: string
    noShowRate: number
    totalBookings: number
    lastNoShow?: string
    email?: string
    phone?: string
  }>
  // NEW: Special Occasions from upcoming bookings
  specialOccasions: Array<{
    id: string
    bookingId: string
    customerName: string
    occasion: string
    bookingDate: string
    daysUntil: number
    partySize: number
    email?: string
    phone?: string
    isVip: boolean
  }>
  // NEW: Loyalty tier breakdown
  loyaltyTierBreakdown: {
    bronze: number
    silver: number
    gold: number
    platinum: number
    nearUpgrade: Array<{
      id: string
      name: string
      currentTier: string
      currentPoints: number
      pointsToNextTier: number
      nextTier: string
      email?: string
      phone?: string
    }>
  }
  // NEW: Customer relationship insights
  relationshipInsights: {
    totalWithRelationships: number
    couplesCount: number
    familiesCount: number
    frequentGroups: Array<{
      customerName: string
      relatedTo: string
      relationshipType: string
      bookingsTogether: number
    }>
  }
}

export function CustomerInsights({ restaurantId }: CustomerInsightsProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState('')
  const [insights, setInsights] = useState<InsightData | null>(null)

  useEffect(() => {
    loadInsights()
  }, [restaurantId])

  const loadInsights = async () => {
    try {
      setLoading(true)
      setLoadingProgress('Loading customers...')

      // Load customers in batches for better performance
      const BATCH_SIZE = 1000
      let allCustomers: any[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data: customersData, error: customersError } = await supabase
          .from('restaurant_customers')
          .select(`
            *,
            profile:profiles!restaurant_customers_user_id_fkey(
              id,
              full_name,
              email,
              phone_number,
              avatar_url,
              allergies,
              dietary_restrictions,
              favorite_cuisines,
              preferred_party_size,
              notification_preferences,
              loyalty_points,
              membership_tier,
              privacy_settings,
              user_rating,
              total_bookings,
              completed_bookings,
              cancelled_bookings,
              no_show_bookings,
              rating_last_updated,
              created_at,
              updated_at
            )
          `)
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1)

        if (customersError) throw customersError

        if (!customersData || customersData.length === 0) {
          hasMore = false
        } else {
          allCustomers = [...allCustomers, ...customersData]
          offset += BATCH_SIZE
          
          if (allCustomers.length > 1000) {
            setLoadingProgress(`Loaded ${allCustomers.length} customers...`)
          }
          
          // If we got less than a full batch, we're done
          if (customersData.length < BATCH_SIZE) {
            hasMore = false
          }
        }
      }

      setLoadingProgress('Filtering admin and staff accounts...')

      // Filter out admin and restaurant staff accounts
      let filteredCustomersData = allCustomers
      
      if (filteredCustomersData.length > 0) {
        // Get all user IDs that have profiles (registered users)
        const customerUserIds = filteredCustomersData
          .map(c => c.user_id)
          .filter(id => id !== null)
        
        if (customerUserIds.length > 0) {
          // Check for admin accounts
          const { data: adminData } = await supabase
            .from('rbs_admins')
            .select('user_id')
            .in('user_id', customerUserIds)
          
          const adminUserIds = new Set(adminData?.map(admin => admin.user_id) || [])
          
          // Check for restaurant staff accounts
          const { data: staffData } = await supabase
            .from('restaurant_staff')
            .select('user_id')
            .in('user_id', customerUserIds)
            .eq('is_active', true)
          
          const staffUserIds = new Set(staffData?.map(staff => staff.user_id) || [])
          
          // Filter out customers who are admins or staff
          filteredCustomersData = filteredCustomersData.filter(customer => {
            // Keep guest customers (no user_id)
            if (!customer.user_id) return true
            
            // Exclude admin and staff accounts
            return !adminUserIds.has(customer.user_id) && !staffUserIds.has(customer.user_id)
          })
        }
      }

      setLoadingProgress('Calculating analytics...')

      const customers = filteredCustomersData

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

      // Calculate segments
      const segments = {
        vip: customers?.filter(c => c.vip_status).length || 0,
        regular: 0,
        atRisk: 0,
        new: 0,
        lost: 0
      }

      // Calculate trends and categorize customers
      let totalVisits = 0
      let returningCustomers = 0
      const frequentCustomers: any[] = []
      let highCancellation = 0
      let highNoShow = 0

      customers?.forEach(customer => {
        const lastVisitDate = customer.last_visit ? new Date(customer.last_visit) : null
        const firstVisitDate = customer.first_visit ? new Date(customer.first_visit) : null

        // Categorize by visit patterns
        if (customer.total_bookings >= 5 && lastVisitDate && lastVisitDate > thirtyDaysAgo) {
          segments.regular++
        } else if (lastVisitDate && lastVisitDate < ninetyDaysAgo && customer.total_bookings > 0) {
          segments.lost++
        } else if (lastVisitDate && lastVisitDate < thirtyDaysAgo && lastVisitDate >= ninetyDaysAgo && customer.total_bookings > 0) {
          segments.atRisk++
        } else if (firstVisitDate && firstVisitDate > thirtyDaysAgo) {
          segments.new++
        }

        // Calculate metrics
        totalVisits += customer.total_bookings
        if (customer.total_bookings > 1) returningCustomers++

        // High cancellation/no-show - use profile data if available
        if (customer.total_bookings > 0) {
          const cancelledBookings = customer.profile?.cancelled_bookings || 0
          const noShowBookings = customer.profile?.no_show_bookings || 0
          
          const cancellationRate = cancelledBookings / customer.total_bookings
          const noShowRate = noShowBookings / customer.total_bookings
          
          if (cancellationRate > 0.3) highCancellation++
          if (noShowRate > 0.2) highNoShow++
        }

        // Track top customers
        if (customer.total_bookings > 0) {
          frequentCustomers.push({
            id: customer.id,
            name: customer.profile?.full_name || customer.guest_name || 'Guest',
            visits: customer.total_bookings,
            lastVisit: customer.last_visit,
            email: customer.profile?.email || customer.guest_email || undefined,
            phone: customer.profile?.phone_number || customer.guest_phone || undefined,
            avatarUrl: customer.profile?.avatar_url || undefined
          })
        }
      })

      // Calculate upcoming birthdays
      const today = startOfDay(new Date())
      const upcomingBirthdays: any[] = []
      
      customers?.forEach(customer => {
        const dob = customer.profile?.date_of_birth
        if (dob) {
          const birthDate = new Date(dob)
          // Get this year's birthday
          let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
          
          // If birthday has passed this year, use next year's
          if (isBefore(nextBirthday, today)) {
            nextBirthday = addYears(nextBirthday, 1)
          }
          
          const daysUntil = differenceInDays(nextBirthday, today)
          
          // Show birthdays in the next 30 days
          if (daysUntil <= 30 && daysUntil >= 0) {
            const age = today.getFullYear() - birthDate.getFullYear() + (daysUntil === 0 ? 0 : -1) + 1
            upcomingBirthdays.push({
              id: customer.id,
              name: customer.profile?.full_name || customer.guest_name || 'Guest',
              birthday: dob,
              daysUntil,
              age,
              email: customer.profile?.email || customer.guest_email || undefined,
              phone: customer.profile?.phone_number || customer.guest_phone || undefined,
              avatarUrl: customer.profile?.avatar_url || undefined,
              isVip: customer.vip_status
            })
          }
        }
      })

      // Sort by days until birthday
      upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil)

      // Count new customers this month and last month
      const newThisMonth = customers?.filter(c => {
        const firstVisit = c.first_visit ? new Date(c.first_visit) : null
        return firstVisit && firstVisit > thirtyDaysAgo
      }).length || 0

      const newLastMonth = customers?.filter(c => {
        const firstVisit = c.first_visit ? new Date(c.first_visit) : null
        return firstVisit && firstVisit > sixtyDaysAgo && firstVisit <= thirtyDaysAgo
      }).length || 0

      // ==========================================
      // NEW: Enhanced Personalization Metrics
      // ==========================================

      // 1. First Visit Anniversaries - Customers celebrating loyalty milestones
      const firstVisitAnniversaries: InsightData['firstVisitAnniversaries'] = []
      customers?.forEach(customer => {
        if (customer.first_visit) {
          try {
            const firstVisitDate = new Date(customer.first_visit)
            const yearsWithUs = today.getFullYear() - firstVisitDate.getFullYear()
            
            // Get this year's anniversary
            let nextAnniversary = new Date(today.getFullYear(), firstVisitDate.getMonth(), firstVisitDate.getDate())
            
            // If anniversary has passed this year, calculate for next year
            if (isBefore(nextAnniversary, today)) {
              nextAnniversary = addYears(nextAnniversary, 1)
            }
            
            const daysUntil = differenceInDays(nextAnniversary, today)
            
            // Show anniversaries in the next 30 days (and must be at least 1 year)
            const anniversaryYears = nextAnniversary.getFullYear() - firstVisitDate.getFullYear()
            if (daysUntil <= 30 && daysUntil >= 0 && anniversaryYears >= 1) {
              firstVisitAnniversaries.push({
                id: customer.id,
                name: customer.profile?.full_name || customer.guest_name || 'Guest',
                firstVisit: customer.first_visit,
                yearsWithUs: anniversaryYears,
                daysUntil,
                totalSpent: customer.total_spent || 0,
                totalVisits: customer.total_bookings || 0,
                isVip: customer.vip_status || false,
                email: customer.profile?.email || customer.guest_email || undefined,
                phone: customer.profile?.phone_number || customer.guest_phone || undefined,
                avatarUrl: customer.profile?.avatar_url || undefined
              })
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      })
      firstVisitAnniversaries.sort((a, b) => a.daysUntil - b.daysUntil)

      // 2. Top Spenders - Highest value customers
      const topSpenders: InsightData['topSpenders'] = customers
        ?.filter(c => (c.total_spent || 0) > 0)
        .map(customer => ({
          id: customer.id,
          name: customer.profile?.full_name || customer.guest_name || 'Guest',
          totalSpent: customer.total_spent || 0,
          averageSpendPerVisit: customer.average_spend_per_visit || 0,
          visits: customer.total_bookings || 0,
          lastVisit: customer.last_visit || undefined,
          isVip: customer.vip_status || false,
          email: customer.profile?.email || customer.guest_email || undefined,
          phone: customer.profile?.phone_number || customer.guest_phone || undefined,
          avatarUrl: customer.profile?.avatar_url || undefined
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10) || []

      // 3. VIP Candidates - Non-VIP customers who deserve consideration
      const vipCandidates: InsightData['vipCandidates'] = []
      customers?.forEach(customer => {
        if (customer.vip_status) return // Skip existing VIPs
        
        const reasons: string[] = []
        const visits = customer.total_bookings || 0
        const totalSpent = customer.total_spent || 0
        const lastVisitDate = customer.last_visit ? new Date(customer.last_visit) : null
        
        // Criteria for VIP consideration
        if (visits >= 10) reasons.push(`${visits} visits`)
        if (totalSpent >= 500) reasons.push(`$${totalSpent.toFixed(0)} spent`)
        if (visits >= 5 && lastVisitDate && lastVisitDate > thirtyDaysAgo) {
          reasons.push('Active regular')
        }
        
        // Only add if they meet at least one strong criteria
        if (reasons.length > 0 && (visits >= 8 || totalSpent >= 400)) {
          vipCandidates.push({
            id: customer.id,
            name: customer.profile?.full_name || customer.guest_name || 'Guest',
            visits,
            totalSpent,
            lastVisit: customer.last_visit || undefined,
            reasons,
            email: customer.profile?.email || customer.guest_email || undefined,
            phone: customer.profile?.phone_number || customer.guest_phone || undefined,
            avatarUrl: customer.profile?.avatar_url || undefined
          })
        }
      })
      vipCandidates.sort((a, b) => (b.visits + b.totalSpent / 50) - (a.visits + a.totalSpent / 50))

      // 4. Visit Milestones - Customers approaching visit milestones
      const milestones = [10, 25, 50, 100, 250, 500]
      const visitMilestones: InsightData['visitMilestones'] = []
      customers?.forEach(customer => {
        const visits = customer.total_bookings || 0
        if (visits === 0) return
        
        // Find the next milestone
        const nextMilestone = milestones.find(m => m > visits)
        if (nextMilestone) {
          const visitsToMilestone = nextMilestone - visits
          // Show if within 5 visits of milestone (or 20% for higher milestones)
          const threshold = Math.min(5, Math.ceil(nextMilestone * 0.2))
          if (visitsToMilestone <= threshold) {
            visitMilestones.push({
              id: customer.id,
              name: customer.profile?.full_name || customer.guest_name || 'Guest',
              visits,
              nextMilestone,
              visitsToMilestone,
              isVip: customer.vip_status || false,
              email: customer.profile?.email || customer.guest_email || undefined,
              phone: customer.profile?.phone_number || customer.guest_phone || undefined,
              avatarUrl: customer.profile?.avatar_url || undefined
            })
          }
        }
      })
      visitMilestones.sort((a, b) => a.visitsToMilestone - b.visitsToMilestone)

      // 5. Win-Back Opportunities - Lost customers worth re-engaging
      const winBackOpportunities: InsightData['winBackOpportunities'] = []
      customers?.forEach(customer => {
        const lastVisitDate = customer.last_visit ? new Date(customer.last_visit) : null
        if (!lastVisitDate) return
        
        const daysSinceLastVisit = differenceInDays(today, lastVisitDate)
        const visits = customer.total_bookings || 0
        const totalSpent = customer.total_spent || 0
        
        // Win-back: 60+ days inactive, but was a good customer (3+ visits or $100+ spent)
        if (daysSinceLastVisit >= 60 && (visits >= 3 || totalSpent >= 100)) {
          winBackOpportunities.push({
            id: customer.id,
            name: customer.profile?.full_name || customer.guest_name || 'Guest',
            daysSinceLastVisit,
            previousVisitCount: visits,
            totalSpent,
            lastVisit: customer.last_visit || undefined,
            email: customer.profile?.email || customer.guest_email || undefined,
            phone: customer.profile?.phone_number || customer.guest_phone || undefined,
            avatarUrl: customer.profile?.avatar_url || undefined
          })
        }
      })
      winBackOpportunities.sort((a, b) => (b.previousVisitCount + b.totalSpent / 50) - (a.previousVisitCount + a.totalSpent / 50))

      // 6. Booking Time Distribution - When do customers typically book?
      const bookingTimeDistribution: InsightData['bookingTimeDistribution'] = {
        morning: 0,
        lunch: 0,
        afternoon: 0,
        dinner: 0,
        lateNight: 0
      }
      
      // Get booking times for analysis
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('booking_time')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'payment_pending')
        .gte('booking_time', ninetyDaysAgo.toISOString())
      
      bookingsData?.forEach(booking => {
        try {
          const bookingTime = parseISO(booking.booking_time)
          const hour = getHours(bookingTime)
          
          if (hour < 12) bookingTimeDistribution.morning++
          else if (hour < 15) bookingTimeDistribution.lunch++
          else if (hour < 17) bookingTimeDistribution.afternoon++
          else if (hour < 21) bookingTimeDistribution.dinner++
          else bookingTimeDistribution.lateNight++
        } catch (e) {
          // Skip invalid dates
        }
      })

      // 7. Loyalty Stats - Overall loyalty metrics
      const customersWithMultipleVisits = customers?.filter(c => (c.total_bookings || 0) > 1).length || 0
      const activeCustomers = customers?.filter(c => {
        const lastVisit = c.last_visit ? new Date(c.last_visit) : null
        return lastVisit && lastVisit > ninetyDaysAgo
      }).length || 0
      
      const totalSpentAll = customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0
      const avgLifetimeValue = customers && customers.length > 0 
        ? totalSpentAll / customers.length 
        : 0

      // ==========================================
      // NEW: Additional Analytics Metrics
      // ==========================================

      // 8. Party Size Analytics - Fetch detailed booking data
      const { data: detailedBookings } = await supabase
        .from('bookings')
        .select('id, party_size, booking_time, created_at, user_id, guest_email, guest_name, status')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'payment_pending')
        .gte('booking_time', ninetyDaysAgo.toISOString())

      const partySizeDistribution = {
        solo: 0,
        couple: 0,
        small: 0,
        medium: 0,
        large: 0
      }
      let totalPartySize = 0
      let partySizeCount = 0
      const customerPartySizes: Map<string, { total: number, count: number, name: string, email?: string, phone?: string }> = new Map()

      detailedBookings?.forEach(booking => {
        const size = booking.party_size || 2
        totalPartySize += size
        partySizeCount++

        if (size === 1) partySizeDistribution.solo++
        else if (size === 2) partySizeDistribution.couple++
        else if (size <= 4) partySizeDistribution.small++
        else if (size <= 6) partySizeDistribution.medium++
        else partySizeDistribution.large++

        // Track per customer
        const customerId = booking.user_id || booking.guest_email || booking.guest_name
        if (customerId) {
          const existing = customerPartySizes.get(customerId)
          if (existing) {
            existing.total += size
            existing.count++
          } else {
            const customer = customers?.find(c => 
              c.user_id === booking.user_id || 
              c.guest_email === booking.guest_email ||
              c.guest_name === booking.guest_name
            )
            customerPartySizes.set(customerId, {
              total: size,
              count: 1,
              name: resolveName(customer?.profile?.full_name, customer?.guest_name, booking.guest_name),
              email: customer?.profile?.email || customer?.guest_email || booking.guest_email,
              phone: customer?.profile?.phone_number || customer?.guest_phone
            })
          }
        }
      })

      const largePartyCustomers = Array.from(customerPartySizes.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          averagePartySize: data.total / data.count,
          bookings: data.count,
          email: data.email,
          phone: data.phone
        }))
        .filter(c => c.averagePartySize >= 5)
        .sort((a, b) => b.averagePartySize - a.averagePartySize)
        .slice(0, 8)

      // 9. Day of Week Patterns
      const dayDistribution = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0
      }
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

      detailedBookings?.forEach(booking => {
        try {
          const bookingDate = parseISO(booking.booking_time)
          const dayIndex = getDay(bookingDate)
          const dayName = dayNames[dayIndex]
          dayDistribution[dayName]++
        } catch (e) {
          // Skip invalid dates
        }
      })

      const dayEntries = Object.entries(dayDistribution)
      const busiestDay = dayEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
      const slowestDay = dayEntries.reduce((a, b) => a[1] < b[1] ? a : b)[0]

      // 10. Booking Lead Time Analysis
      const leadTimeDistribution = {
        sameDay: 0,
        nextDay: 0,
        thisWeek: 0,
        nextWeek: 0,
        further: 0
      }
      let totalLeadTime = 0
      let leadTimeCount = 0
      const customerLeadTimes: Map<string, { sameDay: number, total: number, name: string, email?: string, phone?: string }> = new Map()

      detailedBookings?.forEach(booking => {
        try {
          const bookingTime = parseISO(booking.booking_time)
          const createdAt = parseISO(booking.created_at)
          const leadDays = differenceInDays(bookingTime, createdAt)
          
          if (leadDays >= 0) {
            totalLeadTime += leadDays
            leadTimeCount++

            if (leadDays === 0) leadTimeDistribution.sameDay++
            else if (leadDays === 1) leadTimeDistribution.nextDay++
            else if (leadDays <= 7) leadTimeDistribution.thisWeek++
            else if (leadDays <= 14) leadTimeDistribution.nextWeek++
            else leadTimeDistribution.further++

            // Track same-day bookers
            const customerId = booking.user_id || booking.guest_email || booking.guest_name
            if (customerId && leadDays === 0) {
              const existing = customerLeadTimes.get(customerId)
              if (existing) {
                existing.sameDay++
                existing.total++
              } else {
                const customer = customers?.find(c => 
                  c.user_id === booking.user_id || 
                  c.guest_email === booking.guest_email ||
                  c.guest_name === booking.guest_name
                )
                customerLeadTimes.set(customerId, {
                  sameDay: 1,
                  total: 1,
                  name: resolveName(customer?.profile?.full_name, customer?.guest_name, booking.guest_name),
                  email: customer?.profile?.email || customer?.guest_email || booking.guest_email,
                  phone: customer?.profile?.phone_number || customer?.guest_phone
                })
              }
            } else if (customerId) {
              const existing = customerLeadTimes.get(customerId)
              if (existing) {
                existing.total++
              }
            }
          }
        } catch (e) {
          // Skip invalid dates
        }
      })

      const lastMinuteBookers = Array.from(customerLeadTimes.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          sameDayBookings: data.sameDay,
          totalBookings: data.total,
          email: data.email,
          phone: data.phone
        }))
        .filter(c => c.sameDayBookings >= 2)
        .sort((a, b) => b.sameDayBookings - a.sameDayBookings)
        .slice(0, 8)

      // 11. Customer Preferences Analysis
      const dietaryBreakdown = {
        vegetarian: 0,
        vegan: 0,
        glutenFree: 0,
        dairyFree: 0,
        halal: 0,
        none: 0
      }
      const allergyCount: Map<string, number> = new Map()
      let customersWithSpecialNeeds = 0

      customers?.forEach(customer => {
        const dietary = customer.profile?.dietary_restrictions
        const allergies = customer.profile?.allergies
        let hasSpecialNeeds = false

        if (dietary && Array.isArray(dietary)) {
          dietary.forEach((d: string) => {
            const lower = d.toLowerCase()
            if (lower.includes('vegetarian')) { dietaryBreakdown.vegetarian++; hasSpecialNeeds = true }
            if (lower.includes('vegan')) { dietaryBreakdown.vegan++; hasSpecialNeeds = true }
            if (lower.includes('gluten')) { dietaryBreakdown.glutenFree++; hasSpecialNeeds = true }
            if (lower.includes('dairy')) { dietaryBreakdown.dairyFree++; hasSpecialNeeds = true }
            if (lower.includes('halal')) { dietaryBreakdown.halal++; hasSpecialNeeds = true }
         
          })
        }
        if (!hasSpecialNeeds && dietary && dietary.length === 0) {
          dietaryBreakdown.none++
        }

        if (allergies && Array.isArray(allergies)) {
          allergies.forEach((a: string) => {
            const normalized = a.toLowerCase().trim()
            if (normalized) {
              allergyCount.set(normalized, (allergyCount.get(normalized) || 0) + 1)
              hasSpecialNeeds = true
            }
          })
        }

        if (hasSpecialNeeds) customersWithSpecialNeeds++
      })

      const topAllergies = Array.from(allergyCount.entries())
        .map(([allergy, count]) => ({ allergy, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      // 12. Monthly Growth (Last 6 months)
      const monthlyGrowth: InsightData['monthlyGrowth'] = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i))
        const monthEnd = endOfMonth(subMonths(today, i))

        const newInMonth = customers?.filter(c => {
          const firstVisit = c.first_visit ? new Date(c.first_visit) : null
          return firstVisit && firstVisit >= monthStart && firstVisit <= monthEnd
        }).length || 0

        const returningInMonth = customers?.filter(c => {
          const lastVisit = c.last_visit ? new Date(c.last_visit) : null
          const firstVisit = c.first_visit ? new Date(c.first_visit) : null
          return lastVisit && lastVisit >= monthStart && lastVisit <= monthEnd &&
                 firstVisit && firstVisit < monthStart
        }).length || 0

        const bookingsInMonth = detailedBookings?.filter(b => {
          try {
            const bookingDate = parseISO(b.booking_time)
            return bookingDate >= monthStart && bookingDate <= monthEnd
          } catch {
            return false
          }
        }).length || 0

        monthlyGrowth.push({
          month: format(monthStart, 'MMM yyyy'),
          newCustomers: newInMonth,
          returningCustomers: returningInMonth,
          totalBookings: bookingsInMonth
        })
      }

      // 13. Visit Frequency Analysis
      const visitFrequency = {
        weekly: 0,
        biweekly: 0,
        monthly: 0,
        quarterly: 0,
        occasional: 0
      }

      customers?.forEach(customer => {
        const visits = customer.total_bookings || 0
        const firstVisitDate = customer.first_visit ? new Date(customer.first_visit) : null
        if (!firstVisitDate || visits < 2) return

        const daysAsCustomer = differenceInDays(today, firstVisitDate)
        if (daysAsCustomer < 30) return // Need at least 30 days of history

        const avgDaysBetweenVisits = daysAsCustomer / visits

        if (avgDaysBetweenVisits <= 7) visitFrequency.weekly++
        else if (avgDaysBetweenVisits <= 14) visitFrequency.biweekly++
        else if (avgDaysBetweenVisits <= 30) visitFrequency.monthly++
        else if (avgDaysBetweenVisits <= 90) visitFrequency.quarterly++
        else visitFrequency.occasional++
      })

      // 14. Recent Activity (Last 7 days)
      const sevenDaysAgo = subDays(today, 7)
      const fourteenDaysAgo = subDays(today, 14)

      const last7DaysBookings = detailedBookings?.filter(b => {
        try {
          return parseISO(b.booking_time) >= sevenDaysAgo
        } catch {
          return false
        }
      }).length || 0

      const prev7DaysBookings = detailedBookings?.filter(b => {
        try {
          const date = parseISO(b.booking_time)
          return date >= fourteenDaysAgo && date < sevenDaysAgo
        } catch {
          return false
        }
      }).length || 0

      const last7DaysNewCustomers = customers?.filter(c => {
        const firstVisit = c.first_visit ? new Date(c.first_visit) : null
        return firstVisit && firstVisit >= sevenDaysAgo
      }).length || 0

      const last7DaysReturning = customers?.filter(c => {
        const lastVisit = c.last_visit ? new Date(c.last_visit) : null
        const firstVisit = c.first_visit ? new Date(c.first_visit) : null
        return lastVisit && lastVisit >= sevenDaysAgo && firstVisit && firstVisit < sevenDaysAgo
      }).length || 0

      const todayBookings = detailedBookings?.filter(b => {
        try {
          const bookingDate = parseISO(b.booking_time)
          return bookingDate >= today
        } catch {
          return false
        }
      }).length || 0

      const comparedToLastWeek = prev7DaysBookings > 0 
        ? ((last7DaysBookings - prev7DaysBookings) / prev7DaysBookings) * 100 
        : last7DaysBookings > 0 ? 100 : 0

      // 15. No-Show Risk Customers
      const noShowRiskCustomers: InsightData['noShowRiskCustomers'] = []
      customers?.forEach(customer => {
        const totalBookings = customer.total_bookings || 0
        const noShows = customer.profile?.no_show_bookings || 0
        
        if (totalBookings >= 2 && noShows >= 1) {
          const noShowRate = (noShows / totalBookings) * 100
          if (noShowRate >= 20) {
            noShowRiskCustomers.push({
              id: customer.id,
              name: customer.profile?.full_name || customer.guest_name || 'Guest',
              noShowRate,
              totalBookings,
              email: customer.profile?.email || customer.guest_email || undefined,
              phone: customer.profile?.phone_number || customer.guest_phone || undefined
            })
          }
        }
      })
      noShowRiskCustomers.sort((a, b) => b.noShowRate - a.noShowRate)

      // ==========================================
      // 16. Special Occasions from upcoming bookings
      // ==========================================
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      const { data: occasionBookings } = await supabase
        .from('bookings')
        .select('id, occasion, booking_time, party_size, user_id, guest_name, guest_email, guest_phone')
        .eq('restaurant_id', restaurantId)
        .not('occasion', 'is', null)
        .gte('booking_time', today.toISOString())
        .lte('booking_time', thirtyDaysFromNow.toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('booking_time', { ascending: true })

      const specialOccasions: InsightData['specialOccasions'] = []
      occasionBookings?.forEach(booking => {
        const bookingDate = new Date(booking.booking_time)
        const daysUntil = differenceInDays(bookingDate, today)
        
        // Find the customer for this booking
        const customer = customers?.find(c => 
          c.user_id === booking.user_id || 
          c.guest_email === booking.guest_email ||
          c.guest_name === booking.guest_name
        )
        
        specialOccasions.push({
          id: customer?.id || booking.id,
          bookingId: booking.id,
          customerName: resolveName(customer?.profile?.full_name, customer?.guest_name, booking.guest_name),
          occasion: booking.occasion,
          bookingDate: booking.booking_time,
          daysUntil,
          partySize: booking.party_size,
          email: customer?.profile?.email || customer?.guest_email || booking.guest_email || undefined,
          phone: customer?.profile?.phone_number || customer?.guest_phone || booking.guest_phone || undefined,
          isVip: customer?.vip_status || false
        })
      })

      // ==========================================
      // 17. Loyalty Tier Breakdown
      // ==========================================
      const tierPoints = { bronze: 0, silver: 500, gold: 1000, platinum: 2500 }
      const loyaltyTierBreakdown: InsightData['loyaltyTierBreakdown'] = {
        bronze: 0,
        silver: 0,
        gold: 0,
        platinum: 0,
        nearUpgrade: []
      }

      customers?.forEach(customer => {
        const tier = customer.profile?.membership_tier?.toLowerCase() || 'bronze'
        const points = customer.profile?.loyalty_points || 0
        
        if (tier === 'platinum') loyaltyTierBreakdown.platinum++
        else if (tier === 'gold') loyaltyTierBreakdown.gold++
        else if (tier === 'silver') loyaltyTierBreakdown.silver++
        else loyaltyTierBreakdown.bronze++

        // Check if near upgrade (within 100 points)
        let nextTier = ''
        let pointsToNext = 0
        if (tier === 'bronze' && points >= tierPoints.silver - 100) {
          nextTier = 'Silver'
          pointsToNext = tierPoints.silver - points
        } else if (tier === 'silver' && points >= tierPoints.gold - 100) {
          nextTier = 'Gold'
          pointsToNext = tierPoints.gold - points
        } else if (tier === 'gold' && points >= tierPoints.platinum - 200) {
          nextTier = 'Platinum'
          pointsToNext = tierPoints.platinum - points
        }

        if (nextTier && pointsToNext > 0) {
          loyaltyTierBreakdown.nearUpgrade.push({
            id: customer.id,
            name: customer.profile?.full_name || customer.guest_name || 'Guest',
            currentTier: tier.charAt(0).toUpperCase() + tier.slice(1),
            currentPoints: points,
            pointsToNextTier: pointsToNext,
            nextTier,
            email: customer.profile?.email || customer.guest_email || undefined,
            phone: customer.profile?.phone_number || customer.guest_phone || undefined
          })
        }
      })
      loyaltyTierBreakdown.nearUpgrade.sort((a, b) => a.pointsToNextTier - b.pointsToNextTier)

      // ==========================================
      // 18. Customer Relationship Insights
      // ==========================================
      const { data: relationships } = await supabase
        .from('customer_relationships')
        .select(`
          *,
          customer:restaurant_customers!customer_relationships_customer_id_fkey(
            id, guest_name, profile:profiles(full_name)
          ),
          related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
            id, guest_name, profile:profiles(full_name)
          )
        `)
        .eq('customer.restaurant_id', restaurantId)

      const relationshipInsights: InsightData['relationshipInsights'] = {
        totalWithRelationships: 0,
        couplesCount: 0,
        familiesCount: 0,
        frequentGroups: []
      }

      const uniqueCustomersWithRelations = new Set<string>()
      relationships?.forEach(rel => {
        uniqueCustomersWithRelations.add(rel.customer_id)
        uniqueCustomersWithRelations.add(rel.related_customer_id)
        
        if (rel.relationship_type === 'spouse' || rel.relationship_type === 'partner') {
          relationshipInsights.couplesCount++
        } else if (['parent', 'child', 'sibling'].includes(rel.relationship_type)) {
          relationshipInsights.familiesCount++
        }

        const customerName = rel.customer?.profile?.full_name || rel.customer?.guest_name || 'Guest'
        const relatedName = rel.related_customer?.profile?.full_name || rel.related_customer?.guest_name || 'Guest'
        
        relationshipInsights.frequentGroups.push({
          customerName,
          relatedTo: relatedName,
          relationshipType: rel.relationship_type.charAt(0).toUpperCase() + rel.relationship_type.slice(1),
          bookingsTogether: 0 // Would need more complex query to calculate
        })
      })
      relationshipInsights.totalWithRelationships = uniqueCustomersWithRelations.size
      // Only show first 6 relationships
      relationshipInsights.frequentGroups = relationshipInsights.frequentGroups.slice(0, 6)

      setInsights({
        customerSegments: segments,
        trends: {
          newCustomersThisMonth: newThisMonth,
          newCustomersLastMonth: newLastMonth,
          returningRate: customers && customers.length > 0 
            ? (returningCustomers / customers.length) * 100 
            : 0,
          averageVisitsPerCustomer: customers && customers.length > 0
            ? totalVisits / customers.length
            : 0
        },
        topMetrics: {
          mostFrequentCustomers: frequentCustomers
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 5),
          upcomingBirthdays: upcomingBirthdays.slice(0, 10)
        },
        riskMetrics: {
          highCancellationCustomers: highCancellation,
          highNoShowCustomers: highNoShow,
          blacklistedCustomers: customers?.filter(c => c.blacklisted).length || 0
        },
        // NEW: Enhanced metrics
        firstVisitAnniversaries: firstVisitAnniversaries.slice(0, 10),
        topSpenders,
        vipCandidates: vipCandidates.slice(0, 8),
        visitMilestones: visitMilestones.slice(0, 8),
        winBackOpportunities: winBackOpportunities.slice(0, 10),
        bookingTimeDistribution,
        loyaltyStats: {
          averageCustomerLifetimeValue: avgLifetimeValue,
          totalActiveCustomers: activeCustomers,
          customersWithMultipleVisits,
          averageTimeBetweenVisits: 0 // Would need more complex calculation
        },
        // NEW: Additional analytics
        partySizeAnalytics: {
          averagePartySize: partySizeCount > 0 ? totalPartySize / partySizeCount : 0,
          distribution: partySizeDistribution,
          largePartyCustomers
        },
        dayOfWeekPatterns: {
          distribution: dayDistribution,
          busiestDay: busiestDay.charAt(0).toUpperCase() + busiestDay.slice(1),
          slowestDay: slowestDay.charAt(0).toUpperCase() + slowestDay.slice(1)
        },
        bookingLeadTime: {
          averageDays: leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0,
          distribution: leadTimeDistribution,
          lastMinuteBookers
        },
        customerPreferences: {
          dietaryBreakdown,
          topAllergies,
          customersWithSpecialNeeds
        },
        monthlyGrowth,
        visitFrequency,
        recentActivity: {
          last7DaysBookings,
          last7DaysNewCustomers,
          last7DaysReturning,
          todayBookings,
          comparedToLastWeek
        },
        noShowRiskCustomers: noShowRiskCustomers.slice(0, 8),
        // NEW: Special occasions and personalization
        specialOccasions: specialOccasions.slice(0, 10),
        loyaltyTierBreakdown,
        relationshipInsights
      })

    } catch (error) {
      console.error('Error loading insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !insights) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/2 motion-safe:animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/3 motion-safe:animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const getGrowthIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />
    return null
  }

  const getGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Customer Segments */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Customer Segments</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    VIP Customers
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{insights.customerSegments.vip}</div>
                  <Star className="h-4 w-4 text-yellow-500 mt-2" />
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="font-medium">👑 VIP Customers</p>
              <p className="text-xs text-muted-foreground text-sm">Your most valued guests marked as VIP. They deserve priority service, the best tables, and personalized attention!
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    Regular
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{insights.customerSegments.regular}</div>
                  <Users className="h-4 w-4 text-blue-500 mt-2" />
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="font-medium">🔵 Regular Customers</p>
              <p className="text-xs text-muted-foreground text-sm">Customers with 5+ visits who came back within the last 30 days. These are your reliable, returning guests!
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    At Risk
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{insights.customerSegments.atRisk}</div>
                  <AlertCircle className="h-4 w-4 text-orange-500 mt-2" />
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="font-medium">⚠️ At Risk Customers</p>
              <p className="text-xs text-muted-foreground text-sm">Customers who haven&apos;t visited in 30-90 days. They might be drifting away - consider reaching out with a special offer!
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    New
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{insights.customerSegments.new}</div>
                  <Calendar className="h-4 w-4 text-green-500 mt-2" />
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="font-medium">🆕 New Customers</p>
              <p className="text-xs text-muted-foreground text-sm">First-time guests who visited within the last 30 days. Make a great impression to turn them into regulars!
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    Lost
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{insights.customerSegments.lost}</div>
                  <Clock className="h-4 w-4 text-gray-500 mt-2" />
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="font-medium">💤 Lost Customers</p>
              <p className="text-xs text-muted-foreground text-sm">Customers who haven&apos;t visited in over 90 days. These are win-back opportunities - a personal call or special offer might bring them back!
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Customer Retention */}
      <Card>
          <CardHeader>
            <CardTitle>Customer Retention</CardTitle>
            <CardDescription>Key retention metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Returning Customer Rate</span>
                  <span className="text-sm font-medium">
                    {insights.trends.returningRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={insights.trends.returningRate} className="h-2" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Visits per Customer</span>
                <span className="text-lg font-medium">
                  {insights.trends.averageVisitsPerCustomer.toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Most Frequent Visitors
          </CardTitle>
          <CardDescription>Your most loyal customers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.topMetrics.mostFrequentCustomers.length > 0 ? (
              insights.topMetrics.mostFrequentCustomers.map((customer, index) => (
                <div key={customer.id} className="flex items-center justify-between p-3 border border-border/60 bg-muted/20 hover:bg-muted/40 rounded-lg shadow-sm transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center text-xs font-bold text-white bg-blue-600 rounded-full w-6 h-6 shrink-0">
                      {index + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={customer.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{customer.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {customer.phone && (
                          <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-primary">
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                        {customer.email && (
                          <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-primary">
                            <Mail className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{customer.visits} visits</div>
                    {customer.lastVisit && (
                      <div className="text-xs text-muted-foreground">Last: {format(new Date(customer.lastVisit), 'MMM d')}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 col-span-full">No frequent visitors yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Birthdays */}
      {insights.topMetrics.upcomingBirthdays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" />
              Upcoming Birthdays
            </CardTitle>
            <CardDescription>Customers celebrating in the next 30 days - great opportunity to personalize their experience!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.topMetrics.upcomingBirthdays.map((customer) => (
                <div 
                  key={customer.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    customer.daysUntil === 0 
                      ? 'bg-pink-50 border-pink-200' 
                      : customer.daysUntil <= 7 
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-muted/30'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={customer.avatarUrl} />
                    <AvatarFallback className="text-sm">
                      {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{customer.name}</p>
                      {customer.isVip && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-sm">{customer.daysUntil === 0 ? (
                        <span className="text-pink-600 font-medium flex items-center gap-1">
                          <Gift className="h-3 w-3" /> Today! Turning {customer.age}
                        </span>
                      ) : customer.daysUntil === 1 ? (
                        <span className="text-yellow-600 font-medium">Tomorrow ({format(new Date(customer.birthday), 'MMM d')}) • Turning {customer.age}</span>
                      ) : customer.daysUntil <= 7 ? (
                        <span className="text-yellow-600">{format(new Date(customer.birthday), 'EEEE, MMM d')} • Turning {customer.age}</span>
                      ) : (
                        <span>{format(new Date(customer.birthday), 'MMM d')} (in {customer.daysUntil} days) • Turning {customer.age}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                      {customer.email && (
                        <a href={`mailto:${customer.email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==========================================
          NEW: ENHANCED PERSONALIZATION SECTIONS
          ========================================== */}

      {/* First Visit Anniversaries */}
      {insights.firstVisitAnniversaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-purple-500" />
              Loyalty Anniversaries
            </CardTitle>
            <CardDescription>Customers celebrating their journey with you - perfect time to show appreciation!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.firstVisitAnniversaries.map((customer) => (
                <div 
                  key={customer.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    customer.daysUntil === 0 
                      ? 'bg-purple-50 border-purple-200' 
                      : customer.daysUntil <= 7 
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-muted/30'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={customer.avatarUrl} />
                    <AvatarFallback className="text-sm">
                      {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{customer.name}</p>
                      {customer.isVip && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-sm">{customer.daysUntil === 0 ? (
                        <span className="text-purple-600 font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> {customer.yearsWithUs} year{customer.yearsWithUs > 1 ? 's' : ''} today!
                        </span>
                      ) : customer.daysUntil === 1 ? (
                        <span className="text-indigo-600 font-medium">{customer.yearsWithUs} year{customer.yearsWithUs > 1 ? 's' : ''} tomorrow!</span>
                      ) : (
                        <span>{customer.yearsWithUs} year{customer.yearsWithUs > 1 ? 's' : ''} in {customer.daysUntil} days</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {customer.totalVisits} visits
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                      {customer.email && (
                        <a href={`mailto:${customer.email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Spenders section removed - spending tracking not yet deployed */}

      {/* Special Occasions - Upcoming celebrations */}
      {insights.specialOccasions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarHeart className="h-5 w-5 text-rose-500" />
              Celebration Bookings
            </CardTitle>
            <CardDescription>Upcoming reservations where guests are celebrating - prepare something special!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.specialOccasions.map((occasion) => (
                <div 
                  key={occasion.bookingId} 
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    occasion.daysUntil === 0 
                      ? 'bg-rose-50 border-rose-200' 
                      : occasion.daysUntil <= 3 
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-muted/30'
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                    <PartyPopper className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{occasion.customerName}</p>
                      {occasion.isVip && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium text-rose-600">
                      <span className="text-muted-foreground">Celebrating: </span>
                      <span className="capitalize">{occasion.occasion}</span>
                    </p>
                    <p className="text-xs text-muted-foreground text-sm">{occasion.daysUntil === 0 ? (
                        <span className="text-rose-600 font-medium">Today!</span>
                      ) : occasion.daysUntil === 1 ? (
                        <span>Tomorrow</span>
                      ) : (
                        <span>{format(new Date(occasion.bookingDate), 'MMM d')} • in {occasion.daysUntil} days</span>
                      )}
                      {' • '}{occasion.partySize} guests
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {occasion.phone && (
                        <a href={`tel:${occasion.phone}`} className="text-xs text-muted-foreground hover:text-primary">
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                      {occasion.email && (
                        <a href={`mailto:${occasion.email}`} className="text-xs text-muted-foreground hover:text-primary">
                          <Mail className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Relationships */}
      {insights.relationshipInsights.totalWithRelationships > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-pink-500" />
              Customer Connections
            </CardTitle>
            <CardDescription>Customers who dine together - great for group promotions!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-pink-50 border border-pink-200">
                <div className="text-xl font-bold text-pink-700">{insights.relationshipInsights.totalWithRelationships}</div>
                <div className="text-xs text-pink-600">Connected</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-xl font-bold text-red-700">{insights.relationshipInsights.couplesCount}</div>
                <div className="text-xs text-red-600">Couples</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div className="text-xl font-bold text-orange-700">{insights.relationshipInsights.familiesCount}</div>
                <div className="text-xs text-orange-600">Families</div>
              </div>
            </div>
            
            {insights.relationshipInsights.frequentGroups.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Connections</h4>
                {insights.relationshipInsights.frequentGroups.slice(0, 4).map((group, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Heart className="h-4 w-4 text-pink-500" />
                    <span className="text-sm">
                      <span className="font-medium">{group.customerName}</span>
                      <span className="text-muted-foreground"> & </span>
                      <span className="font-medium">{group.relatedTo}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{group.relationshipType}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* VIP Candidates */}
      {insights.vipCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              VIP Candidates
            </CardTitle>
            <CardDescription>Loyal customers who deserve VIP recognition - consider upgrading them!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.vipCandidates.slice(0, 6).map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-amber-300">
                      <AvatarImage src={customer.avatarUrl} />
                      <AvatarFallback className="text-sm bg-amber-100">
                        {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{customer.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {customer.reasons.map((reason, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="text-muted-foreground hover:text-primary">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="text-muted-foreground hover:text-primary">
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visit Milestones */}
      {insights.visitMilestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-orange-500" />
              Approaching Milestones
            </CardTitle>
            <CardDescription>Customers close to visit milestones - celebrate their loyalty!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {insights.visitMilestones.slice(0, 8).map((customer) => (
                <div key={customer.id} className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 text-center">
                  <Avatar className="h-12 w-12 mx-auto mb-2 ring-2 ring-orange-300">
                    <AvatarImage src={customer.avatarUrl} />
                    <AvatarFallback className="text-sm bg-orange-100">
                      {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium truncate">{customer.name}</p>
                  <div className="mt-2">
                    <div className="flex items-center justify-center gap-1 text-orange-600">
                      <Target className="h-4 w-4" />
                      <span className="font-bold">{customer.nextMilestone}</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-sm">{customer.visitsToMilestone} more visit{customer.visitsToMilestone > 1 ? 's' : ''} to go!
                    </p>
                    <div className="w-full bg-orange-200 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-orange-500 h-1.5 rounded-full transition-all" 
                        style={{ width: `${(customer.visits / customer.nextMilestone) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-sm">{customer.visits}/{customer.nextMilestone} visits</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Win-Back Opportunities */}
      {insights.winBackOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              Win-Back Opportunities
            </CardTitle>
            <CardDescription>Former regulars who haven&apos;t visited recently - reach out and bring them back!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.winBackOpportunities.slice(0, 8).map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={customer.avatarUrl} />
                      <AvatarFallback className="text-sm bg-blue-100">
                        {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground text-sm">{customer.previousVisitCount} past visits
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        <Timer className="h-3 w-3 inline mr-1" />
                        {customer.daysSinceLastVisit} days since last visit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Booking Time Distribution */}
      {Object.values(insights.bookingTimeDistribution).some(v => v > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Popular Booking Times
            </CardTitle>
            <CardDescription>When your customers prefer to dine - use this for staffing and marketing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: 'morning', label: 'Morning', icon: <Sun className="h-5 w-5 text-yellow-500" />, time: 'Before 12pm', value: insights.bookingTimeDistribution.morning },
                { key: 'lunch', label: 'Lunch', icon: <Sun className="h-5 w-5 text-orange-500" />, time: '12pm - 3pm', value: insights.bookingTimeDistribution.lunch },
                { key: 'afternoon', label: 'Afternoon', icon: <Sunset className="h-5 w-5 text-amber-500" />, time: '3pm - 5pm', value: insights.bookingTimeDistribution.afternoon },
                { key: 'dinner', label: 'Dinner', icon: <Sunset className="h-5 w-5 text-red-500" />, time: '5pm - 9pm', value: insights.bookingTimeDistribution.dinner },
                { key: 'lateNight', label: 'Late Night', icon: <Moon className="h-5 w-5 text-indigo-500" />, time: 'After 9pm', value: insights.bookingTimeDistribution.lateNight }
              ].map((slot) => {
                const total = Object.values(insights.bookingTimeDistribution).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? (slot.value / total) * 100 : 0
                return (
                  <div key={slot.key} className="p-3 rounded-lg bg-muted/30 text-center">
                    {slot.icon}
                    <p className="text-sm font-medium mt-1">{slot.label}</p>
                    <p className="text-xs text-muted-foreground">{slot.time}</p>
                    <p className="text-lg font-bold mt-1">{slot.value}</p>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Indicators</CardTitle>
          <CardDescription>Customers requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-orange-300 rounded-lg">
              <div>
                <p className="text-sm font-medium">High Cancellation Rate</p>
                <p className="text-xs text-gray-600">More than 30% cancellations</p>
              </div>
              <div className="text-xl font-bold text-orange-600">
                {insights.riskMetrics.highCancellationCustomers}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-pink-300 rounded-lg">
              <div>
                <p className="text-sm font-medium">High No-Show Rate</p>
                <p className="text-xs text-gray-600">More than 20% no-shows</p>
              </div>
              <div className="text-xl font-bold text-red-600">
                {insights.riskMetrics.highNoShowCustomers}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-300 rounded-lg">
              <div>
                <p className="text-sm font-medium">Blacklisted</p>
                <p className="text-xs text-gray-600">Restricted from booking</p>
              </div>
              <div className="text-xl font-bold text-gray-600">
                {insights.riskMetrics.blacklistedCustomers}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==========================================
          NEW: ADDITIONAL ANALYTICS SECTIONS
          ========================================== */}

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-500" />
            Recent Activity
          </CardTitle>
          <CardDescription>Last 7 days performance at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-100 text-center">
              <p className="text-sm text-muted-foreground">Today&apos;s Bookings</p>
              <p className="text-xl font-bold text-cyan-600">{insights.recentActivity.todayBookings}</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-center">
              <p className="text-sm text-muted-foreground">Last 7 Days</p>
              <p className="text-xl font-bold text-blue-600">{insights.recentActivity.last7DaysBookings}</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 text-center">
              <p className="text-sm text-muted-foreground">New Guests</p>
              <p className="text-xl font-bold text-green-600">{insights.recentActivity.last7DaysNewCustomers}</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 text-center">
              <p className="text-sm text-muted-foreground">Returning</p>
              <p className="text-xl font-bold text-purple-600">{insights.recentActivity.last7DaysReturning}</p>
            </div>
            <div className={`p-4 rounded-lg text-center ${insights.recentActivity.comparedToLastWeek >= 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100' : 'bg-gradient-to-br from-red-50 to-pink-50 border border-red-100'}`}>
              <p className="text-sm text-muted-foreground">vs Last Week</p>
              <div className="flex items-center justify-center gap-1">
                {insights.recentActivity.comparedToLastWeek >= 0 ? (
                  <ChevronUp className="h-5 w-5 text-green-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-red-600" />
                )}
                <p className={`text-xl font-bold ${insights.recentActivity.comparedToLastWeek >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(insights.recentActivity.comparedToLastWeek).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Growth Chart */}
      {insights.monthlyGrowth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Monthly Growth Trend
            </CardTitle>
            <CardDescription>Customer acquisition over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.monthlyGrowth.map((month, index) => {
                const maxBookings = Math.max(...insights.monthlyGrowth.map(m => m.totalBookings))
                const percentage = maxBookings > 0 ? (month.totalBookings / maxBookings) * 100 : 0
                return (
                  <div key={month.month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{month.month}</span>
                      <div className="flex items-center gap-4 text-muted-foreground text-sm"><span className="text-green-600">{month.newCustomers} new</span>
                        <span className="text-blue-600">{month.returningCustomers} returning</span>
                        <span className="font-medium text-foreground">{month.totalBookings} bookings</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day of Week Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-teal-500" />
            Day of Week Patterns
          </CardTitle>
          <CardDescription>
            <span className="text-green-600 font-medium">{insights.dayOfWeekPatterns.busiestDay}</span> is your busiest day, 
            <span className="text-orange-600 font-medium"> {insights.dayOfWeekPatterns.slowestDay}</span> is slowest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Object.entries(insights.dayOfWeekPatterns.distribution).map(([day, count]) => {
              const total = Object.values(insights.dayOfWeekPatterns.distribution).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (count / total) * 100 : 0
              const isBusiest = day === insights.dayOfWeekPatterns.busiestDay.toLowerCase()
              const isSlowest = day === insights.dayOfWeekPatterns.slowestDay.toLowerCase()
              return (
                <div 
                  key={day} 
                  className={`p-3 rounded-lg text-center ${
                    isBusiest ? 'bg-green-100 border-2 border-green-300' :
                    isSlowest ? 'bg-orange-100 border-2 border-orange-300' :
                    'bg-muted/30'
                  }`}
                >
                  <p className="text-xs font-medium uppercase text-muted-foreground">{day.slice(0, 3)}</p>
                  <p className="text-lg font-bold mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Party Size Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-violet-500" />
            Party Size Analytics
          </CardTitle>
          <CardDescription>
            Average party size: <span className="font-bold text-foreground">{insights.partySizeAnalytics.averagePartySize.toFixed(1)} guests</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'solo', label: 'Solo', count: insights.partySizeAnalytics.distribution.solo, size: '1' },
                { key: 'couple', label: 'Couple', count: insights.partySizeAnalytics.distribution.couple, size: '2' },
                { key: 'small', label: 'Small', count: insights.partySizeAnalytics.distribution.small, size: '3-4' },
                { key: 'medium', label: 'Medium', count: insights.partySizeAnalytics.distribution.medium, size: '5-6' },
                { key: 'large', label: 'Large', count: insights.partySizeAnalytics.distribution.large, size: '7+' }
              ].map((size) => {
                const total = Object.values(insights.partySizeAnalytics.distribution).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? (size.count / total) * 100 : 0
                return (
                  <div key={size.key} className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-center">
                    <p className="text-xs text-muted-foreground">{size.label}</p>
                    <p className="text-xs text-violet-600">({size.size})</p>
                    <p className="text-lg font-bold text-violet-700 mt-1">{size.count}</p>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</p>
                  </div>
                )
              })}
            </div>

            {insights.partySizeAnalytics.largePartyCustomers.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Large Party Regulars (avg 5+ guests)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {insights.partySizeAnalytics.largePartyCustomers.slice(0, 4).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-2 bg-violet-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.bookings} bookings</p>
                      </div>
                      <Badge variant="secondary" className="bg-violet-100">
                        ~{customer.averagePartySize.toFixed(1)} guests
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Booking Lead Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-amber-500" />
            Booking Lead Time
          </CardTitle>
          <CardDescription>
            Average booking lead time: <span className="font-bold text-foreground">{insights.bookingLeadTime.averageDays.toFixed(1)} days</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'sameDay', label: 'Same Day', count: insights.bookingLeadTime.distribution.sameDay },
                { key: 'nextDay', label: 'Next Day', count: insights.bookingLeadTime.distribution.nextDay },
                { key: 'thisWeek', label: '2-7 Days', count: insights.bookingLeadTime.distribution.thisWeek },
                { key: 'nextWeek', label: '8-14 Days', count: insights.bookingLeadTime.distribution.nextWeek },
                { key: 'further', label: '15+ Days', count: insights.bookingLeadTime.distribution.further }
              ].map((lead) => {
                const total = Object.values(insights.bookingLeadTime.distribution).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? (lead.count / total) * 100 : 0
                return (
                  <div key={lead.key} className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
                    <p className="text-xs text-muted-foreground">{lead.label}</p>
                    <p className="text-lg font-bold text-amber-700 mt-1">{lead.count}</p>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visit Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-500" />
            Visit Frequency Distribution
          </CardTitle>
          <CardDescription>How often your customers return</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {[
              { key: 'weekly', label: 'Weekly', desc: 'Every week', count: insights.visitFrequency.weekly, color: 'emerald' },
              { key: 'biweekly', label: 'Bi-Weekly', desc: 'Every 2 weeks', count: insights.visitFrequency.biweekly, color: 'green' },
              { key: 'monthly', label: 'Monthly', desc: 'Once a month', count: insights.visitFrequency.monthly, color: 'blue' },
              { key: 'quarterly', label: 'Quarterly', desc: 'Every 3 months', count: insights.visitFrequency.quarterly, color: 'purple' },
              { key: 'occasional', label: 'Occasional', desc: 'Less frequent', count: insights.visitFrequency.occasional, color: 'gray' }
            ].map((freq) => {
              const total = Object.values(insights.visitFrequency).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (freq.count / total) * 100 : 0
              return (
                <div key={freq.key} className={`p-3 rounded-lg bg-${freq.color}-50 border border-${freq.color}-100 text-center`}>
                  <p className="text-sm font-medium">{freq.label}</p>
                  <p className="text-xs text-muted-foreground">{freq.desc}</p>
                  <p className={`text-xl font-bold text-${freq.color}-700 mt-2`}>{freq.count}</p>
                  <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customer Preferences */}
      {insights.customerPreferences.customersWithSpecialNeeds > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-lime-500" />
              Customer Dietary Preferences
            </CardTitle>
            <CardDescription>
              {insights.customerPreferences.customersWithSpecialNeeds} customers with special dietary needs or allergies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-3">Dietary Requirements</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'vegetarian', label: 'Vegetarian', count: insights.customerPreferences.dietaryBreakdown.vegetarian, emoji: '🥗' },
                    { key: 'vegan', label: 'Vegan', count: insights.customerPreferences.dietaryBreakdown.vegan, emoji: '🌱' },
                    { key: 'glutenFree', label: 'Gluten-Free', count: insights.customerPreferences.dietaryBreakdown.glutenFree, emoji: '🌾' },
                    { key: 'dairyFree', label: 'Dairy-Free', count: insights.customerPreferences.dietaryBreakdown.dairyFree, emoji: '🥛' },
                    { key: 'halal', label: 'Halal', count: insights.customerPreferences.dietaryBreakdown.halal, emoji: '☪️' },
                
                  ].filter(d => d.count > 0).map((diet) => (
                    <div key={diet.key} className="flex items-center justify-between p-2 bg-lime-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{diet.emoji}</span>
                        <span className="text-sm">{diet.label}</span>
                      </div>
                      <Badge variant="secondary">{diet.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {insights.customerPreferences.topAllergies.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3">Common Allergies</p>
                  <div className="space-y-2">
                    {insights.customerPreferences.topAllergies.map((allergy) => (
                      <div key={allergy.allergy} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm capitalize">{allergy.allergy}</span>
                        </div>
                        <Badge variant="destructive">{allergy.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No-Show Risk Customers */}
      {insights.noShowRiskCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              No-Show Risk Customers
            </CardTitle>
            <CardDescription>Customers with history of no-shows - consider requiring deposits or confirmations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.noShowRiskCustomers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground text-sm">{customer.totalBookings} total bookings
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">
                      {customer.noShowRate.toFixed(0)}% no-show
                    </Badge>
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="text-muted-foreground hover:text-primary">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </TooltipProvider>
  )
}
