"use client"

import React from 'react'
import { NotificationBanner } from './notification-banner'
import { useNotifications } from '@/lib/contexts/notification-context'

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className="transform transition-all duration-300 ease-out animate-in slide-in-from-right"
          style={{
            animationDelay: `${index * 100}ms`,
            transform: `translateY(${index * 8}px)`
          }}
        >
          <NotificationBanner
            notification={notification}
            onDismiss={removeNotification}
          />
        </div>
      ))}
    </div>
  )
}
