// components/tier-redirect.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function TierRedirect() {
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkTierAndRedirect() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // Get user's restaurant tier
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select(`
            restaurant:restaurants(
              tier
            )
          `)
          .eq("user_id", user.id)
          .single()

        if (!staffData) {
          router.push('/login')
          return
        }

        // Handle both array and object formats from Supabase
        const restaurant = Array.isArray(staffData.restaurant) 
          ? staffData.restaurant[0] 
          : staffData.restaurant
        
        const tier = restaurant?.tier

        if (tier === 'basic') {
          router.push('/bookings')
        } else {
          router.push('/bookings')
        }

      } catch (error) {
        console.error('Error checking tier:', error)
        router.push('/login')
      } finally {
        setIsChecking(false)
      }
    }

    checkTierAndRedirect()
  }, [router, supabase])

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
          <p className="text-lg font-medium">Checking access...</p>
        </div>
      </div>
    )
  }

  return null
}

export default TierRedirect
