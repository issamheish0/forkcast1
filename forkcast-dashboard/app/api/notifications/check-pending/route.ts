import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {

    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ notifications: [] })
    }
    
    // Get pending notifications that haven't been delivered
    const { data: notifications, error } = await supabase
      .from('notification_outbox')
      .select('*')
      .eq('user_id', user.id)
      .eq('channel', 'push')
      .in('status', ['queued', 'failed']) // Include failed ones for retry
      .lt('attempts', 5) // Max 5 retries (using attempts instead of retry_count)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('Error fetching pending notifications:', error)
      return NextResponse.json({ notifications: [] })
    }
    
    // Format notifications for display
    const formattedNotifications = notifications?.map(n => ({
      notification_id: n.id,
      title: n.title,
      body: n.body,
      url: n.payload?.url || '/bookings',
      booking_id: n.payload?.booking_id,
      data: n.payload,
      tag: n.payload?.booking_id ? `booking-${n.payload.booking_id}` : `notif-${n.id}`,
      priority: n.priority
    })) || []
    
    // Update status to processing
    if (notifications && notifications.length > 0) {
      const updates = notifications.map(n => ({
        id: n.id,
        status: 'processing',
        attempts: (n.attempts || 0) + 1
      }))
      
      // Update each notification individually to handle different attempt counts
      for (const update of updates) {
        await supabase
          .from('notification_outbox')
          .update({ 
            status: update.status,
            attempts: update.attempts
          })
          .eq('id', update.id)
      }
    }
    
    return NextResponse.json({ 
      notifications: formattedNotifications,
      count: formattedNotifications.length
    })
  } catch (error) {
    console.error('Check pending error:', error)
    return NextResponse.json({ notifications: [] })
  }
}