"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/lib/contexts/notification-context'

export function NotificationTestButton() {
  const { addNotification } = useNotifications()

  const testNotification = () => {
    console.log('🧪 Test notification button clicked')
    console.log('🧪 addNotification function:', addNotification)
    
    try {
      addNotification({
        type: 'booking',
        title: 'Test Booking',
        message: 'This is a test notification to verify the system works',
        data: { test: true }
      })
      console.log('🧪 Notification added successfully')
    } catch (error) {
      console.error('🧪 Error adding notification:', error)
    }
  }

  return (
    <Button
      onClick={testNotification}
      size="sm"
      variant="outline"
      className="fixed top-4 right-4 z-50 bg-white shadow-lg"
    >
      Test Notification
    </Button>
  )
}
