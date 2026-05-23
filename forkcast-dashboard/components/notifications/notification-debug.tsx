"use client"

import React from 'react'
import { useNotifications } from '@/lib/contexts/notification-context'

export function NotificationDebug() {
  const { notifications, addNotification, playNotificationSound } = useNotifications()

  const testSound = () => {
    console.log('🔊 Testing sound directly')
    playNotificationSound('booking')
  }

  const testNotification = () => {
    console.log('🧪 Testing notification')
    addNotification({
      type: 'booking',
      title: 'Debug Test',
      message: 'This is a debug test notification',
      data: { debug: true }
    })
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white p-4 rounded-lg shadow-lg border max-w-sm">
      <div className="space-y-2">
        <div className="text-sm font-medium">Notification Debug</div>
        <div className="text-xs text-gray-500">
          Notifications: {notifications.length}
        </div>
        <div className="flex gap-2">
          <button
            onClick={testNotification}
            className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
          >
            Test Notification
          </button>
          <button
            onClick={testSound}
            className="px-2 py-1 bg-green-500 text-white text-xs rounded"
          >
            Test Sound
          </button>
        </div>
        {notifications.length > 0 && (
          <div className="text-xs">
            Latest: {notifications[0]?.title}
          </div>
        )}
      </div>
    </div>
  )
}
