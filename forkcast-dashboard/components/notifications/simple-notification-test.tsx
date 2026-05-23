"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/lib/contexts/notification-context'

export function SimpleNotificationTest() {
  const { addNotification, notifications } = useNotifications()
  const [testCount, setTestCount] = useState(0)

  const testNotification = () => {
    setTestCount(prev => prev + 1)
    addNotification({
      type: 'booking',
      title: `Test Booking ${testCount + 1}`,
      message: `This is test notification #${testCount + 1}`,
      data: { testId: testCount + 1 }
    })
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white p-4 rounded-lg shadow-lg border">
      <div className="space-y-2">
        <div className="text-sm font-medium">Notification Test</div>
        <div className="text-xs text-gray-500">Active: {notifications.length}</div>
        <Button onClick={testNotification} size="sm">
          Test Notification
        </Button>
      </div>
    </div>
  )
}
