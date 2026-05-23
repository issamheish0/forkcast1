// lib/services/notification-service.ts
import { SupabaseClient, createClient as createSupabaseClient } from '@supabase/supabase-js'
import webpush, { SendResult } from 'web-push'
import { getFirstName } from '@/lib/utils'

// Types
export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  type?: string
  priority?: 'high' | 'normal' | 'low'
  data?: Record<string, any>
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

interface PushSubscriptionData {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  user_id: string
  restaurant_id: string
  is_active: boolean
}

// Configure web-push with VAPID details
const configurePush = () => {
  if (!process.env.VAPID_PRIVATE_KEY || 
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
      !process.env.VAPID_EMAIL) {
    console.warn('⚠️ Web Push not configured - missing VAPID keys');
    return false;
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  } catch (error) {
    console.error('Failed to configure web push:', error);
    return false;
  }
};

const isPushConfigured = configurePush();

export class NotificationService {
  private supabase: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  /**
   * Subscribe a device to push notifications
   */
  async subscribe(
    restaurantId: string,
    userId: string,
    subscription: PushSubscriptionJSON,
    deviceInfo?: {
      browser?: string
      device?: string
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!subscription.endpoint || !subscription.keys) {
        return { success: false, error: 'Invalid subscription data' }
      }

      const { p256dh, auth } = subscription.keys
      if (!p256dh || !auth) {
        return { success: false, error: 'Missing subscription keys' }
      }

      // Check if subscription already exists
      const { data: existing } = await this.supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .single()

      if (existing) {
        // Update existing subscription
        const { error: updateError } = await this.supabase
          .from('push_subscriptions')
          .update({
            restaurant_id: restaurantId,
            user_id: userId,
            p256dh,
            auth,
            browser: deviceInfo?.browser || 'unknown',
            device_type: deviceInfo?.device || 'unknown',
            is_active: true,
            last_used: new Date().toISOString()
          })
          .eq('endpoint', subscription.endpoint)

        if (updateError) {
          console.error('Failed to update subscription:', updateError)
          return { success: false, error: updateError.message }
        }
      } else {
        // Create new subscription
        const { error: insertError } = await this.supabase
          .from('push_subscriptions')
          .insert({
            restaurant_id: restaurantId,
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            browser: deviceInfo?.browser || 'unknown',
            device_type: deviceInfo?.device || 'unknown',
            is_active: true
          })

        if (insertError) {
          console.error('Failed to save subscription:', insertError)
          return { success: false, error: insertError.message }
        }
      }


      
      return { success: true }
    } catch (error: any) {
      console.error('Failed to save subscription:', error)
      return { 
        success: false, 
        error: error.message || 'Failed to subscribe to notifications' 
      }
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(endpoint: string): Promise<{ success: boolean }> {
    try {
      const { error } = await this.supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', endpoint)

      if (error) {
        console.error('Failed to unsubscribe:', error)
        return { success: false }
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
      return { success: false }
    }
  }

  /**
   * Send notification to all restaurant staff
   */
  async sendToRestaurant(
    restaurantId: string,
    notification: NotificationPayload
  ): Promise<{ 
    success: boolean
    sent: number
    failed: number
    error?: string 
  }> {
    if (!isPushConfigured) {
      console.warn('Push notifications not configured');
      return { success: false, sent: 0, failed: 0, error: 'Not configured' }
    }

    try {
      // Check notification preferences
      const shouldSend = await this.checkNotificationPreferences(
        restaurantId, 
        notification.type || 'general'
      )
      
      if (!shouldSend) {
        return { success: true, sent: 0, failed: 0, error: 'Blocked by preferences' }
      }

      // First get all active staff for this restaurant
      const { data: activeStaff, error: staffError } = await this.supabase
        .from('restaurant_staff')
        .select('user_id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

      if (staffError) {
        console.error('Failed to fetch active staff:', staffError)
        return { success: false, sent: 0, failed: 0, error: staffError.message }
      }

      if (!activeStaff || activeStaff.length === 0) {
        return { success: true, sent: 0, failed: 0, error: 'No active staff found' }
      }

      const activeStaffIds = activeStaff.map(s => s.user_id)

      // Get push subscriptions for active staff members
      const { data: subscriptions, error: subError } = await this.supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, user_id, restaurant_id, is_active')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .in('user_id', activeStaffIds)

      if (subError) {
        console.error('Failed to fetch subscriptions:', subError)
        return { success: false, sent: 0, failed: 0, error: subError.message }
      }

      if (!subscriptions || subscriptions.length === 0) {
        return { success: true, sent: 0, failed: 0, error: 'No push subscriptions for active staff' }
      }

      const validSubscriptions = subscriptions

      // Create notification record
      let notificationId = null
      if (notification.type && notification.type !== 'test') {
        const { data: notificationRecord, error: notificationError } = await this.supabase
          .from('notifications')
          .insert({
            user_id: validSubscriptions[0].user_id, // Use first user for record keeping
            type: notification.type,
            title: notification.title,
            message: notification.body,
            data: notification.data,
            category: 'system'
          })
          .select('id')
          .single()

        if (!notificationError && notificationRecord) {
          notificationId = notificationRecord.id
        }
      }

      // Send notifications
      const results = await Promise.allSettled(
        validSubscriptions.map(sub =>
          this.sendPushNotification(sub as any, notification)
        )
      )

      // Count results
      let sent = 0
      let failed = 0

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sent++
        } else {
          failed++
          console.error(`Failed to send to ${validSubscriptions[index].endpoint}:`, result.reason)

          // Handle failed subscriptions
          this.handleFailedSubscription(validSubscriptions[index] as any, result.reason)
        }
      })

      // Log notification history
      if (notificationId) {
        await this.logNotificationHistory(notificationId, restaurantId, validSubscriptions as any, results)
      }

      return { success: true, sent, failed }
    } catch (error: any) {
      console.error('Failed to send notifications:', error)
      return { 
        success: false, 
        sent: 0, 
        failed: 0, 
        error: error.message 
      }
    }
  }

