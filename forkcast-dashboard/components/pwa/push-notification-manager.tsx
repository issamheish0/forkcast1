'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Bell, BellOff, Send } from 'lucide-react'
import { subscribeUser, unsubscribeUser, sendNotification } from '@/app/actions'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      registerServiceWorker()
    }
  }, [])

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      setIsSubscribed(!!sub)
      
      console.log('Service worker registered successfully')
    } catch (error) {
      console.error('Service worker registration failed:', error)
    }
  }

  async function subscribeToPush() {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      toast.error('VAPID public key not configured')
      return
    }

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ),
      })
      
      setSubscription(sub)
      setIsSubscribed(true)
      
      const serializedSub = JSON.parse(JSON.stringify(sub))
      const result = await subscribeUser(serializedSub)
      
      if (result.success) {
        toast.success('Successfully subscribed to push notifications!')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      toast.error('Failed to subscribe to push notifications')
      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }

  async function unsubscribeFromPush() {
    setIsLoading(true)
    try {
      if (subscription) {
        await subscription.unsubscribe()
        await unsubscribeUser(subscription.endpoint)
      }
      
      setSubscription(null)
      setIsSubscribed(false)
      toast.success('Successfully unsubscribed from push notifications')
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error)
      toast.error('Failed to unsubscribe from push notifications')
    } finally {
      setIsLoading(false)
    }
  }

  async function sendTestNotification() {
    if (!testMessage.trim()) {
      toast.error('Please enter a test message')
      return
    }

    setIsLoading(true)
    try {
      const result = await sendNotification({
        title: 'Plate Management Test',
        body: testMessage,
        url: '/bookings'
      })
      
      if (result.success) {
        toast.success(`Test notification sent! ${result.message}`)
        setTestMessage('')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to send test notification:', error)
      toast.error('Failed to send test notification')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Manage push notification settings for restaurant updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notification-toggle">Enable Notifications</Label>
            <div className="text-sm text-muted-foreground text-sm">{isSubscribed 
                ? 'You will receive push notifications for important updates'
                : 'Turn on to receive push notifications'
              }
            </div>
          </div>
          <Switch
            id="notification-toggle"
            checked={isSubscribed}
            onCheckedChange={isSubscribed ? unsubscribeFromPush : subscribeToPush}
            disabled={isLoading}
          />
        </div>

        {isSubscribed && (
          <div className="space-y-3 pt-4 border-t">
            <Label htmlFor="test-message">Send Test Notification</Label>
            <div className="flex gap-2">
              <Input
                id="test-message"
                placeholder="Enter test message..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendTestNotification()}
              />
              <Button 
                onClick={sendTestNotification}
                disabled={isLoading || !testMessage.trim()}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
