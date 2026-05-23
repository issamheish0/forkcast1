"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { pushNotificationManager, PushNotificationData } from '@/lib/push-notifications'
import { bookingAlarmService } from '@/lib/services/booking-alarm-service'

export interface Notification {
  id: string
  type: 'booking' | 'order' | 'general'
  title: string
  message: string
  timestamp: Date
  data?: any
  variant?: 'success' | 'error' | 'info' | 'warning'
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
  playNotificationSound: (type: 'booking' | 'order' | 'general', variant?: 'success' | 'error' | 'info' | 'warning') => void
  requestPushPermission: () => Promise<boolean>
  isPushEnabled: boolean
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isPushEnabled, setIsPushEnabled] = useState(false)

  // Initialize push notifications
  useEffect(() => {
    const initPush = async () => {
      const initialized = await pushNotificationManager.initialize()
      if (initialized) {
        const hasPermission = await pushNotificationManager.isPermissionGranted()
        setIsPushEnabled(hasPermission)
      }
    }
    initPush()
  }, [])

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    const permission = await pushNotificationManager.requestPermission()
    const granted = permission === 'granted'
    setIsPushEnabled(granted)

    if (granted) {
      // Create push subscription and save to database
      try {
        const subscription = await pushNotificationManager.subscribeToPush()
        if (subscription) {
          // Save subscription to database via API
          const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              deviceInfo: {
                browser: navigator.userAgent,
                device: navigator.platform
              }
            })
          })

          if (!response.ok) {
            console.error('Failed to save push subscription to database')
          } else {
            console.log('✅ Push subscription saved to database')
          }
        }
      } catch (error) {
        console.error('Failed to create push subscription:', error)
      }
    }

    return granted
  }, [])

  const playNotificationSound = useCallback((type: 'booking' | 'order' | 'general', variant?: 'success' | 'error' | 'info' | 'warning') => {
    try {
      const audio = new Audio()
      let soundPath = ''
      
      // Use different sounds based on type and variant
      if (type === 'booking') {
        if (variant === 'error') {
          // Cancelled/declined bookings
          soundPath = '/sounds/cancel-notification.mp3'
        } else if (variant === 'success') {
          // Confirmed/accepted bookings
          soundPath = '/sounds/accept-notification.mp3'
        } else {
          // New bookings (no variant) and other booking notifications
          soundPath = '/sounds/booking-notification.mp3'
        }
      } else {
        switch (type) {
          case 'order':
            soundPath = '/sounds/notification-update.mp3'
            break
          case 'general':
            soundPath = '/sounds/notification-new.mp3'
            break
        }
      }
      
      audio.src = soundPath
      audio.volume = 0.8 // Set volume to 80%
      audio.play().catch(() => {})
    } catch (error) {
      
    }
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {

    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date()
    }
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev]
 
      return updated
    })
    
    // Play sound for booking notifications
    if (notification.type === 'booking') {
      if (!notification.variant && notification.data?.id && notification.data?.status === 'pending') {
        // New pending booking — start persistent looping alarm
        bookingAlarmService.startAlarm(notification.data.id)
      } else {
        // Status change (confirmed, cancelled, etc.) — play one-shot sound
        playNotificationSound('booking', notification.variant)
      }
    }

    // Send push notification if enabled (fire and forget)
    if (isPushEnabled) {
     
      const pushData: PushNotificationData = {
        title: notification.title,
        body: notification.message,
        icon: '/icon-192x192.png',
        url: '/bookings',
        data: notification.data
      }
      pushNotificationManager.sendNotification(pushData).catch(error => {
        console.error('Failed to send push notification:', error)
      })
    }
  }, [playNotificationSound, isPushEnabled])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Unlock audio on first user interaction (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      bookingAlarmService.unlockAudio()
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  // Listen for PLAY_ALARM from service worker (push notification path)
  // SW sends: { type: 'PLAY_ALARM', data: pushPayload, timestamp }
  // The booking ID lives in the push payload at data.booking_id or data.bookingId
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_ALARM') {
        const pushData = event.data?.data
        const bookingId = pushData?.booking_id || pushData?.bookingId || pushData?.id
        if (bookingId) {
          bookingAlarmService.startAlarm(bookingId)
        } else {
          // Push arrived but no booking ID — start alarm with a fallback ID
          // so the alarm rings until staff checks the dashboard
          bookingAlarmService.startAlarm(`push-${Date.now()}`)
        }
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // Re-acquire wake lock when tab becomes visible again
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        bookingAlarmService.reacquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Auto-remove notifications after 10 seconds. Returning the previous
  // reference when nothing has expired prevents unnecessary 1Hz context
  // re-renders for every consumer (including admin pages where there are
  // typically zero notifications).
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifications(prev => {
        if (prev.length === 0) return prev
        const cutoff = Date.now() - 10000
        const next = prev.filter(n => n.timestamp.getTime() >= cutoff)
        return next.length === prev.length ? prev : next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
        playNotificationSound,
        requestPushPermission,
        isPushEnabled
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  
  // Debug logging
 
  
  return context
}
