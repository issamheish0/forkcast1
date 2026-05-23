/**
 * Booking Alarm Service (PWA)
 *
 * Singleton that plays a persistent looping alarm sound when there are
 * unattended (pending) bookings. The alarm only stops when ALL pending
 * bookings have been accepted or declined.
 *
 * Also manages the Screen Wake Lock to keep the screen on while the
 * dashboard is open (same pattern as Uber Eats / DoorDash tablets).
 */

type AlarmListener = () => void

class BookingAlarmService {
  private audio: HTMLAudioElement | null = null
  private pendingBookingIds = new Set<string>()
  private wakeLock: WakeLockSentinel | null = null
  private audioUnlocked = false
  private isStartingPlayback = false
  private isUnlocking = false
  private listeners = new Set<AlarmListener>()
  private cachedSnapshot: string[] = [] // Cached for useSyncExternalStore referential stability
  private isMuted = false
  private muteUntil: number | null = null // null while muted = indefinite mute
  private muteTimeoutId: ReturnType<typeof setTimeout> | null = null

  /**
   * Start the alarm for a specific booking.
   * If already ringing for other bookings, just adds this ID to the set.
   */
  async startAlarm(bookingId: string): Promise<void> {
    if (this.pendingBookingIds.has(bookingId)) return
    this.pendingBookingIds.add(bookingId)
    console.log(`[BookingAlarm] Starting alarm for: ${bookingId} (${this.pendingBookingIds.size} total)`)
    this.notifyListeners()

    await this.acquireWakeLock()
    await this.ensurePlaying()
  }

  /**
   * Stop the alarm for a specific booking.
   * Sound only stops when ALL bookings are resolved.
   */
  stopAlarm(bookingId: string): void {
    this.pendingBookingIds.delete(bookingId)
    console.log(`[BookingAlarm] Stopped alarm for: ${bookingId} (${this.pendingBookingIds.size} remaining)`)
    this.notifyListeners()

    if (this.pendingBookingIds.size === 0) {
      this.stopSound()
      this.releaseWakeLock()
      this.clearMuteState()
    }
  }

  /** Stop all alarms immediately. */
  stopAll(): void {
    this.pendingBookingIds.clear()
    this.stopSound()
    this.releaseWakeLock()
    this.clearMuteState()
    this.notifyListeners()
  }

  /**
   * Mute the alarm. Pauses audio but keeps wake lock, overlay, and pending
   * bookings visible. If durationMs is null, mute is indefinite (manual resume only).
   */
  mute(durationMs: number | null): void {
    this.clearMuteTimer()
    this.isMuted = true
    this.muteUntil = durationMs != null ? Date.now() + durationMs : null
    console.log(`[BookingAlarm] Muted${durationMs != null ? ` for ${durationMs}ms` : ' indefinitely'}`)
    this.stopSound()
    if (durationMs != null) {
      this.muteTimeoutId = setTimeout(() => this.unmute(), durationMs)
    }
    this.notifyListeners()
  }

  /** Unmute the alarm. Resumes audio if any pendings remain. */
  unmute(): void {
    if (!this.isMuted) return
    this.clearMuteTimer()
    this.isMuted = false
    this.muteUntil = null
    console.log('[BookingAlarm] Unmuted')
    this.notifyListeners()
    if (this.pendingBookingIds.size > 0) {
      void this.ensurePlaying()
    }
  }

  /** Returns a snapshot of the current mute state. */
  getMuteState(): { isMuted: boolean; muteUntil: number | null } {
    return { isMuted: this.isMuted, muteUntil: this.muteUntil }
  }

  private clearMuteTimer(): void {
    if (this.muteTimeoutId != null) {
      clearTimeout(this.muteTimeoutId)
      this.muteTimeoutId = null
    }
  }

  private clearMuteState(): void {
    this.clearMuteTimer()
    this.isMuted = false
    this.muteUntil = null
  }

