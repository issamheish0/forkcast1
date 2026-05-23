"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RestaurantEvent } from "@/types/events"
import { formatEventDateTime, getAvailableSpots, getCapacityPercentage } from "@/types/events"
import { format } from "date-fns"

interface EventCardProps {
  event: RestaurantEvent
  onClick?: () => void
  className?: string
}

export function EventCard({ event, onClick, className }: EventCardProps) {
  const upcomingOccurrences = event.occurrences?.filter(
    occ => occ.status === 'scheduled' || occ.status === 'full'
  ) || []

  const nextOccurrence = upcomingOccurrences[0]

  const getStatusBadge = () => {
    if (!nextOccurrence) {
      return <Badge variant="secondary">No upcoming dates</Badge>
    }

    if (nextOccurrence.status === 'full') {
      return <Badge variant="destructive">Fully Booked</Badge>
    }

    const availableSpots = getAvailableSpots(nextOccurrence)
    if (availableSpots !== null && availableSpots < 10) {
      return <Badge className="bg-yellow-500 text-black">Few Spots Left</Badge>
    }

    return <Badge className="bg-green-500 text-white">Available</Badge>
  }

  const getEventTypeLabel = () => {
    const typeMap: Record<string, string> = {
      brunch: "Brunch",
      live_music: "Live Music",
      happy_hour: "Happy Hour",
      special_menu: "Special Menu",
      wine_tasting: "Wine Tasting",
      trivia_night: "Trivia Night",
      karaoke: "Karaoke",
      sports_viewing: "Sports",
      theme_night: "Theme Night",
      holiday_special: "Holiday",
    }

    return event.event_type ? typeMap[event.event_type] || event.event_type : null
  }

  const isInactive = !event.is_active

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group",
        isInactive && "opacity-60 grayscale",
        className
      )}
      onClick={onClick}
    >
      {/* Event Image */}
      {event.image_url && (
        <div className="relative h-36 overflow-hidden bg-muted">
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute top-2 right-2">
            {isInactive ? (
              <Badge variant="secondary" className="bg-gray-500 text-[10px] h-5">Inactive</Badge>
            ) : (
              getStatusBadge()
            )}
          </div>
          {event.event_type && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] h-5">
                {getEventTypeLabel()}
              </Badge>
            </div>
          )}
        </div>
      )}

      <CardHeader className="p-3 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {event.title}
            </h3>
            {event.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {event.description}
              </p>
            )}
          </div>
          {!event.image_url && (
            isInactive ? (
              <Badge variant="secondary" className="bg-gray-500 text-[10px] h-5">Inactive</Badge>
            ) : (
              getStatusBadge()
            )
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-1.5">
        {/* Next Occurrence */}
        {nextOccurrence && (
          <div className="flex items-start gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {format(new Date(nextOccurrence.occurrence_date), 'EEEE, MMM d, yyyy')}
              </p>
              {nextOccurrence.start_time && (
                <p className="text-muted-foreground">{nextOccurrence.start_time}
                  {nextOccurrence.end_time && ` - ${nextOccurrence.end_time}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Capacity Info */}
        {nextOccurrence && nextOccurrence.max_capacity && (
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">
                  {nextOccurrence.current_bookings} / {nextOccurrence.max_capacity}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Age Restriction */}
        {event.minimum_age && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Ages {event.minimum_age}+</span>
          </div>
        )}

        {/* Party Size */}
        {(event.minimum_party_size > 1 || event.maximum_party_size) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Party size:{" "}
              {event.minimum_party_size}
              {event.maximum_party_size && ` - ${event.maximum_party_size}`}
            </span>
          </div>
        )}

        {/* Multiple Occurrences Indicator */}
        {upcomingOccurrences.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium">
              +{upcomingOccurrences.length - 1} more {upcomingOccurrences.length === 2 ? 'date' : 'dates'}
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onClick?.()
          }}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  )
}
