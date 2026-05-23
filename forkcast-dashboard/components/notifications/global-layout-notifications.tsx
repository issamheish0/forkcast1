"use client"

import { Suspense } from 'react'
import { useGlobalLayoutNotifications } from '@/lib/hooks/use-global-layout-notifications'

function GlobalLayoutNotificationsContent() {
  useGlobalLayoutNotifications()
  return null // This component doesn't render anything, just sets up the hook
}

export function GlobalLayoutNotifications() {
  return (
    <Suspense fallback={null}>
      <GlobalLayoutNotificationsContent />
    </Suspense>
  )
}