  isRinging(): boolean {
    return this.pendingBookingIds.size > 0
  }

  /** Check if a specific booking ID is in the pending set. */
  hasPending(bookingId: string): boolean {
    return this.pendingBookingIds.has(bookingId)
  }

  /**
   * Remove all synthetic push-generated alarm IDs (push-*).
   * Called after reconciling with actual pending bookings from the database.
   */
  clearSyntheticAlarms(): void {
    const syntheticIds = [...this.pendingBookingIds].filter(id => id.startsWith('push-'))
    syntheticIds.forEach(id => this.pendingBookingIds.delete(id))
    if (syntheticIds.length > 0) {
      console.log(`[BookingAlarm] Cleared ${syntheticIds.length} synthetic push alarm IDs`)
      this.notifyListeners()
      if (this.pendingBookingIds.size === 0) {
        this.stopSound()
        this.releaseWakeLock()
        this.clearMuteState()
      }
    }
  }

  /** Get a cached snapshot of pending IDs (for React's useSyncExternalStore). */
  getPendingIds(): string[] {
    return this.cachedSnapshot
  }

  /** Subscribe to changes. Returns unsubscribe function (useSyncExternalStore compatible). */
  subscribe(listener: AlarmListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    // Rebuild the cached snapshot only when data changes
    this.cachedSnapshot = [...this.pendingBookingIds]
    this.listeners.forEach(fn => fn())
  }

  /**
   * Must be called from a user interaction (click/tap) to unlock browser
   * audio autoplay. Call this once on first user interaction.
   */
  unlockAudio(): void {
    if (this.audioUnlocked || this.isUnlocking) return
    this.isUnlocking = true
    // Play the actual alarm sound file briefly at near-zero volume to unlock audio context.
    // Tiny base64 data URIs can fail to decode on some browsers.
    const silent = new Audio('/sounds/booking-notification.mp3')
    silent.volume = 0.01
    silent.play().then(() => {
      silent.pause()
      silent.currentTime = 0
      this.audioUnlocked = true
      this.isUnlocking = false
      console.log('[BookingAlarm] Audio context unlocked')
      // If there were pending alarms waiting for unlock, start them now
      if (this.pendingBookingIds.size > 0) {
        this.ensurePlaying()
      }
    }).catch(() => {
      this.isUnlocking = false
    })
  }

  private async ensurePlaying(): Promise<void> {
    // Guard: muted — don't play sound
    if (this.isMuted) return
    // Guard: already playing
    if (this.audio && !this.audio.paused) return
    // Guard: another call is already starting playback
    if (this.isStartingPlayback) return
    this.isStartingPlayback = true

    try {
      if (this.audio) {
        this.audio.pause()
        this.audio = null
      }

      const audio = new Audio('/sounds/booking-notification.mp3')
      audio.loop = true
      audio.volume = 1.0

      await audio.play()
      this.audio = audio
      this.audioUnlocked = true
      console.log('[BookingAlarm] Alarm sound playing')
    } catch (err) {
      console.warn('[BookingAlarm] Could not play audio (autoplay blocked?). Will start on next user interaction.')
    } finally {
      this.isStartingPlayback = false
    }
  }

  private stopSound(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
      this.audio = null
      console.log('[BookingAlarm] Alarm sound stopped')
    }
  }

  private async acquireWakeLock(): Promise<void> {
    if (this.wakeLock) return
    if (!('wakeLock' in navigator)) return

    try {
      this.wakeLock = await navigator.wakeLock.request('screen')
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null
      })
    } catch {
      // Wake lock not available or denied
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {})
      // The 'release' event listener will set this.wakeLock = null
    }
  }

  /** Re-acquire wake lock after tab becomes visible again. */
  async reacquireWakeLock(): Promise<void> {
    if (this.pendingBookingIds.size > 0 && this.wakeLock === null) {
      await this.acquireWakeLock()
    }
  }
}

export const bookingAlarmService = new BookingAlarmService()
