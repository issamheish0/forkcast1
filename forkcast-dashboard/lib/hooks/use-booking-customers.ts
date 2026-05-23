// lib/hooks/use-booking-customers.ts
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking } from '@/types'
import type { RestaurantCustomer } from '@/types/customer'

export interface BookingCustomerData {
  [bookingId: string]: {
    customer: RestaurantCustomer | null
    hasImportantNotes: boolean
    hasDietaryRestrictions: boolean
    isVip: boolean
    isBlacklisted: boolean
    tagCount: number
    userRating: number | null
  }
}

export function useBookingCustomers(bookings: Booking[], restaurantId: string) {
  const [customerData, setCustomerData] = useState<BookingCustomerData>({})
  const [loading, setLoading] = useState(false)
  
  const supabase = createClient()

  const loadCustomerData = useCallback(async () => {
    try {
      setLoading(true)
      const result: BookingCustomerData = {}

      // Group bookings by user_id and guest_email to avoid duplicate queries
      const userIds = [...new Set(bookings.filter(b => b.user_id).map(b => b.user_id!))]
      const guestEmails = [...new Set(bookings.filter(b => !b.user_id && b.guest_email).map(b => b.guest_email!))]

      // Fetch customers by user_id
      if (userIds.length > 0) {
        const { data: userCustomers } = await supabase
          .from('restaurant_customers')
          .select(`
            *,
            profile:profiles(full_name, allergies, dietary_restrictions, user_rating),
            tags:customer_tag_assignments(tag:customer_tags(*)),
            notes:customer_notes(is_important, category)
          `)
          .eq('restaurant_id', restaurantId)
          .in('user_id', userIds)

        // Map user customers to bookings
        userCustomers?.forEach(customer => {
          const relatedBookings = bookings.filter(b => b.user_id === customer.user_id)
          relatedBookings.forEach(booking => {
            result[booking.id] = {
              customer,
              hasImportantNotes: customer.notes?.some((n: any) => n.is_important) || false,
              hasDietaryRestrictions: !!(
                customer.profile?.allergies?.length ||
                customer.profile?.dietary_restrictions?.length ||
                customer.notes?.some((n: any) => n.category === 'dietary')
              ),
              isVip: customer.vip_status || false,
              isBlacklisted: customer.blacklisted || false,
              tagCount: customer.tags?.length || 0,
              userRating: customer.profile?.user_rating || null
            }
          })
        })
      }

      // Fetch customers by guest_email
      if (guestEmails.length > 0) {
        const { data: guestCustomers } = await supabase
          .from('restaurant_customers')
          .select(`
            *,
            tags:customer_tag_assignments(tag:customer_tags(*)),
            notes:customer_notes(is_important, category)
          `)
          .eq('restaurant_id', restaurantId)
          .in('guest_email', guestEmails)

        // Map guest customers to bookings
        guestCustomers?.forEach(customer => {
          const relatedBookings = bookings.filter(b => !b.user_id && b.guest_email === customer.guest_email)
          relatedBookings.forEach(booking => {
            result[booking.id] = {
              customer,
              hasImportantNotes: customer.notes?.some((n: any) => n.is_important) || false,
              hasDietaryRestrictions: customer.notes?.some((n: any) => n.category === 'dietary') || false,
              isVip: customer.vip_status || false,
              isBlacklisted: customer.blacklisted || false,
              tagCount: customer.tags?.length || 0,
              userRating: customer.profile?.user_rating || null
            }
          })
        })
      }

      // For bookings without customer data, set default values
      bookings.forEach(booking => {
        if (!result[booking.id]) {
          result[booking.id] = {
            customer: null,
            hasImportantNotes: false,
            hasDietaryRestrictions: false,
            isVip: false,
            isBlacklisted: false,
            tagCount: 0,
            userRating: null
          }
        }
      })

      setCustomerData(result)
    } catch (error) {
      console.error('Error loading customer data:', error)
    } finally {
      setLoading(false)
    }
  }, [bookings, restaurantId, supabase])

  useEffect(() => {
    if (bookings.length > 0 && restaurantId) {
      loadCustomerData()
    }
  }, [bookings, restaurantId, loadCustomerData])

  return { customerData, loading, refetch: loadCustomerData }
}