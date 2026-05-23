"use client"

import { useBookingAlarm } from '@/lib/hooks/use-booking-alarm'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Ultra-slim amber banner shown at the top of all dashboard pages
 * while pending bookings exist. 26px height, compact density.
 * Hidden while the overlay is visible (controlled by parent).
 */
export function PendingBookingsBanner({ hidden }: { hidden?: boolean }) {
  const { pendingCount, isRinging } = useBookingAlarm()
  const router = useRouter()
  const pathname = usePathname()

  if (!isRinging || hidden) return null

  const handleView = () => {
    if (pathname.startsWith('/bookings')) {
      // Basic dashboard — scroll to top where bookings are
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Pro dashboard — navigate to bookings page
      router.push('/bookings')
    }
  }

  return (
    <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-3 py-1 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-[5px] w-[5px]">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-[5px] w-[5px] bg-amber-500" />
        </span>
        <span className="text-[11px] font-semibold text-amber-800">
          {pendingCount} pending booking{pendingCount !== 1 ? 's' : ''}
        </span>
      </div>
      <button
        onClick={handleView}
        className="text-[10px] text-amber-700 hover:text-amber-900 font-medium transition-colors"
      >
        View →
      </button>
    </div>
  )
}
