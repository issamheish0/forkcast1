import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel cron or authorized source
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    
    console.log('🔄 Running notification cleanup cron job...')
    
    // 1. Clean up old notification history (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: cleanupData, error: cleanupError } = await supabase
      .from('notification_history')
      .delete()
      .lt('sent_at', thirtyDaysAgo.toISOString())
    
    if (cleanupError) {
      console.error('Error cleaning up old notifications:', cleanupError)
    } else {
      console.log(`✅ Cleaned up old notification history`)
    }

    // 2. Remove expired push subscriptions (inactive for 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: expiredSubs, error: expiredError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('is_active', false)
      .lt('updated_at', sevenDaysAgo.toISOString())
    
    if (expiredError) {
      console.error('Error removing expired subscriptions:', expiredError)
    } else {
      console.log(`✅ Removed expired push subscriptions`)
    }

    // 3. Health check - count active subscriptions
    const { count: activeCount, error: countError } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    if (countError) {
      console.error('Error getting active subscription count:', countError)
    } else {
      console.log(`📊 Active subscriptions: ${activeCount}`)
    }

    // 4. Check for any failed notifications in the last hour to retry
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    
    const { data: failedNotifications, error: failedError } = await supabase
      .from('notification_history')
      .select('*')
      .is('delivered_at', null)
      .gte('sent_at', oneHourAgo.toISOString())
      .limit(10)
    
    if (failedError) {
      console.error('Error getting failed notifications:', failedError)
    } else if (failedNotifications && failedNotifications.length > 0) {
      console.log(`⚠️  Found ${failedNotifications.length} undelivered notifications from the last hour`)
      // Note: In a real implementation, you might want to retry these
    }

    return NextResponse.json({
      success: true,
      message: 'Notification maintenance completed',
      timestamp: new Date().toISOString(),
      stats: {
        activeSubscriptions: activeCount || 0,
        undeliveredNotifications: failedNotifications?.length || 0
      }
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { 
        error: 'Cron job failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also handle POST requests for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}