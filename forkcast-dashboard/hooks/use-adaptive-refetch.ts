"use client"

import { useMemo } from 'react'
import { type RealtimeHealthStatus } from './use-realtime-health'

interface AdaptiveRefetchConfig {
  healthyInterval?: number
  unhealthyInterval?: number
  disconnectedInterval?: number
  reconnectingInterval?: number
  minimumInterval?: number
  maximumInterval?: number
}

interface AdaptiveRefetchResult {
  refetchInterval: number
  enabled: boolean
  staleTime: number
  gcTime: number
}

const DEFAULT_CONFIG: Required<AdaptiveRefetchConfig> = {
  healthyInterval: 30000,      // 30 seconds when healthy
  unhealthyInterval: 10000,    // 10 seconds when unhealthy
  disconnectedInterval: 5000,  // 5 seconds when disconnected
  reconnectingInterval: 2000,  // 2 seconds when reconnecting
  minimumInterval: 1000,       // Never faster than 1 second
  maximumInterval: 60000       // Never slower than 1 minute
}

export function useAdaptiveRefetch(
  healthStatus: RealtimeHealthStatus,
  config: AdaptiveRefetchConfig = {}
): AdaptiveRefetchResult {
  // Memoize finalConfig to prevent defeating the downstream useMemo
  const finalConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    // Use individual primitive values instead of the config object reference
    [config.healthyInterval, config.unhealthyInterval, config.disconnectedInterval, config.reconnectingInterval, config.minimumInterval, config.maximumInterval]
  )

  const result = useMemo(() => {
    let refetchInterval: number

    // Determine interval based on connection health
    switch (healthStatus.connectionState) {
      case 'connected':
        refetchInterval = healthStatus.isHealthy
          ? finalConfig.healthyInterval
          : finalConfig.unhealthyInterval
        break

      case 'disconnected':
        refetchInterval = finalConfig.disconnectedInterval
        break

      case 'reconnecting':
        refetchInterval = finalConfig.reconnectingInterval
        break

      default:
        refetchInterval = finalConfig.healthyInterval
    }

    // Apply reconnect attempt penalty (exponential backoff factor)
    if (healthStatus.reconnectAttempts > 0 && !healthStatus.isHealthy) {
      const backoffMultiplier = Math.min(2 ** healthStatus.reconnectAttempts, 4) // Max 4x slower
      refetchInterval = Math.min(refetchInterval * backoffMultiplier, finalConfig.maximumInterval)
    }

    // Ensure within bounds
    refetchInterval = Math.max(finalConfig.minimumInterval, refetchInterval)
    refetchInterval = Math.min(finalConfig.maximumInterval, refetchInterval)

    // When real-time is healthy, we can have longer stale times
    // When unhealthy, we want fresher data more often
    const staleTime = healthStatus.isHealthy ? 30000 : 5000

    // Garbage collection time - keep data around longer when disconnected
    const gcTime = healthStatus.connectionState === 'disconnected' ? 300000 : 30000

    return {
      refetchInterval,
      enabled: true,
      staleTime,
      gcTime
    }
  }, [
    healthStatus.connectionState,
    healthStatus.isHealthy,
    healthStatus.reconnectAttempts,
    finalConfig
  ])

  // Log interval changes for debugging
  const previousInterval = useMemo(() => {
    const interval = result.refetchInterval
    console.log('📊 Adaptive refetch interval:', {
      interval: `${interval / 1000}s`,
      connectionState: healthStatus.connectionState,
      isHealthy: healthStatus.isHealthy,
      reconnectAttempts: healthStatus.reconnectAttempts,
      staleTime: `${result.staleTime / 1000}s`
    })
    return interval
  }, [result.refetchInterval, healthStatus, result.staleTime])

  return result
}

// Utility hook for consistent adaptive config across all queries
export function useAdaptiveQueryConfig(healthStatus: RealtimeHealthStatus) {
  return useAdaptiveRefetch(healthStatus, {
    healthyInterval: 30000,    // 30s when healthy
    unhealthyInterval: 10000,  // 10s when connection issues
    disconnectedInterval: 5000, // 5s when fully disconnected
    reconnectingInterval: 3000  // 3s during reconnection
  })
}

// Specialized hook for critical booking queries that need faster updates
// Note: Realtime is unstable and disconnects, so we keep polling but at smarter intervals
export function useAdaptiveBookingConfig(healthStatus: RealtimeHealthStatus) {
  return useAdaptiveRefetch(healthStatus, {
    healthyInterval: 30000,    // 30s when healthy (reduced from 15s for better performance)
    unhealthyInterval: 10000,  // 10s when connection issues (reduced from 5s)
    disconnectedInterval: 5000, // 5s when fully disconnected (reduced from 2s)
    reconnectingInterval: 3000  // 3s during reconnection (reduced from 1s)
  })
}

// Specialized hook for less critical queries (analytics, etc.)
export function useAdaptiveLowPriorityConfig(healthStatus: RealtimeHealthStatus) {
  return useAdaptiveRefetch(healthStatus, {
    healthyInterval: 60000,    // 1 minute when healthy
    unhealthyInterval: 30000,  // 30s when connection issues
    disconnectedInterval: 15000, // 15s when fully disconnected
    reconnectingInterval: 10000  // 10s during reconnection
  })
}