"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { bookingAlarmService } from '@/lib/services/booking-alarm-service'

/**
 * React hook that bridges the singleton BookingAlarmService to React state.
 * Uses subscribe + setState pattern for reliable updates without
 * useSyncExternalStore's snapshot caching requirements.
 */
export function useBookingAlarm() {
  const [pendingIds, setPendingIds] = useState<string[]>(() => bookingAlarmService.getPendingIds())
  const [muteState, setMuteState] = useState(() => bookingAlarmService.getMuteState())

  useEffect(() => {
    // Sync on mount (in case state changed before subscription)
    setPendingIds(bookingAlarmService.getPendingIds())
    setMuteState(bookingAlarmService.getMuteState())

    const unsubscribe = bookingAlarmService.subscribe(() => {
      setPendingIds(bookingAlarmService.getPendingIds())
      setMuteState(bookingAlarmService.getMuteState())
    })
    return unsubscribe
  }, [])

  // Track previously seen IDs to detect new arrivals.
  // Initialize with current snapshot to avoid false "new arrivals" on first render.
  const prevIdsRef = useRef<Set<string>>(new Set(bookingAlarmService.getPendingIds()))
  const newIds = pendingIds.filter(id => !prevIdsRef.current.has(id))

  // Update ref after computing (safe in render for refs)
  useEffect(() => {
    prevIdsRef.current = new Set(pendingIds)
  }, [pendingIds])

  const mute = useCallback((durationMs: number | null) => {
    bookingAlarmService.mute(durationMs)
  }, [])

  const unmute = useCallback(() => {
    bookingAlarmService.unmute()
  }, [])

  return {
    pendingIds,
    isRinging: pendingIds.length > 0,
    pendingCount: pendingIds.length,
    newestPendingId: pendingIds.length > 0 ? pendingIds[pendingIds.length - 1] : null,
    hasNewArrivals: newIds.length > 0,
    newArrivalIds: newIds,
    isMuted: muteState.isMuted,
    muteUntil: muteState.muteUntil,
    mute,
    unmute,
  }
}
