"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useRestaurantEvents } from "@/lib/hooks/use-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Search,
  Calendar,
  Users,
  Clock,
  PartyPopper,
  Filter,
  X,
  CalendarCheck,
  Sparkles,
} from "lucide-react"
import { EventCard } from "@/components/events/event-card"
import { cn } from "@/lib/utils"
import type { EventFilters } from "@/types/events"
import { EVENT_TYPES } from "@/types/events"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function EventsPage() {
  const router = useRouter()
  const { currentRestaurant, tier, isLoading: contextLoading } = useRestaurantContext()
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [filters, setFilters] = useState<EventFilters>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Set restaurant ID from context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch events
  const { data: eventsData, isLoading } = useRestaurantEvents(restaurantId, {
    ...filters,
    search: searchQuery
  })

  // Sort events: active first, then inactive (both sorted by created_at desc)
  const events = eventsData?.sort((a, b) => {
    if (a.is_active === b.is_active) {
      // If both have same active status, sort by created_at desc
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    // Active events come first
    return a.is_active ? -1 : 1
  })

  // Calculate statistics
  const stats = {
    total: events?.length || 0,
    active: events?.filter(e => e.is_active)?.length || 0,
    upcomingOccurrences: events?.reduce((acc, e) => acc + (e.occurrences?.length || 0), 0) || 0,
    totalBookings: 0, // Would need to query bookings
  }

  const handleCreateEvent = () => {
    router.push('/events/new')
  }

  const handleEventClick = (eventId: string) => {
    router.push(`/events/${eventId}`)
  }

  const handleFilterChange = (key: keyof EventFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery("")
  }

  const hasActiveFilters = Object.keys(filters).length > 0 || searchQuery

  // Loading state
  if (contextLoading || !restaurantId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Events</h1>
              <p className="text-xs text-muted-foreground">Create & manage events</p>
            </div>
          </div>
          <Button onClick={handleCreateEvent} size="sm" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {/* Pill Stats */}
          <div className="-mx-3 px-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 border-teal-200 whitespace-nowrap">
              <Sparkles className="h-3 w-3 mr-1.5" />
              {stats.total} Events
            </Badge>
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-medium bg-cyan-50 text-cyan-700 border-cyan-200 whitespace-nowrap">
              <CalendarCheck className="h-3 w-3 mr-1.5" />
              {stats.active} Active
            </Badge>
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
              <Calendar className="h-3 w-3 mr-1.5" />
              {stats.upcomingOccurrences} Upcoming
            </Badge>
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
              <Clock className="h-3 w-3 mr-1.5" />
              {events?.[0]?.occurrences?.[0] 
                ? new Date(events[0].occurrences[0].occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'No upcoming'}
            </Badge>
          </div>

          {/* Compact Search & Filters */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              size="sm"
              className="h-8 text-xs"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 bg-primary-foreground text-primary rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  ✓
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                size="sm"
                className="h-8 text-xs px-2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <Card className="border-dashed">
              <CardContent className="p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Event Type</label>
                    <Select
                      value={filters.event_type || "all"}
                      onValueChange={(value) =>
                        handleFilterChange('event_type', value === "all" ? undefined : value)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Status</label>
                    <Select
                      value={filters.status || "all"}
                      onValueChange={(value) =>
                        handleFilterChange('status', value === "all" ? undefined : value)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Events List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="motion-safe:animate-spin rounded-full h-6 w-6 border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : events && events.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => handleEventClick(event.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5 text-teal-600" />
                </div>
                <h3 className="text-sm font-semibold mb-1">No events yet</h3>
                <p className="text-xs text-muted-foreground text-center mb-3 max-w-[200px]">
                  {hasActiveFilters
                    ? "No events match your filters."
                    : "Create your first event to attract more customers."}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={handleCreateEvent} size="sm" className="h-8 text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create Event
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

