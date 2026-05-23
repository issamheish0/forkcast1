'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'

const CHECK_INTERVAL = 30000 // 30 seconds
const SUBSCRIPTION_REFRESH_INTERVAL = 3600000 // 1 hour

export function NotificationManager() {
  const { currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [lastCheck, setLastCheck] = useState(Date.now())
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // Initialize service worker and notifications
  const initialize = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported')
      return
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      })
      
      swRegistrationRef.current = registration
      console.log('Service worker registered')

      // Check for updates immediately
      await registration.update()

      // Send message to start background tasks
      if (registration.active) {
        registration.active.postMessage({
          type: 'START_BACKGROUND_TASKS'
        })
      }

      // Check notification permission
      if (Notification.permission === 'granted') {
        await ensureSubscription()
      } else if (Notification.permission === 'default') {
        // Request permission after a delay
        setTimeout(() => requestPermission(), 3000)
      }

      // Start checking for notifications
      startNotificationChecking()
      
      // Start subscription refresh
      startSubscriptionRefresh()

    } catch (error) {
      console.error('Failed to initialize notifications:', error)
    }
  }, [])

  // Ensure push subscription exists
  const ensureSubscription = useCallback(async () => {
    if (!swRegistrationRef.current || !currentRestaurant?.restaurant?.id) return

    try {
      let subscription = await swRegistrationRef.current.pushManager.getSubscription()

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          console.warn('VAPID public key not configured; skipping push subscription')
          return
        }
        // Create new subscription
        subscription = await swRegistrationRef.current.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
        })
      }

      // Save to database
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          restaurantId: currentRestaurant.restaurant.id
        })
      })

      if (response.ok) {
        setIsSubscribed(true)
        console.log('Push subscription saved')
      }

    } catch (error) {
      console.error('Failed to ensure subscription:', error)
    }
  }, [currentRestaurant?.restaurant?.id])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        await ensureSubscription()
        toast.success('Notifications enabled!')
      }
    } catch (error) {
      console.error('Failed to request permission:', error)
    }
  }, [ensureSubscription])

  // Check for pending notifications
  const checkNotifications = useCallback(async () => {
    if (!isSubscribed) return

    try {
      const response = await fetch('/api/notifications/check-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: Date.now(),
          source: 'frontend'
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.notifications && data.notifications.length > 0) {
          console.log(`Found ${data.notifications.length} pending notifications`)
          
          // Send to service worker to display
          if (swRegistrationRef.current?.active) {
            swRegistrationRef.current.active.postMessage({
              type: 'DISPLAY_NOTIFICATIONS',
              notifications: data.notifications
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to check notifications:', error)
    }

    setLastCheck(Date.now())
  }, [isSubscribed])

  // Start periodic notification checking
  const startNotificationChecking = useCallback(() => {
    // Clear existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    // Check immediately
    checkNotifications()

    // Set up interval
    checkIntervalRef.current = setInterval(() => {
      checkNotifications()
    }, CHECK_INTERVAL)
  }, [checkNotifications])

  // Start periodic subscription refresh
  const startSubscriptionRefresh = useCallback(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    // Set up interval
    refreshIntervalRef.current = setInterval(() => {
      ensureSubscription()
    }, SUBSCRIPTION_REFRESH_INTERVAL)
  }, [ensureSubscription])

  // Initialize on mount
  useEffect(() => {
    initialize()

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [initialize])

  // Re-initialize when restaurant changes
  useEffect(() => {
    if (currentRestaurant?.restaurant?.id) {
      ensureSubscription()
    }
  }, [currentRestaurant?.restaurant?.id, ensureSubscription])

  // Listen for visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App became visible - check notifications
        checkNotifications()
        
        // Update service worker
        if (swRegistrationRef.current?.active) {
          swRegistrationRef.current.active.postMessage({
            type: 'CHECK_NOTIFICATIONS'
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkNotifications])

  // Listen for online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online - checking notifications')
      checkNotifications()
      ensureSubscription()
    }

    window.addEventListener('online', handleOnline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [checkNotifications, ensureSubscription])

  return null // This is a background component
}

// Helper function
function urlBase64ToUint8Array(base64String?: string): Uint8Array {
  if (!base64String || typeof base64String !== 'string') {
    return new Uint8Array()
  }
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
