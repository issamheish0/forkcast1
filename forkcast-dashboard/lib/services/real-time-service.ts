// lib/services/real-time-service.ts
"use client"

export interface OrderUpdate {
  type: 'order_created' | 'order_updated' | 'order_status_changed' | 'kitchen_update'
  order_id: string
  order_number?: string
  old_status?: string
  new_status?: string
  table_number?: string
  timestamp: string
  data?: any
}

export interface KitchenSummary {
  total: number
  confirmed: number
  preparing: number
  ready: number
  overdue: number
}

export interface RealTimeEvent {
  type: string
  timestamp: string
  restaurant_id?: string
  orders?: any[]
  summary?: KitchenSummary
  order_update?: OrderUpdate
}

export class RealTimeService {
  private eventSource: EventSource | null = null
  private listeners: Map<string, Set<(event: RealTimeEvent) => void>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // Start with 1 second

  constructor(private restaurantId: string) {}

  // Connect to the SSE endpoint
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource('/api/kitchen/events')

        this.eventSource.onopen = () => {
          console.log('Real-time connection established')
          this.reconnectAttempts = 0
          this.reconnectDelay = 1000
          resolve()
        }

        this.eventSource.onmessage = (event) => {
          try {
            const data: RealTimeEvent = JSON.parse(event.data)
            this.handleEvent(data)
          } catch (error) {
            console.error('Error parsing SSE data:', error)
          }
        }

        this.eventSource.onerror = (error) => {
          console.error('SSE connection error:', error)
          this.handleConnectionError()
        }

      } catch (error) {
        console.error('Failed to establish SSE connection:', error)
        reject(error)
      }
    })
  }

  // Disconnect from SSE
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.listeners.clear()
  }

  // Subscribe to specific event types
  subscribe(eventType: string, callback: (event: RealTimeEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  // Handle incoming events
  private handleEvent(event: RealTimeEvent) {
    // Notify specific event type listeners
    const callbacks = this.listeners.get(event.type)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in event callback:', error)
        }
      })
    }

    // Notify 'all' event listeners
    const allCallbacks = this.listeners.get('all')
    if (allCallbacks) {
      allCallbacks.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in all event callback:', error)
        }
      })
    }
  }

  // Handle connection errors and implement reconnection logic
  private handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error)
        })
      }, this.reconnectDelay)

      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000) // Max 30 seconds
    } else {
      console.error('Max reconnection attempts reached')
      this.notifyConnectionLost()
    }
  }

  // Notify listeners about connection loss
  private notifyConnectionLost() {
    const event: RealTimeEvent = {
      type: 'connection_lost',
      timestamp: new Date().toISOString()
    }
    this.handleEvent(event)
  }

  // Get connection status
  getConnectionStatus(): 'connecting' | 'open' | 'closed' | 'error' {
    if (!this.eventSource) return 'closed'
    
    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting'
      case EventSource.OPEN:
        return 'open'
      case EventSource.CLOSED:
        return 'closed'
      default:
        return 'error'
    }
  }

  // Manually trigger order update (for immediate feedback)
  triggerOrderUpdate(orderUpdate: OrderUpdate) {
    const event: RealTimeEvent = {
      type: 'order_updated',
      timestamp: new Date().toISOString(),
      order_update: orderUpdate
    }
    this.handleEvent(event)
  }

  // Send notification to kitchen (this would typically go through an API)
  async notifyKitchen(message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    try {
      // This could be enhanced to send push notifications, play sounds, etc.
      const event: any = {
        type: 'kitchen_notification',
        timestamp: new Date().toISOString(),
        data: { message, priority }
      }
      this.handleEvent(event)
    } catch (error) {
      console.error('Failed to send kitchen notification:', error)
    }
  }
}

// Singleton instance for the app
let realTimeServiceInstance: RealTimeService | null = null

export function getRealTimeService(restaurantId: string): RealTimeService {
  if (!realTimeServiceInstance || realTimeServiceInstance['restaurantId'] !== restaurantId) {
    realTimeServiceInstance = new RealTimeService(restaurantId)
  }
  return realTimeServiceInstance
}

// React hook for using real-time service
import { useEffect, useState, useCallback } from 'react'

export function useRealTimeService(restaurantId: string) {
  const [service] = useState(() => getRealTimeService(restaurantId))
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    // Connect to real-time service
    service.connect().catch(error => {
      console.error('Failed to connect to real-time service:', error)
    })

    // Monitor connection status
    const statusInterval = setInterval(() => {
      setConnectionStatus(service.getConnectionStatus())
    }, 1000)

    // Subscribe to connection events
    const unsubscribe = service.subscribe('all', (event) => {
      setLastUpdate(new Date())
    })

    return () => {
      clearInterval(statusInterval)
      unsubscribe()
      service.disconnect()
    }
  }, [service])

  const subscribe = useCallback((eventType: string, callback: (event: RealTimeEvent) => void) => {
    return service.subscribe(eventType, callback)
  }, [service])

  const triggerOrderUpdate = useCallback((orderUpdate: OrderUpdate) => {
    service.triggerOrderUpdate(orderUpdate)
  }, [service])

  const notifyKitchen = useCallback((message: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    return service.notifyKitchen(message, priority)
  }, [service])

  return {
    service,
    connectionStatus,
    lastUpdate,
    subscribe,
    triggerOrderUpdate,
    notifyKitchen
  }
}

// Utility function to format time elapsed
export function formatTimeElapsed(timestamp: string): string {
  const now = new Date()
  const past = new Date(timestamp)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// Utility function to determine if an order is overdue
export function isOrderOverdue(createdAt: string, estimatedPrepTime: number): boolean {
  const created = new Date(createdAt)
  const estimated = new Date(created.getTime() + estimatedPrepTime * 60000)
  return new Date() > estimated
}
