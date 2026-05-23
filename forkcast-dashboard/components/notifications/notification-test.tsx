"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/lib/contexts/notification-context'

export function NotificationTest() {
  const { addNotification } = useNotifications()

  const testBookingNotification = () => {
    addNotification({
      type: 'booking',
      title: 'New Booking',
      message: 'New booking from John for 4 guests',
      data: { id: 'test-123', guest_name: 'John Doe', party_size: 4 }
    })
  }

  const testBookingUpdate = () => {
    addNotification({
      type: 'booking',
      title: 'Booking Update',
      message: 'John Doe has checked in',
      data: { id: 'test-123', guest_name: 'John Doe', status: 'arrived' }
    })
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2">
      <Button onClick={testBookingNotification} size="sm">
        Test Booking Notification
      </Button>
      <Button onClick={testBookingUpdate} size="sm" variant="outline">
        Test Booking Update
      </Button>
    </div>
  )
}
