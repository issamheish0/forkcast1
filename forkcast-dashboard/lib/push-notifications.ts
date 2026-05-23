// lib/push-notifications.ts
"use client"

export interface PushNotificationData {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  data?: any
}

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null
  private isSupported = false

  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('Push notifications not supported')
      return false
    }

    try {
      this.registration = await navigator.serviceWorker.ready
      console.log('Push notification manager initialized')
      return true
    } catch (error) {
      console.error('Failed to initialize push notifications:', error)
      return false
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      console.log('Push notifications not supported in this browser')
      return 'denied'
    }

    // Check if we're on HTTPS or localhost
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('Push notifications require HTTPS or localhost')
      alert('Push notifications require HTTPS. Please access the site via HTTPS.')
      return 'denied'
    }

    try {
      console.log('Requesting notification permission...')
      const permission = await Notification.requestPermission()
      console.log('Push notification permission result:', permission)
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted!')
      } else if (permission === 'denied') {
        console.log('❌ Notification permission denied by user')
        alert('Notification permission was denied. You can enable it in your browser settings.')
      } else {
        console.log('⏳ Notification permission request was dismissed')
      }
      
      return permission
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert('Failed to request notification permission: ' + errorMessage)
      return 'denied'
    }
  }

  async isPermissionGranted(): Promise<boolean> {
    if (!this.isSupported) {
      return false
    }

    const permission = Notification.permission
    console.log('Current notification permission:', permission)
    return permission === 'granted'
  }

  getCurrentPermission(): NotificationPermission {
    if (!this.isSupported) {
      return 'denied'
    }
    return Notification.permission
  }

  async sendNotification(data: PushNotificationData): Promise<void> {
    if (!this.registration || !await this.isPermissionGranted()) {
      console.log('Cannot send push notification - no permission or registration')
      return
    }

    try {
      await this.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/icon-192x192.png',
        data: {
          dateOfArrival: Date.now(),
          primaryKey: data.data?.id || '1',
          url: data.url || '/bookings',
          ...data.data
        },
        actions: [
          {
            action: 'view',
            title: 'View Details',
            icon: '/icon-192x192.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icon-192x192.png'
          }
        ]
      } as NotificationOptions)
    } catch (error) {
      console.error('Failed to send push notification:', error)
    }
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !await this.isPermissionGranted()) {
      return null
    }

    try {
      // Check if already subscribed
      let subscription = await this.registration.pushManager.getSubscription()
      if (subscription) {
        console.log('Already subscribed to push notifications')
        return subscription
      }

      // Get the VAPID public key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('VAPID public key not found')
        return null
      }

      // Create new subscription
      subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource
      })

      console.log('✅ Successfully subscribed to push notifications')
      return subscription
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      return null
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
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
}

export const pushNotificationManager = new PushNotificationManager()
