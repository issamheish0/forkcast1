import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

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

    // Get new notifications created in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: newNotifications, error: notificationError } = await supabase
      .from('notification_outbox')
      .select(`
        id,
        payload,
        created_at,
        notification:notifications(title, message, type, data)
      `)
      .eq('user_id', user.id)
      .eq('status', 'queued')
      .eq('channel', 'push')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(5)

    if (notificationError) {
      console.error('Failed to fetch new notifications:', notificationError)
      return NextResponse.json(
        { error: 'Failed to check for new notifications' },
        { status: 500 }
      )
    }

    // Format notifications for the service worker
    const notifications = newNotifications?.map(item => {
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

    return NextResponse.json({
      success: true,
      newNotifications: notifications,
      count: notifications.length,
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