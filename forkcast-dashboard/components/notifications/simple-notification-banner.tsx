"use client"

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notification } from '@/lib/contexts/notification-context'

interface SimpleNotificationBannerProps {
  notification: Notification
  onDismiss: (id: string) => void
}

export function SimpleNotificationBanner({ notification, onDismiss }: SimpleNotificationBannerProps) {
  

  return (
    <div 
      className="bg-blue-500 text-white p-4 rounded-lg shadow-lg border-2 border-blue-600 max-w-sm"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        minWidth: '300px'
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-bold text-lg">{notification.title}</h4>
          <p className="text-sm mt-1">{notification.message}</p>
          <div className="text-xs mt-2 opacity-80">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <Button
          onClick={() => onDismiss(notification.id)}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-blue-600 h-5 w-5 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
