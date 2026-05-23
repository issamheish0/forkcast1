"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/lib/contexts/notification-context'
import { Bell, Settings, Play, TestTube } from 'lucide-react'

export function NotificationTestPanel() {
  const { requestPushPermission, isPushEnabled, addNotification } = useNotifications()
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const handleRequestPermission = async () => {
    setIsLoading(true)
    setTestResult(null)

    try {
      const granted = await requestPushPermission()
      if (granted) {
        setTestResult('✅ Push notifications enabled successfully!')
        // Test in-app notification
        addNotification({
          type: 'general',
          title: 'Push Notifications Enabled! 🎉',
          message: 'You will now receive important restaurant notifications.',
          variant: 'success'
        })
      } else {
        setTestResult('❌ Push notifications permission denied')
      }
    } catch (error) {
      console.error('Permission request failed:', error)
      setTestResult('❌ Failed to request permissions: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestInAppNotification = () => {
    addNotification({
      type: 'booking',
      title: 'Test Booking Notification 🍽️',
      message: 'This is a test booking notification to verify the in-app system.',
      variant: 'info'
    })
    setTestResult('📱 In-app notification sent!')
  }

  const handleTestPushNotification = async () => {
    setIsLoading(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()

      if (response.ok) {
        setTestResult(`✅ Push notification sent: ${result.sent} successful, ${result.failed} failed`)
      } else {
        setTestResult(`❌ Push notification failed: ${result.error}`)
      }
    } catch (error) {
      setTestResult(`❌ Failed to send push notification: ${(error as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Test Panel
        </CardTitle>
        <CardDescription>
          Test and configure notification settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Push Notifications:</span>
          <Badge variant={isPushEnabled ? "default" : "secondary"}>
            {isPushEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {!isPushEnabled && (
            <Button
              onClick={handleRequestPermission}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Settings className="h-4 w-4 mr-2" />
              {isLoading ? 'Requesting...' : 'Enable Push Notifications'}
            </Button>
          )}

          <Button
            onClick={handleTestInAppNotification}
            variant="outline"
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Test In-App Notification
          </Button>

          <Button
            onClick={handleTestPushNotification}
            disabled={isLoading || !isPushEnabled}
            variant="outline"
            className="w-full"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {isLoading ? 'Sending...' : 'Test Push Notification'}
          </Button>
        </div>

        {/* Result */}
        {testResult && (
          <div className="p-3 rounded-md bg-muted text-sm">
            {testResult}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• In-app notifications appear in the top-right corner</p>
          <p>• Push notifications appear even when the app is closed</p>
          <p>• Requires HTTPS or localhost to work</p>
        </div>
      </CardContent>
    </Card>
  )
}
