'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function AppVisibilityHandler() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleAppVisible = () => {
      console.log('🔄 App became visible - refreshing critical data')
      
      // Invalidate and refetch critical queries
      const criticalQueries = [
        'kitchen-orders',
        'all-bookings', 
        'displayed-bookings',
        'table-stats',
        'waitlist',
        'realtime-tables',
        'customer-data'
      ]
      
      criticalQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] })
      })
      
      // Force refetch of the most critical data immediately
      queryClient.refetchQueries({ 
        queryKey: ['kitchen-orders'],
        type: 'active'
      })
      
      queryClient.refetchQueries({ 
        queryKey: ['all-bookings'],
        type: 'active'
      })
    }

    // Listen for custom app visibility events
    window.addEventListener('appVisible', handleAppVisible)
    
    // Also handle direct visibility changes as a fallback
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Small delay to ensure the app is fully active
        setTimeout(handleAppVisible, 100)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('appVisible', handleAppVisible)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  return null // This component doesn't render anything
}
