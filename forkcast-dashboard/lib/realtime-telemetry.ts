export type RealtimeTelemetryLevel = 'info' | 'warn' | 'error'

export interface RealtimeTelemetryEvent {
  type:
    | 'subscription_status'
    | 'subscription_dropped'
    | 'subscription_reconnect_scheduled'
    | 'subscription_reconnected'
    | 'duplicate_event_ignored'
    | 'stale_update_ignored'
  source: string
  channel: string
  restaurantId?: string
  status?: string
  details?: Record<string, unknown>
  level?: RealtimeTelemetryLevel
  timestamp: string
}

type RealtimeTelemetryListener = (event: RealtimeTelemetryEvent) => void

declare global {
  interface Window {
    __RBS_REALTIME_TELEMETRY__?: RealtimeTelemetryEvent[]
  }
}

const listeners = new Set<RealtimeTelemetryListener>()

export function onRealtimeTelemetry(listener: RealtimeTelemetryListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitRealtimeTelemetry(event: Omit<RealtimeTelemetryEvent, 'timestamp'>): void {
  const withTimestamp: RealtimeTelemetryEvent = {
    ...event,
    timestamp: new Date().toISOString()
  }

  if (typeof window !== 'undefined') {
    const existing = window.__RBS_REALTIME_TELEMETRY__ || []
    window.__RBS_REALTIME_TELEMETRY__ = [...existing.slice(-199), withTimestamp]
  }

  listeners.forEach(listener => {
    try {
      listener(withTimestamp)
    } catch (error) {
      console.error('Realtime telemetry listener failed:', error)
    }
  })

  const level = withTimestamp.level || 'info'
  const message = `[realtime:${withTimestamp.source}] ${withTimestamp.type}`
  if (level === 'error') {
    console.error(message, withTimestamp)
    return
  }

  if (level === 'warn') {
    console.warn(message, withTimestamp)
    return
  }

  console.info(message, withTimestamp)
}