  /**
   * Send push notification to specific subscription
   */
  private async sendPushNotification(
    subscription: PushSubscriptionData,
    payload: NotificationPayload
  ): Promise<SendResult> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    }

    try {
      const result = await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/icon-192x192.png',
          tag: payload.tag,
          data: {
            url: payload.url || '/bookings',
            type: payload.type,
            priority: payload.priority,
            ...payload.data
          },
          actions: payload.actions || [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        })
      )

      return result
    } catch (error: any) {
      // Handle expired subscriptions (410 Gone)
      if (error.statusCode === 410) {
        await this.handleFailedSubscription(subscription, error)
      }
      throw error
    }
  }



  /**
   * Check if notification should be sent based on preferences
   */
  private async checkNotificationPreferences(
    restaurantId: string,
    notificationType: string
  ): Promise<boolean> {
    // Check quiet hours
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const { data: preferences } = await this.supabase
      .from('restaurant_notification_preferences')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single()

    if (!preferences) return true // Default to sending if no preferences

    // Check quiet hours
    if (preferences.quiet_hours_start && preferences.quiet_hours_end) {
      const start = preferences.quiet_hours_start
      const end = preferences.quiet_hours_end
      
      if (start <= end) {
        // Same day quiet hours
        if (currentTime >= start && currentTime <= end) {
          return false
        }
      } else {
        // Overnight quiet hours (e.g., 22:00 to 08:00)
        if (currentTime >= start || currentTime <= end) {
          return false
        }
      }
    }

    // Check notification type preferences
    const typeMap: Record<string, string> = {
      'new_booking': 'new_bookings',
      'booking_cancelled': 'cancellations',
      'booking_modified': 'modifications',
      'waitlist_update': 'waitlist_updates',
      'table_ready': 'table_ready',
      'order_update': 'order_updates'
    }

    const prefKey = typeMap[notificationType]
    if (prefKey && preferences[prefKey] === false) {
      return false
    }

    return true
  }

  /**
   * Handle failed subscription
   */
  private async handleFailedSubscription(
    subscription: PushSubscriptionData,
    error: any
  ): Promise<void> {
    if (error.statusCode === 410) {
      // Subscription expired - deactivate it
      await this.supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscription.id)
    }
  }

  /**
   * Log notification history
   */
  private async logNotificationHistory(
    notificationId: string,
    restaurantId: string,
    subscriptions: PushSubscriptionData[],
    results: PromiseSettledResult<any>[]
  ): Promise<void> {
    const historyEntries = subscriptions.map((sub, index) => ({
      notification_id: notificationId,
      user_id: sub.user_id,
      restaurant_id: restaurantId,
      delivered: results[index].status === 'fulfilled',
      delivered_at: results[index].status === 'fulfilled' ? new Date().toISOString() : null
    }))

    await this.supabase
      .from('notification_history')
      .insert(historyEntries)
  }

  /**
   * Notification methods for specific events
   */
  async notifyNewBooking(booking: any) {
    const time = new Date(booking.booking_time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })

    return this.sendToRestaurant(booking.restaurant_id, {
      title: 'New Booking Request 📅',
      body: `${getFirstName(booking.guest_name || 'Guest')} wants to book for ${booking.party_size} people at ${time}`,
      type: 'new_booking',
      priority: 'high',
      url: `/bookings/${booking.id}`,
      data: {
        booking_id: booking.id,
        party_size: booking.party_size,
        booking_time: booking.booking_time
      },
      actions: [
        { action: 'view', title: 'View Booking' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  }

  async notifyBookingCancellation(booking: any) {
    const time = new Date(booking.booking_time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })

    return this.sendToRestaurant(booking.restaurant_id, {
      title: 'Booking Cancelled ❌',
      body: `${getFirstName(booking.guest_name || 'Guest')} cancelled their booking for ${booking.party_size} people at ${time}`,
      type: 'booking_cancelled',
      priority: 'normal',
      url: `/bookings/${booking.id}`,
      data: {
        booking_id: booking.id
      }
    })
  }

  async notifyWaitlistUpdate(waitlistEntry: any) {
    return this.sendToRestaurant(waitlistEntry.restaurant_id, {
      title: 'New Waitlist Entry 📋',
      body: `${getFirstName(waitlistEntry.guest_name || 'Guest')} joined the waitlist for ${waitlistEntry.party_size} people`,
      type: 'waitlist_update',
      priority: 'normal',
      url: `/waitlist`,
      data: {
        waitlist_id: waitlistEntry.id,
        party_size: waitlistEntry.party_size
      }
    })
  }

  /**
   * Send push notification to a single subscription
   */
  async sendPushToSubscription(subscription: any, payload: NotificationPayload) {
    if (!webpush) {
      throw new Error('Web push not configured')
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    }

    try {
      const result = await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/icon-192x192.png',
          tag: payload.tag,
          data: {
            url: payload.url || '/bookings',
            type: payload.type,
            priority: payload.priority,
            ...payload.data
          },
          actions: payload.actions || [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        })
      )

      return result
    } catch (error: any) {
      console.error('Push notification failed:', error)
      throw error
    }
  }

  /**
   * Helper methods
   */
  private detectBrowser(): string {
    if (typeof window === 'undefined') return 'unknown'
    
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Other'
  }

  private detectDevice(): string {
    if (typeof window === 'undefined') return 'unknown'
    
    const userAgent = navigator.userAgent
    if (/Android/i.test(userAgent)) return 'Android'
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS'
    if (/Windows/i.test(userAgent)) return 'Windows'
    if (/Mac/i.test(userAgent)) return 'macOS'
    return 'Other'
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
