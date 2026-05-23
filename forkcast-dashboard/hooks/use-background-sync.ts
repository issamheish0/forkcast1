"use client"

import { useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type RealtimeHealthStatus } from './use-realtime-health'

interface BackgroundSyncOptions {
  restaurantId: string
  healthStatus: RealtimeHealthStatus
  onForceReconnect?: () => void
  enableServiceWorkerSync?: boolean
  aggressivePollingThreshold?: number // minutes of unhealthy connection before aggressive polling
}

export function useBackgroundSync({
  restaurantId,
  healthStatus,
  onForceReconnect,
  enableServiceWorkerSync = true,
  aggressivePollingThreshold = 2
}: BackgroundSyncOptions) {
  const queryClient = useQueryClient()
  const lastHealthyTimestamp = useRef<number>(Date.now())
  const aggressivePollingInterval = useRef<NodeJS.Timeout | undefined>(undefined)
  const serviceWorkerSyncInterval = useRef<NodeJS.Timeout | undefined>(undefined)

  // Track when connection was last healthy
  useEffect(() => {
    if (healthStatus.isHealthy) {
      lastHealthyTimestamp.current = Date.now()
    }
  }, [healthStatus.isHealthy])

  // Calculate how long the connection has been unhealthy
  const getUnhealthyDurationMinutes = useCallback(() => {
    if (healthStatus.isHealthy) return 0
    return (Date.now() - lastHealthyTimestamp.current) / 1000 / 60
  }, [healthStatus.isHealthy])

  // Aggressive polling when connection is unhealthy for too long
  useEffect(() => {
    const unhealthyMinutes = getUnhealthyDurationMinutes()

    if (unhealthyMinutes >= aggressivePollingThreshold) {
      // Start aggressive polling - every 5 seconds
      if (!aggressivePollingInterval.current) {
        console.log('🚨 Starting aggressive polling - connection unhealthy for', unhealthyMinutes, 'minutes')

        aggressivePollingInterval.current = setInterval(() => {
          console.log('🔄 Aggressive poll - invalidating all queries')
          // Invalidate without cancelling in-flight requests
          queryClient.invalidateQueries({
            refetchType: 'none' // Don't cancel active queries
          })

          // Try to force reconnect
          if (onForceReconnect) {
            onForceReconnect()
          }
        }, 5000) // Every 5 seconds when connection is broken
      }
    } else {
      // Stop aggressive polling when connection recovers
      if (aggressivePollingInterval.current) {
        console.log('✅ Stopping aggressive polling - connection recovered')
        clearInterval(aggressivePollingInterval.current)
        aggressivePollingInterval.current = undefined
      }
    }

    return () => {
      if (aggressivePollingInterval.current) {
        clearInterval(aggressivePollingInterval.current)
        aggressivePollingInterval.current = undefined
      }
    }
  }, [getUnhealthyDurationMinutes, aggressivePollingThreshold, queryClient, onForceReconnect])

  // Service Worker coordination for background sync
  useEffect(() => {
    if (!enableServiceWorkerSync) return

    // Send connection health status to service worker
    const sendHealthToServiceWorker = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CONNECTION_HEALTH_UPDATE',
          data: {
            healthStatus,
            restaurantId,
            timestamp: Date.now(),
            unhealthyMinutes: getUnhealthyDurationMinutes()
          }
        })
      }
    }

    // Send health status every 30 seconds
    serviceWorkerSyncInterval.current = setInterval(sendHealthToServiceWorker, 30000)

    // Send immediately
    sendHealthToServiceWorker()

    return () => {
      if (serviceWorkerSyncInterval.current) {
        clearInterval(serviceWorkerSyncInterval.current)
        serviceWorkerSyncInterval.current = undefined
      }
    }
  }, [enableServiceWorkerSync, healthStatus, restaurantId, getUnhealthyDurationMinutes])

  // Listen for service worker messages
  useEffect(() => {
    if (!enableServiceWorkerSync) return

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FORCE_DATA_REFRESH') {
        console.log('📨 Service worker requesting data refresh')
        // Invalidate without cancelling in-flight requests
        queryClient.invalidateQueries({
          refetchType: 'none' // Don't cancel active queries, just mark as stale
        })

        if (onForceReconnect) {
          onForceReconnect()
        }
      } else if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
        console.log('📨 Background sync completed by service worker')
        queryClient.invalidateQueries({
          queryKey: ['basic-bookings'],
          refetchType: 'none'
        })
        queryClient.invalidateQueries({
          queryKey: ['todays-bookings'],
          refetchType: 'none'
        })
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [enableServiceWorkerSync, queryClient, onForceReconnect])

  // Register background sync on connection failure
  const registerBackgroundSync = useCallback(async (tag: string) => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        // Check if background sync is supported
        if ('sync' in registration) {
          await registration.sync!.register(tag)
          console.log('📋 Background sync registered:', tag)
        } else {
          console.log('📋 Background sync not supported, using service worker message instead')
          // Fallback to direct service worker message
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'FORCE_BACKGROUND_SYNC',
              data: { restaurantId: tag.replace('sync-bookings-', '') }
            })
          }
        }
      } catch (error) {
        console.error('❌ Background sync registration failed:', error)
      }
    }
  }, [])

  // Auto-register background sync when connection becomes unhealthy
  useEffect(() => {
    if (!healthStatus.isHealthy) {
      registerBackgroundSync(`sync-bookings-${restaurantId}`)
    }
  }, [healthStatus.isHealthy, restaurantId, registerBackgroundSync])

  // Force immediate data sync
  const forceSyncNow = useCallback(async () => {
    console.log('🔄 Force sync now - invalidating all queries')
    // Invalidate without cancelling in-flight requests
    queryClient.invalidateQueries({
      refetchType: 'none' // Don't cancel active queries
    })

    if (onForceReconnect) {
      onForceReconnect()
    }

    // Also request service worker sync
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'FORCE_BACKGROUND_SYNC',
        data: { restaurantId }
      })
    }
  }, [queryClient, onForceReconnect, restaurantId])

  return {
    forceSyncNow,
    registerBackgroundSync,
    isAggressivePolling: !!aggressivePollingInterval.current,
    unhealthyDurationMinutes: getUnhealthyDurationMinutes()
  }
}