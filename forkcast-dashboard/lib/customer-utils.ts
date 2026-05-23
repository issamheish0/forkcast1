// lib/customer-utils.ts

import { createClient } from '@/lib/supabase/client'
import type { RestaurantCustomer } from '@/types/customer'

export const customerUtils = {
  // Search customers
  async searchCustomers(
    restaurantId: string, 
    query: string
  ): Promise<RestaurantCustomer[]> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('restaurant_customers')
      .select(`
        *,
        profile:profiles!restaurant_customers_user_id_fkey(
          id,
          full_name,
          email,
          phone_number,
          avatar_url
        )
      `)
      .eq('restaurant_id', restaurantId)
      .or(`guest_name.ilike.%${query.replace(/[,()\\"']/g, '')}%,guest_email.ilike.%${query.replace(/[,()\\"']/g, '')}%,guest_phone.ilike.%${query.replace(/[,()\\"']/g, '')}%`)
      .limit(10)

    if (error) throw error
    return data || []
  },

  // Get customer by email or phone
  async findCustomerByContact(
    restaurantId: string,
    email?: string,
    phone?: string
  ): Promise<RestaurantCustomer | null> {
    const supabase = createClient()
    
    let query = supabase
      .from('restaurant_customers')
      .select(`
        *,
        profile:profiles!restaurant_customers_user_id_fkey(
          id,
          full_name,
          email,
          phone_number,
          avatar_url
        ),
        tags:customer_tag_assignments(
          tag:customer_tags(*)
        ),
        notes:customer_notes(*)
      `)
      .eq('restaurant_id', restaurantId)

    if (email) {
      query = query.eq('guest_email', email)
    } else if (phone) {
      query = query.or(`guest_phone.eq.${phone},profiles.phone_number.eq.${phone}`)
    } else {
      return null
    }

    const { data, error } = await query.single()

    if (error || !data) return null
    
    return {
      ...data,
      tags: data.tags?.map((t: any) => t.tag) || []
    }
  },

  // Get customer stats
  async getCustomerStats(restaurantId: string) {
    const supabase = createClient()
    
    const [
      totalResult,
      vipResult,
      blacklistedResult,
      recentResult
    ] = await Promise.all([
      supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId),
      
      supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .eq('vip_status', true),
      
      supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .eq('blacklisted', true),
      
      supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('last_visit', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ])

    return {
      total: totalResult.count || 0,
      vip: vipResult.count || 0,
      blacklisted: blacklistedResult.count || 0,
      recent: recentResult.count || 0
    }
  },

  // Merge customers (when a guest becomes a registered user)
  async mergeCustomers(
    restaurantId: string,
    guestCustomerId: string,
    userId: string
  ) {
    const supabase = createClient()
    
    try {
      // Start a transaction by getting both customer records
      const [guestResult, userResult] = await Promise.all([
        supabase
          .from('restaurant_customers')
          .select('*')
          .eq('id', guestCustomerId)
          .single(),
        
        supabase
          .from('restaurant_customers')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', userId)
          .single()
      ])

      if (guestResult.error || !guestResult.data) {
        throw new Error('Guest customer not found')
      }

      // If user customer exists, merge data
      if (userResult.data) {
        // Update user customer with combined stats
        const { error: updateError } = await supabase
          .from('restaurant_customers')
          .update({
            total_bookings: userResult.data.total_bookings + guestResult.data.total_bookings,
            total_spent: userResult.data.total_spent + guestResult.data.total_spent,
            no_show_count: userResult.data.no_show_count + guestResult.data.no_show_count,
            cancelled_count: userResult.data.cancelled_count + guestResult.data.cancelled_count,
            first_visit: guestResult.data.first_visit < userResult.data.first_visit 
              ? guestResult.data.first_visit 
              : userResult.data.first_visit,
            vip_status: userResult.data.vip_status || guestResult.data.vip_status,
            updated_at: new Date().toISOString()
          })
          .eq('id', userResult.data.id)

        if (updateError) throw updateError

        // Move all guest data to user customer
        await Promise.all([
          // Move tags
          supabase
            .from('customer_tag_assignments')
            .update({ customer_id: userResult.data.id })
            .eq('customer_id', guestCustomerId),
          
          // Move notes
          supabase
            .from('customer_notes')
            .update({ customer_id: userResult.data.id })
            .eq('customer_id', guestCustomerId),
          
          // Move relationships
          supabase
            .from('customer_relationships')
            .update({ customer_id: userResult.data.id })
            .eq('customer_id', guestCustomerId),
          
          // Update related relationships
          supabase
            .from('customer_relationships')
            .update({ related_customer_id: userResult.data.id })
            .eq('related_customer_id', guestCustomerId)
        ])

        // Delete guest customer
        await supabase
          .from('restaurant_customers')
          .delete()
          .eq('id', guestCustomerId)

        return userResult.data.id
      } else {
        // Convert guest to user customer
        const { error: updateError } = await supabase
          .from('restaurant_customers')
          .update({
            user_id: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', guestCustomerId)

        if (updateError) throw updateError
        return guestCustomerId
      }
    } catch (error) {
      console.error('Error merging customers:', error)
      throw error
    }
  },

  // Format customer display name
  getCustomerDisplayName(customer: RestaurantCustomer): string {
    return customer.profile?.full_name || customer.guest_name || 'Guest Customer'
  },

  // Format customer contact info
  getCustomerContact(customer: any): {
    email?: string
    phone?: string
  } {
    return {
      email: customer.guest_email, // Only guest bookings have email stored locally
      phone: customer.profile?.phone_number || customer.guest_phone
    }
  },

  // Calculate customer score/rating
  calculateCustomerScore(customer: RestaurantCustomer): number {
    let score = 5.0

    // Deduct for no-shows
    if (customer.total_bookings > 0) {
      const noShowRate = customer.no_show_count / customer.total_bookings
      score -= noShowRate * 2
    }

    // Deduct for high cancellation rate
    if (customer.total_bookings > 0) {
      const cancelRate = customer.cancelled_count / customer.total_bookings
      score -= cancelRate * 1
    }

    // Bonus for VIP
    if (customer.vip_status) {
      score += 0.5
    }

    // Ensure score is between 1 and 5
    return Math.max(1, Math.min(5, score))
  },

  // Get customer booking patterns
  async getCustomerPatterns(customerId: string) {
    const supabase = createClient()

    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_time, party_size, table_preferences')
      .or(`user_id.eq.${customerId},guest_email.eq.${customerId}`)
      .eq('status', 'completed')
      .order('booking_time', { ascending: false })
      .limit(50)

    if (!bookings || bookings.length === 0) {
      return {
        preferredDays: [],
        preferredTimes: [],
        averagePartySize: 0,
        preferredTables: []
      }
    }

    // Analyze patterns
    const dayCount: Record<string, number> = {}
    const hourCount: Record<number, number> = {}
    const tablePrefs: Record<string, number> = {}
    let totalPartySize = 0

    bookings.forEach(booking => {
      const date = new Date(booking.booking_time)
      const day = date.toLocaleDateString('en-US', { weekday: 'long' })
      const hour = date.getHours()

      dayCount[day] = (dayCount[day] || 0) + 1
      hourCount[hour] = (hourCount[hour] || 0) + 1
      totalPartySize += booking.party_size

      booking.table_preferences?.forEach((pref: string) => {
        tablePrefs[pref] = (tablePrefs[pref] || 0) + 1
      })
    })

    // Get top preferences
    const sortByCount = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort(([, a], [, b]) => b - a)
        .map(([key]) => key)

    return {
      preferredDays: sortByCount(dayCount).slice(0, 3),
      preferredTimes: sortByCount(hourCount).slice(0, 3).map(h => {
        const hour = parseInt(h)
        return `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
      }),
      averagePartySize: Math.round(totalPartySize / bookings.length),
      preferredTables: sortByCount(tablePrefs).slice(0, 3)
    }
  },

  // Calculate age from date of birth
  calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
    if (!dateOfBirth) return null

    const today = new Date()
    const birthDate = new Date(dateOfBirth)

    // Check if the date is valid
    if (isNaN(birthDate.getTime())) return null

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    // If we haven't reached the birthday this year, subtract 1
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    // Return null for negative ages (future dates) or unreasonable ages
    if (age < 0 || age > 150) return null

    return age
  },

  // Format age for display with "years old" suffix
  formatAge(dateOfBirth: string | Date | null | undefined): string | null {
    const age = this.calculateAge(dateOfBirth)
    if (age === null) return null
    return `${age} years old`
  }
}