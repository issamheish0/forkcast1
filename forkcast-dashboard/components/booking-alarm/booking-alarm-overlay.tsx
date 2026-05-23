"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useBookingAlarm } from '@/lib/hooks/use-booking-alarm'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { Bell, BellOff, VolumeX } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const SNOOZE_OPTIONS: Array<{ label: string; durationMs: number | null }> = [
  { label: '1 min', durationMs: 1 * 60 * 1000 },
  { label: '5 min', durationMs: 5 * 60 * 1000 },
  { label: '10 min', durationMs: 10 * 60 * 1000 },
  { label: '30 min', durationMs: 30 * 60 * 1000 },
  { label: 'Until I resume', durationMs: null },
]

function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function BookingAlarmOverlay() {
  const router = useRouter()
  const pathname = usePathname()
  const { hasFeature } = useRestaurantContext()
  const { isRinging, pendingCount, isMuted, muteUntil, mute, unmute } = useBookingAlarm()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Live countdown tick while a timed mute is active
  useEffect(() => {
    if (!isMuted || muteUntil == null) return
    const tick = () => {
      const current = Date.now()
      setNow(current)
      // Safety: if the service setTimeout got throttled (e.g. backgrounded tab)
      // and the deadline passed, force-unmute from the UI side.
      if (current >= muteUntil) {
        unmute()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isMuted, muteUntil, unmute])

  if (!isRinging || !pendingCount) return null

  const handleViewBookings = () => {
    // Pages that already surface pending bookings inline — don't redirect away.
    const isOnFloorplan = pathname === '/floorplan' || pathname.startsWith('/floorplan/')
    const isOnBasicDashboard = pathname === '/bookings'
    const isOnBookings = pathname === '/bookings' || pathname.startsWith('/bookings/')

    if (isOnBasicDashboard) {
      const bookingsSection = document.getElementById('bookings-section')
      if (bookingsSection) {
        bookingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        bookingsSection.classList.add('highlight-booking-section')
        setTimeout(() => {
          bookingsSection.classList.remove('highlight-booking-section')
        }, 2000)
      }
      return
    }

    if (isOnFloorplan || isOnBookings) {
      // Already on a page that shows pending bookings — stay put.
      return
    }

    // Navigate to bookings management page
    router.push('/bookings')
  }

  const handleSnoozeSelect = (durationMs: number | null) => {
    mute(durationMs)
    setPopoverOpen(false)
  }

  const countdownLabel = (() => {
    if (!isMuted) return null
    if (muteUntil == null) return 'Muted — tap Resume'
    return `Resumes in ${formatCountdown(muteUntil - now)}`
  })()

  return (
    <div className="fixed top-4 right-4 z-[9999]">
      <div
        className={`w-80 rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 border ${
          isMuted
            ? 'bg-slate-700 border-slate-800'
            : 'bg-[#7A2E4A] border-[#5c2237]'
        }`}
      >
        {/* Main clickable area — navigate to bookings */}
        <button
          type="button"
          onClick={handleViewBookings}
          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              {isMuted ? (
                <BellOff className="h-5 w-5 text-white" />
              ) : (
                <Bell className="h-5 w-5 text-white animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white">
                {isMuted
                  ? `${pendingCount} pending — muted`
                  : `${pendingCount} New ${pendingCount === 1 ? 'Booking' : 'Bookings'}`}
              </h3>
              <p className="text-xs text-white/70 mt-0.5">
                {isMuted ? countdownLabel : 'Tap to view and manage'}
              </p>
            </div>
          </div>
        </button>

        {/* Action row */}
        <div className="flex items-stretch border-t border-white/10">
          {isMuted ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                unmute()
              }}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors min-h-[44px]"
              style={{ touchAction: 'manipulation' }}
            >
              Resume now
            </button>
          ) : (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors min-h-[44px] flex items-center justify-center gap-2"
                  style={{ touchAction: 'manipulation' }}
                >
                  <VolumeX className="h-4 w-4" />
                  Mute alarm
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-64 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Mute alarm for
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SNOOZE_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleSnoozeSelect(option.durationMs)}
                      className={`rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors min-h-[44px] ${
                        option.durationMs == null ? 'col-span-2' : ''
                      }`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  The overlay and pending count stay visible while muted. New
                  bookings won&apos;t ring until you resume.
                </p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Highlight animation styles */}
      <style jsx>{`
        :global(.highlight-booking-section) {
          animation: highlightPulse 2s ease-in-out;
        }

        @keyframes highlightPulse {
          0% {
            background-color: rgba(var(--color-primary-rgb, 195, 119, 150), 0.2);
            border-color: rgba(var(--color-primary-rgb, 195, 119, 150), 0.5);
          }
          50% {
            background-color: rgba(var(--color-primary-rgb, 195, 119, 150), 0.1);
            border-color: rgba(var(--color-primary-rgb, 195, 119, 150), 0.3);
          }
          100% {
            background-color: transparent;
            border-color: var(--border);
          }
        }
      `}</style>
    </div>
  )
}
