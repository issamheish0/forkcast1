import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { emitRealtimeTelemetry } from '@/lib/realtime-telemetry'

export interface RealtimeSubscriptionConfig {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  schema?: string
}

export interface ManagedSubscription {
  channel: RealtimeChannel
  config: RealtimeSubscriptionConfig
  callbacks: Array<(payload: any) => void>
  name: string
  isActive: boolean
  reconnectAttempts: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

export class RealtimeRecoveryManager {
  private subscriptions = new Map<string, ManagedSubscription>()
  private supabase = createClient()
  private isReconnecting = false

  private clearReconnectTimer(subscription: ManagedSubscription): void {
    if (subscription.reconnectTimer) {
      clearTimeout(subscription.reconnectTimer)
      subscription.reconnectTimer = null
    }
  }

  private scheduleReconnect(name: string): void {
    const subscription = this.subscriptions.get(name)
    if (!subscription || this.isReconnecting) {
      return
    }

    this.clearReconnectTimer(subscription)

    subscription.reconnectAttempts += 1
    const delay = Math.min(1000 * Math.pow(2, subscription.reconnectAttempts - 1), 30000)

    emitRealtimeTelemetry({
      type: 'subscription_reconnect_scheduled',
      source: 'realtime-recovery-manager',
      channel: name,
      level: 'warn',
      details: {
        reconnectAttempts: subscription.reconnectAttempts,
        delayMs: delay
      }
    })

    subscription.reconnectTimer = setTimeout(() => {
      subscription.reconnectTimer = null
      void this.recreateSubscription(name)
    }, delay)
  }

  private async recreateSubscription(name: string): Promise<void> {
    const existing = this.subscriptions.get(name)
    if (!existing) {
      return
    }

    const config = existing.config
    const callbacks = [...existing.callbacks]

    try {
      await this.supabase.removeChannel(existing.channel)
    } catch (error) {
      console.warn(`Error removing channel before recreate for ${name}:`, error)
    }

    this.subscriptions.delete(name)

    const firstCallback = callbacks[0]
    if (!firstCallback) {
      return
    }

    this.createManagedSubscription(name, config, firstCallback)

    for (let i = 1; i < callbacks.length; i++) {
      this.addCallback(name, callbacks[i])
    }

    const recreated = this.subscriptions.get(name)
    if (recreated) {
      recreated.reconnectAttempts = 0
      this.clearReconnectTimer(recreated)
    }

    emitRealtimeTelemetry({
      type: 'subscription_reconnected',
      source: 'realtime-recovery-manager',
      channel: name,
      level: 'info'
    })
  }

