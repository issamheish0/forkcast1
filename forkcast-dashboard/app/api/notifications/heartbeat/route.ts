import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { timestamp, sw_version } = await request.json()
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ command: null })
    }
    
    // Update last_seen for push subscriptions
    await supabase
      .from('push_subscriptions')
      .update({ 
        last_seen: new Date().toISOString(),
        is_active: true
      })
      .eq('user_id', user.id)
    
    // Check if there are pending notifications
    const { count } = await supabase
      .from('notification_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('channel', 'push')
      .eq('status', 'queued')
    
    // Send command if notifications pending
    let command = null
    if (count && count > 0) {
      command = 'check_notifications'
    }
    
    return NextResponse.json({ 
      command,
      timestamp: Date.now(),
      pending: count || 0
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json({ command: null })
  }
}