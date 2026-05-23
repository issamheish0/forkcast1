'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Clock,
  CheckCircle,
  Info,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { useWaitlistStatus, formatScheduleDisplay } from '@/lib/hooks/use-waitlist-status'
import { cn } from '@/lib/utils'

interface WaitlistStatusIndicatorProps {
  restaurantId: string
  bookingTime: Date | undefined
  tier?: string
  className?: string
  showSchedules?: boolean
}

export function WaitlistStatusIndicator({
  restaurantId,
  bookingTime,
  tier,
  className,
  showSchedules = true
}: WaitlistStatusIndicatorProps) {
  const { isWaitlistTime, isBasicTier, loading, message, schedules } = useWaitlistStatus(
    restaurantId,
    bookingTime,
    tier
  )

  if (loading) {
    return (
      <div className={cn("motion-safe:animate-pulse", className)}>
        <div className="h-12 bg-gray-200 rounded-lg"></div>
      </div>
    )
  }

  if (!isBasicTier) {
    return null // Don't show for non-basic tier restaurants
  }

  if (!bookingTime) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Select a date and time to see booking status
        </AlertDescription>
      </Alert>
    )
  }

  const alertVariant = isWaitlistTime ? "default" : "default"
  const Icon = isWaitlistTime ? Clock : CheckCircle
  const iconColor = isWaitlistTime ? "text-orange-600" : "text-green-600"

  return (
    <div className={cn("space-y-3", className)}>
      <Alert variant={alertVariant} className={cn(
        "border-2",
        isWaitlistTime ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"
      )}>
        <div className="flex items-start gap-3">
          <Icon className={cn("h-4 w-4 mt-0.5", iconColor)} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isWaitlistTime ? "secondary" : "default"} className="text-xs">
                {isWaitlistTime ? "Waitlist Mode" : "Instant Booking"}
              </Badge>
              {showSchedules && schedules && schedules.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      View Schedule
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Waitlist Schedule</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          During these times, booking requests join the waitlist for manual approval:
                        </p>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {schedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                          >
                            <span>{formatScheduleDisplay(schedule)}</span>
                            <Badge variant="outline" className="text-xs">
                              Active
                            </Badge>
                          </div>
                        ))}
                      </div>

                      {schedules.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          No active waitlist schedules
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <AlertDescription className="text-sm">
              {message}
            </AlertDescription>

            {isWaitlistTime && (
              <div className="mt-2 text-xs text-muted-foreground text-sm">💡 <strong>Tip:</strong> Try selecting a different time outside the waitlist period for instant confirmation.
              </div>
            )}
          </div>
        </div>
      </Alert>

      {/* Additional context for first-time users */}
      {isWaitlistTime && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="flex-1 text-xs text-blue-800">
              <strong>How it works:</strong> The restaurant will review your request and contact you to confirm your table.
              This typically happens within a few hours during business hours.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for inline display
export function WaitlistStatusBadge({
  restaurantId,
  bookingTime,
  tier,
  className
}: Omit<WaitlistStatusIndicatorProps, 'showSchedules'>) {
  const { isWaitlistTime, isBasicTier, loading } = useWaitlistStatus(
    restaurantId,
    bookingTime,
    tier
  )

  if (loading) {
    return <div className={cn("h-5 w-20 bg-gray-200 rounded motion-safe:animate-pulse", className)} />
  }

  if (!isBasicTier || !bookingTime) {
    return null
  }

  return (
    <Badge
      variant={isWaitlistTime ? "secondary" : "default"}
      className={cn("text-xs", className)}
    >
      {isWaitlistTime ? (
        <>
          <Clock className="h-3 w-3 mr-1" />
          Waitlist
        </>
      ) : (
        <>
          <CheckCircle className="h-3 w-3 mr-1" />
          Instant
        </>
      )}
    </Badge>
  )
}
