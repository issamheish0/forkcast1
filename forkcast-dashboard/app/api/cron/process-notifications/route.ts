import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notification-service'

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
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create service role client for cron job
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get pending notifications from outbox (both push and inapp)
    const BATCH_SIZE = 200
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_outbox')
      .select(`
        *,
        notification:notifications(*)
      `)
      .eq('status', 'queued')
      .lte('scheduled_for', new Date().toISOString())
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('Failed to fetch pending notifications:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending notifications'
      })
    }

    // Pre-fetch subscriptions for all users in this batch
    const userIds = [...new Set(pendingNotifications.map(n => n.user_id))]
    const { data: allSubscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id, restaurant_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (subError) {
      console.error('Failed to fetch subscriptions:', subError)
      // Continue but push notifications might fail
    }

    // Group subscriptions by user_id and restaurant_id for fast lookup
    const subMap = new Map<string, any[]>()
    allSubscriptions?.forEach(sub => {
      const key = `${sub.user_id}:${sub.restaurant_id}`
      if (!subMap.has(key)) {
        subMap.set(key, [])
      }
      subMap.get(key)?.push(sub)
    })

    // Process notifications in parallel
    const results = await Promise.all(pendingNotifications.map(async (notification) => {
      try {
        const restaurantId = notification.payload?.restaurant_id
        if (!restaurantId) {
          return { id: notification.id, status: 'failed', error: 'Missing restaurant_id' }
        }

        const resolvedBody = resolveNotificationBody(notification)
        const resolvedTitle = notification.title || notification.payload?.title || 'Notification'

        if (notification.channel === 'push') {
          const key = `${notification.user_id}:${restaurantId}`
          const subscriptions = subMap.get(key)

          if (!subscriptions || subscriptions.length === 0) {
            return { id: notification.id, status: 'skipped', error: 'No subscription' }
          }

          // Use the first active subscription
          const subscription = subscriptions[0]
          
          try {
            await notificationService.sendPushToSubscription(subscription, {
              title: resolvedTitle,
              body: resolvedBody || 'You have a new notification',
              type: notification.type,
              priority: notification.priority || 'normal',
              url: notification.payload?.url,
              data: notification.payload?.data || {}
            })
            return { id: notification.id, status: 'sent', body: resolvedBody }
          } catch (error: any) {
            return { id: notification.id, status: 'failed', error: error.message || 'Push failed' }
          }
        } else if (notification.channel === 'inapp') {
          return { id: notification.id, status: 'sent', body: resolvedBody }
        }

        return { id: notification.id, status: 'failed', error: 'Unknown channel' }
      } catch (error: any) {
        return { id: notification.id, status: 'failed', error: error.message }
      }
    }))

    // Bulk update results
    const updates = {
      sent: [] as string[],
      skipped: [] as string[],
      failed: [] as { id: string, error: string, attempts: number }[]
    }

    results.forEach((result, index) => {
      const original = pendingNotifications[index]
      if (result.status === 'sent') {
        updates.sent.push(result.id)
      } else if (result.status === 'skipped') {
        updates.skipped.push(result.id)
      } else {
        updates.failed.push({
          id: result.id,
          error: result.error || 'Unknown error',
          attempts: (original.attempts || 0) + 1
        })
      }
    })

    // Perform bulk updates
    const updatePromises = []

    if (updates.sent.length > 0) {
      updatePromises.push(
        supabase
          .from('notification_outbox')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString() 
          })
          .in('id', updates.sent)
      )
    }

    if (updates.skipped.length > 0) {
      updatePromises.push(
        supabase
          .from('notification_outbox')
          .update({ 
            status: 'skipped', 
            sent_at: new Date().toISOString(),
            error: 'No subscription'
          })
          .in('id', updates.skipped)
      )
    }

    // Failed updates must be done individually or grouped by error/attempts
    // For simplicity/performance, we'll just update them individually for now as failures should be rare
    // Or we could group them, but let's just do Promise.all for failures
    if (updates.failed.length > 0) {
      updatePromises.push(
        ...updates.failed.map(f => 
          supabase
            .from('notification_outbox')
            .update({ 
              status: f.attempts < 3 ? 'queued' : 'failed',
              attempts: f.attempts,
              error: f.error
            })
            .eq('id', f.id)
        )
      )
    }

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      processed: updates.sent.length + updates.skipped.length,
      failed: updates.failed.length,
      total: pendingNotifications.length
    })
  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}