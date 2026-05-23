import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, notificationId, action, timestamp } = await request.json()

    if (!notificationId || !type) {
      return NextResponse.json({ success: true }) // Don't fail for missing data
    }

    // Create service role client for tracking
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (type === 'delivered') {
      // Update notification history to mark as delivered
      await supabase
        .from('notification_history')
        .update({
          delivered: true,
          delivered_at: new Date().toISOString()
        })
        .eq('notification_id', notificationId)
    } else if (type === 'clicked') {
      // Update notification history to mark as clicked
      await supabase
        .from('notification_history')
        .update({
          clicked: true,
          clicked_at: new Date().toISOString()
        })
        .eq('notification_id', notificationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to track notification:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}