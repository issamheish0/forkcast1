'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeepAliveManager } from './keep-alive-manager'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        })
        .then((registration) => {
          console.log('SW registered: ', registration)
          setSwRegistration(registration)

          // Handle service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    toast.info('App update available! Refresh to update.', {
                      duration: 10000,
                      action: {
                        label: 'Refresh',
                        onClick: () => window.location.reload()
                      }
                    })
                  }
                }
              })
            }
          })

          // Register background sync if supported
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            registration.sync?.register('background-sync').catch((error: unknown) => {
              console.log('Background sync registration failed:', error)
            })
          }

          // Register periodic sync if supported
          if ('periodicSync' in window.ServiceWorkerRegistration.prototype) {
            registration.periodicSync?.register('keep-alive', {
              minInterval: 30000 // 30 seconds
            }).catch(() => {
              // Periodic sync requires user engagement and is not available in all browsers/contexts
            })
          }
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })

      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          toast.success('App updated successfully!')
        }
        
        if (event.data && event.data.type === 'SW_APP_VISIBLE') {
          console.log('📱 Service worker confirmed app visibility')
          // Trigger any necessary reconnections or updates
        }
      })

      // Handle controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker controller changed')
        // Reload the page to ensure we're using the latest service worker
        window.location.reload()
      })
    }

    // Handle app installation
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('PWA install prompt available')
    })

    window.addEventListener('appinstalled', () => {
      toast.success('App installed successfully!')
      console.log('PWA was installed')
    })

    // Handle online/offline status
    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Back online!')
      
      // Trigger background sync when coming back online
      if (swRegistration && 'sync' in window.ServiceWorkerRegistration.prototype) {
        swRegistration.sync?.register('background-sync').catch((error: unknown) => {
          console.log('Background sync failed:', error)
        })
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.error('You are offline. Some features may be limited.')
    }

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 App became visible')
        
        // Notify service worker that app is visible (guard controller)
        navigator.serviceWorker?.controller?.postMessage?.({
          type: 'APP_VISIBLE',
          timestamp: Date.now()
        })
        
        // Trigger any necessary updates when app becomes visible
        if (isOnline) {
          // Refresh critical data
          window.dispatchEvent(new CustomEvent('appVisible'))
        }
      } else {
        console.log('📱 App became hidden')
      }
    }

    // Handle page focus/blur
    const handleFocus = () => {
      console.log('🎯 Page focused')
      navigator.serviceWorker?.controller?.postMessage?.({
        type: 'APP_FOCUSED',
        timestamp: Date.now()
      })
    }

    const handleBlur = () => {
      console.log('😴 Page blurred')
    }

    // Set initial online status
    setIsOnline(navigator.onLine)

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [swRegistration, isOnline])

  return (
    <KeepAliveManager>
      {children}
    </KeepAliveManager>
  )
}
