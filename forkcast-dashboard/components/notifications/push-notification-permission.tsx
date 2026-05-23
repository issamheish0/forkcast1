"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bell, BellOff, X } from 'lucide-react'
import { useNotifications } from '@/lib/contexts/notification-context'
import { pushNotificationManager } from '@/lib/push-notifications'
import { cn } from '@/lib/utils'

export function PushNotificationPermission() {
  const notificationContext = useNotifications()
  const { requestPushPermission, isPushEnabled } = notificationContext || {}
  const [showPrompt, setShowPrompt] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  // Debug logging
 

  useEffect(() => {
    // Check current permission status
    const currentPermission = pushNotificationManager.getCurrentPermission()
    const hasVapid = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    
    if (!isPushEnabled && hasVapid) {
      const hasShownPrompt = localStorage.getItem('push-notification-prompt-shown')
      if (!hasShownPrompt || currentPermission === 'denied') {
        setShowPrompt(true)
      }
    }
  }, [isPushEnabled])

  const handleRequestPermission = async () => {
    if (!requestPushPermission) {
      console.error('requestPushPermission is not available')
      return
    }
    
    setIsRequesting(true)
    try {
      const granted = await requestPushPermission()
      if (granted) {
        setShowPrompt(false)
        localStorage.setItem('push-notification-prompt-shown', 'true')
      }
    } catch (error) {
      console.error('Failed to request push permission:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('push-notification-prompt-shown', 'true')
  }

  if (!showPrompt || !requestPushPermission || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null

  return (
    <div className={cn(
      "border border-blue-200 bg-blue-50 rounded-lg p-3",
      "animate-in slide-in-from-top-2 duration-300"
    )}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <BellOff className="h-4 w-4 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-blue-800">
            Enable Push Notifications
          </div>
          <div className="text-xs text-blue-600 truncate">
            Get notified about new bookings instantly
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 text-xs"
          >
            {isRequesting ? 'Enabling...' : 'Enable'}
          </Button>

          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-blue-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
