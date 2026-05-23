// components/dashboard/critical-alerts.tsx
"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { 
  AlertTriangle,
  Timer,
  UserCheck,
  XCircle
} from "lucide-react"
import { differenceInMinutes } from "date-fns"

interface CriticalAlertsProps {
  pendingCount: number
  awaitingCheckIn: number
  bookings: any[]
  currentTime: Date
  onViewAll?: () => void
}

export function CriticalAlerts({ 
  pendingCount, 
  awaitingCheckIn, 
  bookings, 
  currentTime,
  onViewAll
}: CriticalAlertsProps) {
  // Calculate expiring requests
  const expiringRequests = bookings.filter(b => {
    if (b.status !== 'pending' || !b.request_expires_at) return false
    const hoursLeft = differenceInMinutes(new Date(b.request_expires_at), currentTime) / 60
    return hoursLeft > 0 && hoursLeft < 2
  }).length

  // Calculate failed acceptances
  const failedAcceptances = bookings.filter(b => 
    b.status === 'pending' && b.acceptance_attempted_at
  ).length

  // Don't show anything if there are no critical issues
  if (pendingCount === 0 && awaitingCheckIn === 0 && expiringRequests === 0 && failedAcceptances === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-red-600 to-red-500 border-y border-red-700 px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/20 rounded-full motion-safe:animate-pulse">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-full">
                  <Timer className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-white">
                  {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            
            {awaitingCheckIn > 0 && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-200/20 rounded-full">
                  <UserCheck className="h-4 w-4 text-orange-100" />
                </div>
                <span className="font-semibold text-orange-100">
                  {awaitingCheckIn} awaiting seating
                </span>
              </div>
            )}
            
            {expiringRequests > 0 && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-full motion-safe:animate-bounce">
                  <Timer className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-white">
                  {expiringRequests} expiring soon!
                </span>
              </div>
            )}
            
            {failedAcceptances > 0 && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-full">
                  <XCircle className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-white">
                  {failedAcceptances} failed acceptance{failedAcceptances !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {pendingCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-0 font-medium"
            onClick={() => {
              if (onViewAll) {
                onViewAll()
              } else {
                // Scroll to the pending requests section
                document.querySelector('.pending-requests')?.scrollIntoView({ behavior: 'smooth' })
              }
            }}
          >
            View All
          </Button>
        )}
      </div>
    </div>
  )
}
