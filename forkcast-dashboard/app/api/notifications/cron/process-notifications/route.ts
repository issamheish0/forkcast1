import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NotificationService } from '@/lib/services/notification-service'
import webpush from 'web-push'

const CRON_SECRET = process.env.CRON_SECRET || 'rbs-restaurant-cron-2025-secure-key-x7n9m4p8q2L'

// Configure web push only if VAPID keys are available
let isPushConfigured = false
try {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@rbs-restaurant.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    isPushConfigured = true
  } else {
    console.warn('⚠️ Web Push not configured - missing VAPID keys')
  }
} catch (error) {
  console.warn('⚠️ Web Push not configured:', error)
}

const resolveNotificationBody = (notification: any): string => {
  const candidates = [
    notification?.body,
    notification?.payload?.body,
    notification?.payload?.message,
    notification?.payload?.content,
    notification?.payload?.text
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return ''
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const notificationService = new NotificationService()

    // Get ALL queued notifications (not just 50)
    const { data: notifications, error } = await supabase
      .from('notification_outbox')
      .select('*')
      .in('status', ['queued', 'failed']) // Include failed for retry
      .lt('retry_count', 5) // Max 5 retries
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch notifications:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: 0,
        total: 0
      })
    }

    console.log(`📊 Processing ${notifications.length} notifications`)

    let processed = 0
    let failed = 0
    let skipped = 0

    // Process each notification
    for (const notification of notifications) {
      try {
        const restaurantId = notification.payload?.restaurant_id

        if (!restaurantId) {
          await supabase
            .from('notification_outbox')
            .update({
              status: 'failed',
              error: 'Missing restaurant_id',
              retry_count: 99 // Don't retry
            })
            .eq('id', notification.id)
          failed++
          continue
        }

        const resolvedBody = resolveNotificationBody(notification)
        const resolvedTitle = notification.title || notification.payload?.title || 'New Notification'

        if (notification.channel === 'push') {
          // Check if VAPID keys are configured
          if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.warn('Push notifications disabled: VAPID keys not configured')
            await supabase
              .from('notification_outbox')
              .update({
                status: 'skipped',
                sent_at: new Date().toISOString(),
                error: 'VAPID keys not configured'
              })
              .eq('id', notification.id)
            skipped++
            continue
          }

          // Get ALL subscriptions for this user (handle multiple devices)
          const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', notification.user_id)
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)

          if (subError) {
            console.error(`Error fetching subscriptions:`, subError)
            await supabase
              .from('notification_outbox')
              .update({
                status: 'failed',
                error: subError.message,
                retry_count: (notification.retry_count || 0) + 1
              })
              .eq('id', notification.id)
            failed++
            continue
          }

          if (!subscriptions || subscriptions.length === 0) {
            // No subscriptions - mark as skipped
            await supabase
              .from('notification_outbox')
              .update({
                status: 'skipped',
                sent_at: new Date().toISOString()
              })
              .eq('id', notification.id)
            skipped++
            continue
          }

          // Try to send to ALL subscriptions
          let anySent = false
          const errors = []

          for (const subscription of subscriptions) {
            try {
              const payload = {
                title: resolvedTitle,
                body: resolvedBody || 'You have a new notification',
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                data: {
                  notification_id: notification.id,
                  url: notification.payload?.url || '/bookings',
                  booking_id: notification.payload?.booking_id,
                  restaurant_id: restaurantId,
                  type: notification.type,
                  ...notification.payload
                },
                tag: notification.payload?.booking_id 
                  ? `booking-${notification.payload.booking_id}` 
                  : `notif-${notification.id}`,
                priority: notification.priority || 'normal'
              }

              await webpush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth
                  }
                },
                JSON.stringify(payload),
                {
                  urgency: notification.priority === 'high' ? 'high' : 'normal',
                  TTL: 86400, // 24 hours
                  topic: notification.type || 'general'
                }
              )

              anySent = true
              console.log(`✅ Sent to device: ${subscription.id}`)

              // Update last_used
              await supabase
                .from('push_subscriptions')
                .update({ 
                  last_used: new Date().toISOString(),
                  last_seen: new Date().toISOString()
                })
                .eq('id', subscription.id)

            } catch (error: any) {
              console.error(`Failed to send to device ${subscription.id}:`, error.message)
              errors.push(error.message)

              // Handle expired subscription (410 Gone)
              if (error.statusCode === 410 || error.statusCode === 404) {
                await supabase
                  .from('push_subscriptions')
                  .update({ is_active: false })
                  .eq('id', subscription.id)
              }
            }
          }

          // Update notification status based on results
          if (anySent) {
            await supabase
              .from('notification_outbox')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                attempts: (notification.attempts || 0) + 1,
                body: resolvedBody || 'You have a new notification'
              })
              .eq('id', notification.id)
            processed++
          } else {
            await supabase
              .from('notification_outbox')
              .update({
                status: 'failed',
                error: errors.join('; '),
                retry_count: (notification.retry_count || 0) + 1,
                attempts: (notification.attempts || 0) + 1
              })
              .eq('id', notification.id)
            failed++
          }

        } else if (notification.channel === 'inapp') {
          // Handle in-app notifications
          const { error: insertError } = await supabase
            .from('notifications')
            .insert({
              user_id: notification.user_id,
              title: resolvedTitle,
              message: resolvedBody || 'You have a new notification',
              type: notification.type,
              data: notification.payload,
              restaurant_id: restaurantId,
              is_read: false,
              created_at: new Date().toISOString()
            })

          if (!insertError) {
            await supabase
              .from('notification_outbox')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                body: resolvedBody || 'You have a new notification'
              })
              .eq('id', notification.id)
            processed++
          } else {
            await supabase
              .from('notification_outbox')
              .update({
                status: 'failed',
                error: insertError.message,
                retry_count: (notification.retry_count || 0) + 1
              })
              .eq('id', notification.id)
            failed++
          }
        }
      } catch (error) {
        console.error(`Failed processing notification ${notification.id}:`, error)
        failed++
      }
    }

    console.log(`✅ Processed: ${processed}, ❌ Failed: ${failed}, ⏭️ Skipped: ${skipped}`)

    return NextResponse.json({
      success: true,
      processed,
      failed,
      skipped,
      total: notifications.length
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}