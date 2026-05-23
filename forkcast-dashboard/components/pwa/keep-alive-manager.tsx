'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface KeepAliveConfig {
  heartbeatInterval: number
  visibilityCheckInterval: number
  reconnectTimeout: number
  maxRetries: number
}

const DEFAULT_CONFIG: KeepAliveConfig = {
  heartbeatInterval: 30000, // 30 seconds
  visibilityCheckInterval: 5000, // 5 seconds
  reconnectTimeout: 10000, // 10 seconds
  maxRetries: 3
}

export function KeepAliveManager({ 
  children, 
  config = DEFAULT_CONFIG 
}: { 
  children: React.ReactNode
  config?: Partial<KeepAliveConfig>
}) {
  const [isVisible, setIsVisible] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected')
  const [retryCount, setRetryCount] = useState(0)
  
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const lastHeartbeatAtRef = useRef<number>(0)
  const isReconnectingRef = useRef(false)

  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Minimum gap between heartbeats from any caller (focus, visibility,
  // initial mount). Prevents focus/blur bursts (soft-keyboard, modal open
  // etc.) from firing N requests in a few hundred ms. The 30s setInterval
  // still drives the steady-state cadence; this just deduplicates the
  // event-driven calls.
  const HEARTBEAT_MIN_GAP_MS = 10_000

  // Wake Lock API to prevent device sleep
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        console.log('🔒 Wake lock acquired')
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('🔓 Wake lock released')
          // Try to reacquire wake lock
          setTimeout(requestWakeLock, 1000)
        })
      } catch (err) {
        console.warn('Wake lock request failed:', err)
      }
    }
  }

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }

  // Heartbeat to keep connections alive
  const sendHeartbeat = async () => {
    lastHeartbeatAtRef.current = Date.now()
    try {
      // Send a lightweight ping to keep connections alive
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })

      if (response.ok) {
        setConnectionStatus('connected')
        setRetryCount(0)
        isReconnectingRef.current = false
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.warn('Heartbeat failed:', error)

      if (isVisible && !isReconnectingRef.current) {
        setConnectionStatus('reconnecting')
        isReconnectingRef.current = true

        // Attempt to reconnect
        setTimeout(() => {
          attemptReconnection()
        }, finalConfig.reconnectTimeout)
      }
    }
  }

  // Coalesced wrapper for event-driven heartbeats (focus, visibility,
  // initial mount). The periodic 30s interval still calls `sendHeartbeat`
  // directly because it self-paces.
  const tryHeartbeat = () => {
    if (Date.now() - lastHeartbeatAtRef.current < HEARTBEAT_MIN_GAP_MS) return
    sendHeartbeat()
  }

  // Attempt to reconnect
  const attemptReconnection = async () => {
    if (retryCount >= finalConfig.maxRetries) {
      setConnectionStatus('disconnected')
      toast.error('Connection lost. Please refresh the page.')
      return
    }

    setRetryCount(prev => prev + 1)
    
    try {
      // Try to re-establish connection
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        setConnectionStatus('connected')
        setRetryCount(0)
        isReconnectingRef.current = false
        toast.success('Connection restored!')
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.warn(`Reconnection attempt ${retryCount} failed:`, error)
      
      // Schedule next retry
      setTimeout(() => {
        attemptReconnection()
      }, finalConfig.reconnectTimeout * retryCount)
    }
  }

  // Handle visibility changes
  const handleVisibilityChange = () => {
    const visible = !document.hidden
    setIsVisible(visible)
    
    if (visible) {
      console.log('📱 App became visible - checking connection')
      lastActivityRef.current = Date.now()

      // Check connection when app becomes visible (coalesced).
      tryHeartbeat()

      // Reacquire wake lock if needed
      if (!wakeLockRef.current) {
        requestWakeLock()
      }
      
      // Trigger a service worker message to wake up
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'APP_VISIBLE',
          timestamp: Date.now()
        })
      }
    } else {
      console.log('📱 App became hidden')
      // Don't release wake lock immediately - keep it for a bit
      setTimeout(() => {
        if (document.hidden) {
          releaseWakeLock()
        }
      }, 30000) // Release after 30 seconds of being hidden
    }
  }

  // Handle page focus/blur
  const handleFocus = () => {
    console.log('🎯 Page focused')
    lastActivityRef.current = Date.now()

    if (!isVisible) {
      setIsVisible(true)
      tryHeartbeat()
      requestWakeLock()
    }
  }

  const handleBlur = () => {
    console.log('😴 Page blurred')
  }

  // Handle beforeunload to clean up
  const handleBeforeUnload = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
    }
    releaseWakeLock()
  }

  // Setup event listeners and intervals
  useEffect(() => {
    console.log('🚀 Initializing KeepAlive Manager')
    
    // Request initial wake lock
    requestWakeLock()
    
    // Set up heartbeat — the 30s interval is the only steady-state caller
    // of `sendHeartbeat`. We previously also ran a 5s ticker that fired
    // another heartbeat after 60s of inactivity, but the 30s baseline
    // already covers that case (the connection is never idle for >30s),
    // so the extra ticker was pure overhead.
    heartbeatRef.current = setInterval(sendHeartbeat, finalConfig.heartbeatInterval)

    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }
    
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })
    
    // Initial connection check (coalesced — under React Strict Mode in dev,
    // this useEffect runs twice, and the second mount would otherwise fire
    // a back-to-back heartbeat).
    tryHeartbeat()

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up KeepAlive Manager')

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
      
      releaseWakeLock()
    }
  }, [])

  // Show connection status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 Connection status: ${connectionStatus}`)
    }
  }, [connectionStatus])

  return (
    <>
      {children}
      {/* Connection status indicator (only in development) */}
      {process.env.NODE_ENV === 'development' && connectionStatus !== 'connected' && (
        <div className="fixed top-0 right-0 bg-yellow-500 text-white px-2 py-1 text-xs z-50">
          {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
        </div>
      )}
    </>
  )
}
