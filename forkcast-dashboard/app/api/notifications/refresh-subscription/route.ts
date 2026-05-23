import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { subscription } = await request.json()

    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's restaurant
    const { data: staff } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    
    if (!staff) {
      return NextResponse.json({ error: 'No restaurant' }, { status: 404 })
    }
    
    // Update or insert subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        restaurant_id: staff.restaurant_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        is_active: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint'
      })
    
    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Refresh subscription error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed'
    }, { status: 500 })
  }
}