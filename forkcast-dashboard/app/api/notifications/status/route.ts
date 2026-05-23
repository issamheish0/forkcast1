import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Notification system API is working',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/notifications/subscribe - Subscribe to push notifications',
      'POST /api/notifications/test - Send test notification',  
      'POST /api/notifications/track-delivery - Track notification delivery',
      'GET/POST /api/notifications/cron - Process background notification jobs (Vercel cron)',
      'GET /api/notifications/status - Check system status'
    ]
  })
}