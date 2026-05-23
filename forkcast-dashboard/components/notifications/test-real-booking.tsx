"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function TestRealBooking() {
  const [isCreating, setIsCreating] = useState(false)
  const supabase = createClient()

  const createTestBooking = async () => {
    setIsCreating(true)
    try {
      console.log('🧪 Creating test booking in database...')
      
      // Get restaurant ID from localStorage
      const restaurantId = localStorage.getItem('selected-restaurant-id')
      console.log('🧪 Restaurant ID from localStorage:', restaurantId)
      
      // Also check other possible keys
      const allKeys = Object.keys(localStorage)
      console.log('🧪 All localStorage keys:', allKeys)
      
      // Look for any restaurant-related keys
      const restaurantKeys = allKeys.filter(key => key.toLowerCase().includes('restaurant'))
      console.log('🧪 Restaurant-related keys:', restaurantKeys)
      
      if (!restaurantId) {
        console.error('❌ No restaurant ID found in localStorage')
        console.log('❌ Available keys:', allKeys)
        alert(`No restaurant ID found. Available keys: ${allKeys.join(', ')}`)
        return
      }

      console.log('🧪 Using restaurant ID:', restaurantId)

      // Try to get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('🧪 Current user:', user)
      console.log('🧪 User error:', userError)
      
      if (!user) {
        console.error('❌ No authenticated user found')
        alert('No authenticated user found. Please log in first.')
        return
      }

      // Create a test booking
      const now = new Date()
      const bookingTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow at same time
      
      const testBooking = {
        restaurant_id: restaurantId,
        user_id: user.id, // Use authenticated user ID
        guest_name: `Test Guest ${Date.now()}`,
        guest_phone: '+1234567890',
        guest_email: 'test@example.com',
        party_size: Math.floor(Math.random() * 8) + 1,
        booking_time: bookingTime.toISOString(),
        status: 'pending',
        special_requests: 'This is a test booking created by the debug system',
        turn_time_minutes: 120
      }

      console.log('🧪 Test booking data:', testBooking)

      const { data, error } = await supabase
        .from('bookings')
        .insert([testBooking])
        .select()

      if (error) {
        console.error('❌ Error creating test booking:', error)
        alert(`Error creating test booking: ${error.message}`)
      } else {
        console.log('✅ Test booking created successfully:', data)
        alert('Test booking created! You should see a notification appear.')
      }
    } catch (error) {
      console.error('❌ Error creating test booking:', error)
      alert(`Error creating test booking: ${error}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg border max-w-sm">
      <div className="space-y-2">
        <div className="text-sm font-medium">Test Real Booking</div>
        <div className="text-xs text-gray-500">
          Creates a real booking in database
        </div>
        <Button
          onClick={createTestBooking}
          disabled={isCreating}
          size="sm"
          className="w-full"
        >
          {isCreating ? 'Creating...' : 'Create Test Booking'}
        </Button>
      </div>
    </div>
  )
}
