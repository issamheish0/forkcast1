import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { notificationService } from '@/lib/services/notification-service'

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
      .select('restaurant_id, restaurant:restaurants(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Staff access required' },
        { status: 403 }
      )
    }

    // Send test notification
    const result = await notificationService.sendToRestaurant(
      staffData.restaurant_id,
      {
        title: 'Test Notification 🧪',
        body: `This is a test notification for ${(staffData.restaurant as any)?.name || 'your restaurant'}`,
        type: 'test',
        priority: 'normal',
        url: '/bookings',
        data: {
          test: true,
          timestamp: Date.now()
        },
        actions: [
          { action: 'view', title: 'Open Dashboard' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      }
    )

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send test notification' },
      { status: 500 }
    )
  }
}