  /**
   * Create a managed subscription that can be automatically recovered
   */
  createManagedSubscription(
    name: string,
    config: RealtimeSubscriptionConfig,
    callback: (payload: any) => void
  ): RealtimeChannel {
    // Remove existing subscription if it exists
    const existing = this.subscriptions.get(name)
    if (existing) {
      this.clearReconnectTimer(existing)
      this.subscriptions.delete(name)
      void this.supabase.removeChannel(existing.channel)
    }

    const channelName = `${config.table}-${name}-${Date.now()}`
    const channel = this.supabase.channel(channelName)

    const subscription: ManagedSubscription = {
      channel,
      config,
      callbacks: [callback],
      name,
      isActive: false,
      reconnectAttempts: 0,
      reconnectTimer: null
    }

    // Set up the subscription
    const subscriptionConfig: any = {
      event: config.event || '*',
      schema: config.schema || 'public',
      table: config.table
    }

    if (config.filter) {
      subscriptionConfig.filter = config.filter
    }

    channel.on('postgres_changes', subscriptionConfig, (payload) => {
      subscription.callbacks.forEach(cb => {
        try {
          cb(payload)
        } catch (error) {
          console.error(`Error in callback for subscription ${name}:`, error)
        }
      })
    })

    // Subscribe and track status
    channel.subscribe((status) => {
      subscription.isActive = status === 'SUBSCRIBED'
      console.log(`📡 Subscription ${name} status:`, status)

      emitRealtimeTelemetry({
        type: 'subscription_status',
        source: 'realtime-recovery-manager',
        channel: name,
        status,
        level: status === 'SUBSCRIBED' ? 'info' : 'warn'
      })

      if (status === 'SUBSCRIBED') {
        subscription.reconnectAttempts = 0
        this.clearReconnectTimer(subscription)
      }

      if (
        (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') &&
        !this.isReconnecting
      ) {
        console.warn(`⚠️ Subscription ${name} dropped unexpectedly (${status})`)
        emitRealtimeTelemetry({
          type: 'subscription_dropped',
          source: 'realtime-recovery-manager',
          channel: name,
          status,
          level: 'warn',
          details: {
            reconnectAttempts: subscription.reconnectAttempts
          }
        })
        this.scheduleReconnect(name)
      }
    })

    this.subscriptions.set(name, subscription)
    console.log(`✅ Created managed subscription: ${name}`)

    return channel
  }

  /**
   * Add additional callback to existing subscription
   */
  addCallback(name: string, callback: (payload: any) => void): boolean {
    const subscription = this.subscriptions.get(name)
    if (subscription) {
      const exists = subscription.callbacks.includes(callback)
      if (!exists) {
        subscription.callbacks.push(callback)
      }
      return true
    }
    return false
  }

  /**
   * Remove a managed subscription
   */
  async removeManagedSubscription(name: string): Promise<void> {
    const subscription = this.subscriptions.get(name)
    if (subscription) {
      this.clearReconnectTimer(subscription)
      try {
        await this.supabase.removeChannel(subscription.channel)
      } catch (error) {
        console.warn(`Error removing subscription ${name}:`, error)
      }
      this.subscriptions.delete(name)
      console.log(`🗑️ Removed managed subscription: ${name}`)
    }
  }

  /**
   * Reconnect all managed subscriptions
   */
  async reconnectAll(): Promise<void> {
    if (this.isReconnecting) {
      console.log('🔄 Reconnection already in progress, skipping...')
      return
    }

    this.isReconnecting = true
    console.log('🔄 Reconnecting all managed subscriptions...')

    const subscriptionsToReconnect = Array.from(this.subscriptions.entries())

    try {
      // First, close all existing channels
      await Promise.all(
        subscriptionsToReconnect.map(async ([name, subscription]) => {
          this.clearReconnectTimer(subscription)
          try {
            await this.supabase.removeChannel(subscription.channel)
          } catch (error) {
            console.warn(`Error removing channel for ${name}:`, error)
          }
        })
      )

      // Clear all subscriptions
      this.subscriptions.clear()

      // Recreate all subscriptions
      for (const [name, oldSubscription] of subscriptionsToReconnect) {
        try {
          // Recreate with first callback, then add additional callbacks
          const firstCallback = oldSubscription.callbacks[0]
          if (firstCallback) {
            this.createManagedSubscription(name, oldSubscription.config, firstCallback)

            // Add remaining callbacks
            for (let i = 1; i < oldSubscription.callbacks.length; i++) {
              this.addCallback(name, oldSubscription.callbacks[i])
            }

            const recreated = this.subscriptions.get(name)
            if (recreated) {
              recreated.reconnectAttempts = 0
            }
          }
        } catch (error) {
          console.error(`Error recreating subscription ${name}:`, error)
        }
      }

      console.log(`✅ Reconnected ${subscriptionsToReconnect.length} subscriptions`)
    } catch (error) {
      console.error('❌ Error during reconnection:', error)
    } finally {
      this.isReconnecting = false
    }
  }

  /**
   * Get status of all subscriptions
   */
  getSubscriptionStatus(): Record<string, { isActive: boolean; callbackCount: number }> {
    const status: Record<string, { isActive: boolean; callbackCount: number }> = {}

    for (const [name, subscription] of this.subscriptions) {
      this.clearReconnectTimer(subscription)
      status[name] = {
        isActive: subscription.isActive,
        callbackCount: subscription.callbacks.length
      }
    }

    return status
  }

  /**
   * Check if any subscriptions are inactive
   */
  hasInactiveSubscriptions(): boolean {
    return Array.from(this.subscriptions.values()).some(sub => !sub.isActive)
  }

  /**
   * Get count of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive).length
  }

  /**
   * Get total subscription count
   */
  getTotalSubscriptionCount(): number {
    return this.subscriptions.size
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up all managed subscriptions...')

    const subscriptionNames = Array.from(this.subscriptions.keys())
    await Promise.all(
      subscriptionNames.map(name => this.removeManagedSubscription(name))
    )

    console.log('✅ All managed subscriptions cleaned up')
  }
}

// Singleton instance for global use
export const realtimeRecoveryManager = new RealtimeRecoveryManager()

// Utility functions for common subscription patterns
export function createBookingSubscription(
  restaurantId: string,
  callback: (payload: any) => void,
  name = 'bookings'
): RealtimeChannel {
  return realtimeRecoveryManager.createManagedSubscription(
    name,
    {
      table: 'bookings',
      event: '*',
      filter: `restaurant_id=eq.${restaurantId}`
    },
    callback
  )
}

export function createWaitlistSubscription(
  restaurantId: string,
  callback: (payload: any) => void,
  name = 'waitlist'
): RealtimeChannel {
  return realtimeRecoveryManager.createManagedSubscription(
    name,
    {
      table: 'waitlist',
      event: '*',
      filter: `restaurant_id=eq.${restaurantId}`
    },
    callback
  )
}

export function createTableSubscription(
  restaurantId: string,
  callback: (payload: any) => void,
  name = 'tables'
): RealtimeChannel {
  return realtimeRecoveryManager.createManagedSubscription(
    name,
    {
      table: 'restaurant_tables',
      event: '*',
      filter: `restaurant_id=eq.${restaurantId}`
    },
    callback
  )
}

// PWA-specific recovery functions
export function handlePWABackgroundSync() {
  // This can be called from service worker or when app regains focus
  console.log('🔄 PWA background sync triggered')
  return realtimeRecoveryManager.reconnectAll()
}

export function handlePWAConnectionRecovery() {
  // This can be called when PWA detects network recovery
  console.log('📶 PWA connection recovery triggered')
  return realtimeRecoveryManager.reconnectAll()
}