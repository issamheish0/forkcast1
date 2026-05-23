"use client"

import React from 'react'
import { useNotifications } from '@/lib/contexts/notification-context'

export function ContextTest() {
  const { notifications, addNotification } = useNotifications()

  const testDirectContext = () => {
    console.log('🧪 Testing direct context call')
    console.log('🧪 Current notifications:', notifications)
    console.log('🧪 addNotification function:', addNotification)
    
    try {
      console.log('🧪 About to call addNotification...')
      addNotification({
        type: 'booking',
        title: 'Direct Context Test',
        message: 'Testing direct context call',
        data: { test: true }
      })
      console.log('🧪 Direct context call successful')
      
      // Force a re-render check
      setTimeout(() => {
        console.log('🧪 After 1 second, notifications count:', notifications.length)
      }, 1000)
    } catch (error) {
      console.error('🧪 Direct context call failed:', error)
    }
  }

  return (
    <div className="fixed top-20 right-4 z-50 bg-red-500 text-white p-2 rounded text-xs">
      <div>Context Test</div>
      <div>Notifications: {notifications.length}</div>
      <button 
        onClick={testDirectContext}
        className="bg-white text-red-500 px-2 py-1 rounded text-xs mt-1"
      >
        Test Context
      </button>
    </div>
  )
}
