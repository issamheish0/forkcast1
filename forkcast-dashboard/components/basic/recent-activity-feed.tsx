// components/basic/recent-activity-feed.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, Plus, Calendar, AlertTriangle } from "lucide-react"
import { formatDistanceToNow, parseISO, isToday } from "date-fns"
import { cn } from "@/lib/utils"

interface RecentActivityFeedProps {
  bookings: any[]
}

interface ActivityItem {
  id: string
  type: 'accepted' | 'declined' | 'created' | 'cancelled' | 'modified'
  guestName: string
  timestamp: string
  bookingTime: string
  partySize: number
  modifications?: any[]
}

export function RecentActivityFeed({ bookings }: RecentActivityFeedProps) {
  // Generate activity items from bookings
  const activities: ActivityItem[] = []

  // Sort bookings by updated_at or created_at
  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at).getTime()
    const dateB = new Date(b.updated_at || b.created_at).getTime()
    return dateB - dateA
  })

  sortedBookings.forEach(booking => {
    const guestName = booking.guest_name || booking.profiles?.full_name || 'Guest'
    const timestamp = booking.updated_at || booking.created_at
    const bookingTime = booking.booking_time

    // Add modification activity if booking has been modified
    if (booking.modifications && booking.modifications.length > 0) {
      const latestModification = booking.modifications[0]
      activities.push({
        id: `${booking.id}-modified-${latestModification.id}`,
        type: 'modified',
        guestName,
        timestamp: latestModification.created_at,
        bookingTime,
        partySize: booking.party_size,
        modifications: booking.modifications,
      })
    }

    // Determine activity type based on status
    let type: ActivityItem['type'] = 'created'
    if (booking.status === 'confirmed') {
      type = 'accepted'
    } else if (booking.status === 'declined_by_restaurant') {
      type = 'declined'
    } else if (booking.status === 'cancelled_by_user' || booking.status === 'cancelled_by_restaurant') {
      type = 'cancelled'
    } else if (booking.status === 'pending') {
      type = 'created'
    }

    activities.push({
      id: booking.id,
      type,
      guestName,
      timestamp,
      bookingTime,
      partySize: booking.party_size,
    })
  })

  // Sort all activities by timestamp (most recent first)
  const sortedActivities = activities.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime()
    const dateB = new Date(b.timestamp).getTime()
    return dateB - dateA
  })

  // Take only the most recent 10 activities
  const recentActivities = sortedActivities.slice(0, 10)

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-600" />
      case 'created':
        return <Plus className="h-4 w-4 text-blue-600" />
      case 'modified':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
    }
  }

  const getActivityText = (activity: ActivityItem) => {
    const firstName = activity.guestName.split(' ')[0]
    switch (activity.type) {
      case 'accepted':
        return `${firstName}'s booking accepted`
      case 'declined':
        return `${firstName}'s booking declined`
      case 'cancelled':
        return `${firstName}'s booking cancelled`
      case 'created':
        return `${firstName}'s booking created`
      case 'modified':
        return `${firstName}'s booking modified`
    }
  }

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'accepted':
        return 'bg-green-50 border-green-200'
      case 'declined':
        return 'bg-red-50 border-red-200'
      case 'cancelled':
        return 'bg-gray-50 border-gray-200'
      case 'created':
        return 'bg-blue-50 border-blue-200'
      case 'modified':
        return 'bg-orange-50 border-orange-200'
    }
  }

  if (recentActivities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground text-sm">
            No recent activity
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 p-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  "p-3 rounded-lg border transition-all hover:shadow-sm",
                  getActivityColor(activity.type)
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {getActivityText(activity)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground text-sm"><Calendar className="h-3 w-3" />
                      <span>
                        {isToday(parseISO(activity.bookingTime))
                          ? `Today at ${new Date(activity.bookingTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                          : new Date(activity.bookingTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {activity.partySize} {activity.partySize === 1 ? 'guest' : 'guests'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground text-sm">
                      {formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
