"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface ConnectionRecoveryOptions {
  onForceReconnect?: () => void
  enableVisibilityRecovery?: boolean
  enableFocusRecovery?: boolean
  enableOnlineRecovery?: boolean
  debounceDelay?: number
}

export function useConnectionRecovery(options: ConnectionRecoveryOptions = {}) {
  const {
    onForceReconnect,
    enableVisibilityRecovery = true,
    enableFocusRecovery = true,
    enableOnlineRecovery = true,
    debounceDelay = 1000
  } = options

  const queryClient = useQueryClient()
  const lastRecoveryRef = useRef<number>(0)
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Debounced recovery function to prevent multiple rapid recoveries
  const triggerRecovery = useCallback((reason: string) => {
    const now = Date.now()
    const timeSinceLastRecovery = now - lastRecoveryRef.current

    if (timeSinceLastRecovery < debounceDelay) {
      console.log(`🔄 Recovery debounced (${reason}), last recovery was ${timeSinceLastRecovery}ms ago`)
      return
    }

    // Clear any pending recovery
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current)
    }

    // Schedule recovery
    recoveryTimeoutRef.current = setTimeout(() => {
      console.log(`🔄 Connection recovery triggered: ${reason}`)
      lastRecoveryRef.current = Date.now()

      // Invalidate all React Query cache to force fresh data
      queryClient.invalidateQueries()

      // Force realtime reconnection if callback provided
      if (onForceReconnect) {
        onForceReconnect()
      }

      console.log('✅ Connection recovery completed')
    }, 100) // Small delay to allow UI to settle

  }, [queryClient, onForceReconnect, debounceDelay])

  // Handle app visibility changes (critical for PWAs on tablets)
  useEffect(() => {
    if (!enableVisibilityRecovery) return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App became visible - force recovery
        triggerRecovery('app became visible')
      } else {
        console.log('📱 App hidden - pausing active operations')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enableVisibilityRecovery, triggerRecovery])

  // Handle window focus/blur events
  useEffect(() => {
    if (!enableFocusRecovery) return

    const handleFocus = () => {
      triggerRecovery('window gained focus')
    }

    const handleBlur = () => {
      console.log('📱 Window lost focus')
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [enableFocusRecovery, triggerRecovery])

  // Handle online/offline events
  useEffect(() => {
    if (!enableOnlineRecovery) return

    const handleOnline = () => {
      triggerRecovery('network came online')
    }

    const handleOffline = () => {
      console.log('📶 Network went offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enableOnlineRecovery, triggerRecovery])

  // Handle page load/DOMContentLoaded for initial recovery
  useEffect(() => {
    const handleLoad = () => {
      triggerRecovery('page loaded')
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleLoad)
    } else {
      // Page already loaded
      setTimeout(() => handleLoad(), 100)
    }

    return () => {
      document.removeEventListener('DOMContentLoaded', handleLoad)
    }
  }, [triggerRecovery])

  // Manual recovery function for external triggers
  const manualRecovery = useCallback((reason = 'manual trigger') => {
    triggerRecovery(reason)
  }, [triggerRecovery])

  // Cleanup
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current)
      }
    }
  }, [])

  return {
    triggerRecovery: manualRecovery
  }
}