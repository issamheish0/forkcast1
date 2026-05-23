"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimeHealthStatus {
  isHealthy: boolean
  lastActivity: Date | null
  connectionState: 'connected' | 'disconnected' | 'reconnecting' | 'unknown'
  reconnectAttempts: number
  channelCount: number
}

interface ChannelHealth {
  channel: RealtimeChannel
  lastActivity: Date
  name: string
}

export function useRealtimeHealth() {
  const [healthStatus, setHealthStatus] = useState<RealtimeHealthStatus>({
    isHealthy: true,
    lastActivity: null,
    connectionState: 'unknown',
    reconnectAttempts: 0,
    channelCount: 0
  })

  const channelsRef = useRef<Map<string, ChannelHealth>>(new Map())
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const supabase = createClient()

  // Health check - runs every 30 seconds
  const checkHealth = useCallback(() => {
    const now = new Date()
    const channels = Array.from(channelsRef.current.values())

    if (channels.length === 0) {
      setHealthStatus(prev => ({
        ...prev,
        isHealthy: true,
        connectionState: 'unknown',
        channelCount: 0
      }))
      return
    }

    // Consider connection stale if no activity for more than 2 minutes
    const STALE_THRESHOLD_MS = 2 * 60 * 1000
    const hasStaleChannels = channels.some(
      channel => (now.getTime() - channel.lastActivity.getTime()) > STALE_THRESHOLD_MS
    )

    const latestActivity = channels.reduce((latest, channel) =>
      !latest || channel.lastActivity > latest ? channel.lastActivity : latest,
      null as Date | null
    )

    setHealthStatus(prev => ({
      ...prev,
      isHealthy: !hasStaleChannels,
      lastActivity: latestActivity,
      connectionState: hasStaleChannels ? 'disconnected' : 'connected',
      channelCount: channels.length
    }))

    // Log health status for debugging
    console.log('🩺 Realtime Health Check:', {
      channelCount: channels.length,
      isHealthy: !hasStaleChannels,
      latestActivity: latestActivity?.toISOString(),
      staleChannels: channels.filter(c =>
        (now.getTime() - c.lastActivity.getTime()) > STALE_THRESHOLD_MS
      ).map(c => c.name)
    })

  }, [])

  // Register a channel for health monitoring
  const registerChannel = useCallback((channel: RealtimeChannel, name: string) => {
    const channelHealth: ChannelHealth = {
      channel,
      lastActivity: new Date(),
      name
    }

    channelsRef.current.set(name, channelHealth)

    // Wrap the original channel event handlers to track activity
    const originalOn = channel.on.bind(channel)
    channel.on = (type: any, filter: any, callback: any) => {
      if (typeof filter === 'function') {
        // Handle case where filter is actually the callback
        const wrappedCallback = (...args: any[]) => {
          // Update activity timestamp
          const channelHealth = channelsRef.current.get(name)
          if (channelHealth) {
            channelHealth.lastActivity = new Date()
          }
          return filter(...args)
        }
        return originalOn(type, wrappedCallback)
      } else {
        // Handle normal case with filter and callback
        const wrappedCallback = (...args: any[]) => {
          // Update activity timestamp
          const channelHealth = channelsRef.current.get(name)
          if (channelHealth) {
            channelHealth.lastActivity = new Date()
          }
          return callback(...args)
        }
        return originalOn(type, filter, wrappedCallback)
      }
    }

    console.log('📡 Registered channel for health monitoring:', name)

    return channel
  }, [])

  // Unregister a channel
  const unregisterChannel = useCallback((name: string) => {
    channelsRef.current.delete(name)
    console.log('📡 Unregistered channel:', name)
  }, [])

  // Force reconnect all channels
  const forceReconnect = useCallback(async () => {
    console.log('🔄 Forcing reconnect of all channels...')

    setHealthStatus(prev => ({
      ...prev,
      connectionState: 'reconnecting',
      reconnectAttempts: prev.reconnectAttempts + 1
    }))

    const channels = Array.from(channelsRef.current.values())

    try {
      // Unsubscribe all channels
      await Promise.all(
        channels.map(async ({ channel }) => {
          try {
            await supabase.removeChannel(channel)
          } catch (error) {
            console.warn('Error removing channel:', error)
          }
        })
      )

      // Clear the channels map - components will need to re-register
      channelsRef.current.clear()

      console.log('✅ All channels unsubscribed, components should re-register')

    } catch (error) {
      console.error('❌ Error during force reconnect:', error)
    }
  }, [supabase])

  // Auto-reconnect when connection becomes unhealthy
  useEffect(() => {
    if (!healthStatus.isHealthy && healthStatus.connectionState === 'disconnected') {
      // Exponential backoff: 5s, 10s, 20s, max 60s
      const delay = Math.min(5000 * Math.pow(2, healthStatus.reconnectAttempts), 60000)

      console.log(`🔄 Scheduling auto-reconnect in ${delay}ms (attempt ${healthStatus.reconnectAttempts + 1})`)

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        forceReconnect()
      }, delay)
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [healthStatus.isHealthy, healthStatus.connectionState, healthStatus.reconnectAttempts, forceReconnect])

  // Start health checking
  useEffect(() => {
    healthCheckIntervalRef.current = setInterval(checkHealth, 30000) // Check every 30 seconds

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [checkHealth])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    healthStatus,
    registerChannel,
    unregisterChannel,
    forceReconnect,
    checkHealth
  }
}