import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get restaurant_id from staff record
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Staff access required' },
        { status: 403 }
      )
    }

    // Get any queued notifications for this user
    const { data: queuedNotifications, error: queueError } = await supabase
      .from('notification_outbox')
      .select(`
        id,
        payload,
        created_at,
        status,
        notification:notifications(title, message, type, data)
      `)
      .eq('user_id', user.id)
      .eq('status', 'queued')
      .eq('channel', 'push')
      .order('created_at', { ascending: true })
      .limit(10)

    if (queueError) {
      console.error('Failed to fetch queued notifications:', queueError)
      return NextResponse.json(
        { error: 'Failed to sync notifications' },
        { status: 500 }
      )
    }

    // Format notifications for the service worker
    const notifications = queuedNotifications?.map(item => {
      const notif = item.notification as any
      return {
        id: item.id,
        title: notif?.title || 'Notification',
        body: notif?.message || 'You have a new notification',
        data: {
          ...(notif?.data || {}),
          type: notif?.type,
          url: (item.payload as any)?.url || '/bookings',
          timestamp: item.created_at
        }
      }
    }) || []

    // Mark these notifications as sent (since we're delivering them now)
    if (notifications.length > 0) {
      const notificationIds = queuedNotifications?.map(n => n.id) || []
      await supabase
        .from('notification_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .in('id', notificationIds)
    }

    return NextResponse.json({
      success: true,
      notifications,
      synced: notifications.length,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Notification sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get notification count for this user
    const { count, error: countError } = await supabase
      .from('notification_outbox')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('status', 'queued')
      .eq('channel', 'push')

    if (countError) {
      console.error('Failed to count notifications:', countError)
      return NextResponse.json(
        { error: 'Failed to check notifications' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pendingCount: count || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Notification check error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}