"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useEvent, useUpdateEvent, useCreateEventOccurrences, useDeleteEvent, useEventBookings, useUpdateEventOccurrence, useDeleteEventOccurrence } from "@/lib/hooks/use-events"
import { useUpdateBooking } from "@/lib/hooks/use-bookings"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MessageSquare,
  Gift,
  User,
  Filter,
  X,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock as ClockIcon,
  Hash,
  Percent,
  MoreVertical,
  Check,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import type { CreateEventOccurrenceInput, EventOccurrence, UpdateEventOccurrenceInput } from "@/types/events"
import { formatEventDateTime, getEventStatusColor, getCapacityPercentage } from "@/types/events"
import { cn } from "@/lib/utils"

export default function EventDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params?.id as string

  const { data: event, isLoading } = useEvent(eventId)
  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useEventBookings(eventId)
  const updateEvent = useUpdateEvent()
  const createOccurrences = useCreateEventOccurrences()
  const deleteEvent = useDeleteEvent()
  const updateOccurrence = useUpdateEventOccurrence()
  const deleteOccurrence = useDeleteEventOccurrence()
  const updateBooking = useUpdateBooking()

  const [showAddOccurrence, setShowAddOccurrence] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("confirmed")
  const [expandedOccurrences, setExpandedOccurrences] = useState<Set<string>>(new Set())
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [occurrenceForm, setOccurrenceForm] = useState({
    start_time: "",
    end_time: "",
    end_date: "",
    max_capacity: null as number | null,
    special_notes: "",
  })

  // Edit occurrence state
  const [editingOccurrence, setEditingOccurrence] = useState<EventOccurrence | null>(null)
  const [showEditOccurrenceDialog, setShowEditOccurrenceDialog] = useState(false)
  const [editOccurrenceForm, setEditOccurrenceForm] = useState({
    occurrence_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    max_capacity: null as number | null,
    special_notes: "",
    status: "scheduled" as EventOccurrence["status"],
  })

  // Delete occurrence state
  const [occurrenceToDelete, setOccurrenceToDelete] = useState<string | null>(null)
  const [showDeleteOccurrenceDialog, setShowDeleteOccurrenceDialog] = useState(false)

  // Limit for maximum dates that can be selected at once
  const MAX_DATES_SELECTION = 30

  // Handle edit occurrence
  const handleEditOccurrence = (occurrence: EventOccurrence) => {
    setEditingOccurrence(occurrence)
    setEditOccurrenceForm({
      occurrence_date: occurrence.occurrence_date,
      end_date: occurrence.end_date || "",
      start_time: occurrence.start_time || "",
      end_time: occurrence.end_time || "",
      max_capacity: occurrence.max_capacity,
      special_notes: occurrence.special_notes || "",
      status: occurrence.status,
    })
    setShowEditOccurrenceDialog(true)
  }

  const handleSaveOccurrence = async () => {
    if (!editingOccurrence) return

    try {
      await updateOccurrence.mutateAsync({
        occurrenceId: editingOccurrence.id,
        updates: {
          occurrence_date: editOccurrenceForm.occurrence_date || undefined,
          end_date: editOccurrenceForm.end_date || null,
          start_time: editOccurrenceForm.start_time || null,
          end_time: editOccurrenceForm.end_time || null,
          max_capacity: editOccurrenceForm.max_capacity,
          special_notes: editOccurrenceForm.special_notes || null,
          status: editOccurrenceForm.status,
        },
      })
      setShowEditOccurrenceDialog(false)
      setEditingOccurrence(null)
    } catch (error) {
      console.error("Error updating occurrence:", error)
    }
  }

  // Handle delete occurrence
  const handleDeleteOccurrence = async () => {
    if (!occurrenceToDelete) return

    try {
      await deleteOccurrence.mutateAsync(occurrenceToDelete)
      setShowDeleteOccurrenceDialog(false)
      setOccurrenceToDelete(null)
    } catch (error) {
      console.error("Error deleting occurrence:", error)
    }
  }

  // Handle booking status change
  const handleBookingStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      await updateBooking.mutateAsync({
        bookingId,
        updates: { status: newStatus }
      })
      refetchBookings()
    } catch (error) {
      console.error("Error updating booking status:", error)
    }
  }

  const handleToggleActive = async () => {
    if (!event) return

    try {
      await updateEvent.mutateAsync({
        eventId: event.id,
        updates: { is_active: !event.is_active }
      })
      toast.success(event.is_active ? "Event deactivated" : "Event activated")
    } catch (error) {
      console.error("Error toggling event status:", error)
    }
  }

  const handleAddOccurrence = async () => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one start date")
      return
    }

    try {
      // Create occurrences for all selected dates
      const occurrencesToCreate: CreateEventOccurrenceInput[] = selectedDates.map(date => ({
        event_id: eventId,
        occurrence_date: format(date, 'yyyy-MM-dd'),
        end_date: occurrenceForm.end_date || null,
        start_time: occurrenceForm.start_time || null,
        end_time: occurrenceForm.end_time || null,
        max_capacity: occurrenceForm.max_capacity,
        special_notes: occurrenceForm.special_notes || null,
      }))

      await createOccurrences.mutateAsync(occurrencesToCreate)
      setShowAddOccurrence(false)
      setSelectedDates([])
      setOccurrenceForm({
        start_time: "",
        end_time: "",
        end_date: "",
        max_capacity: null,
        special_notes: "",
      })
    } catch (error) {
      console.error("Error creating occurrences:", error)
    }
  }

  const handleRemoveDate = (dateToRemove: Date) => {
    setSelectedDates(dates => dates.filter(d => d.getTime() !== dateToRemove.getTime()))
  }

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) {
      setSelectedDates([])
      return
    }

    if (dates.length > MAX_DATES_SELECTION) {
      toast.error(`You can only select up to ${MAX_DATES_SELECTION} dates at once`)
      return
    }

    setSelectedDates(dates)
  }

  const handleDeleteEvent = async () => {
    try {
      await deleteEvent.mutateAsync(eventId)
      toast.success("Event deleted successfully")
      router.push("/events")
    } catch (error) {
      console.error("Error deleting event:", error)
    }
  }

  const toggleOccurrence = (occurrenceId: string) => {
    setExpandedOccurrences(prev => {
      const newSet = new Set(prev)
      if (newSet.has(occurrenceId)) {
        newSet.delete(occurrenceId)
      } else {
        newSet.add(occurrenceId)
      }
      return newSet
    })
  }

  // Get bookings for a specific occurrence
  const getOccurrenceBookings = (occurrenceId: string) => {
    return bookings.filter(booking => 
      booking.event_occurrence_id === occurrenceId &&
      (bookingStatusFilter === "all" || booking.status === bookingStatusFilter)
    )
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pending": return "secondary"
      case "confirmed": return "default"
      case "cancelled_by_user":
      case "cancelled_by_restaurant":
      case "declined_by_restaurant":
        return "destructive"
      case "completed": return "default"
      default: return "outline"
    }
  }

  // Format status label
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Pending",
      confirmed: "Confirmed",
      cancelled_by_user: "Cancelled",
      cancelled_by_restaurant: "Cancelled",
      declined_by_restaurant: "Declined",
      completed: "Completed",
      no_show: "No Show"
    }
    return statusMap[status] || status
  }

  // Automatically fix any data integrity issues silently in the background
  useEffect(() => {
    if (!event?.occurrences || bookingsLoading) return

    const supabase = createClient()
    
    const checkAndFixIntegrity = async () => {
      const issues: Array<{ occurrenceId: string; stored: number; calculated: number }> = []

      // Check each occurrence for discrepancies
      event.occurrences.forEach(occ => {
        const stats = getOccurrenceStats(occ.id)
        if (occ.current_bookings !== stats.expectedCurrentBookings) {
          issues.push({
            occurrenceId: occ.id,
            stored: occ.current_bookings,
            calculated: stats.expectedCurrentBookings
          })
        }
      })

      // Silently fix any issues found
      if (issues.length > 0) {
        try {
          await Promise.all(
            issues.map(issue =>
              supabase
                .from('event_occurrences')
                .update({
                  current_bookings: issue.calculated,
                  updated_at: new Date().toISOString()
                })
                .eq('id', issue.occurrenceId)
            )
          )
          // Silently fixed - no toast notification
        } catch (error) {
          console.error('Auto-correction failed:', error)
        }
      }
    }

    checkAndFixIntegrity()
  }, [event?.occurrences, bookings, bookingsLoading])


  // Get comprehensive stats for a specific occurrence
  const getOccurrenceStats = (occurrenceId: string) => {
    const allOccurrenceBookings = bookings.filter(b => b.event_occurrence_id === occurrenceId)
    
    const confirmed = allOccurrenceBookings.filter(b => b.status === 'confirmed')
    const pending = allOccurrenceBookings.filter(b => b.status === 'pending')
    const cancelled = allOccurrenceBookings.filter(b => 
      b.status === 'cancelled_by_user' || b.status === 'cancelled_by_restaurant'
    )
    const declined = allOccurrenceBookings.filter(b => b.status === 'declined_by_restaurant')
    const completed = allOccurrenceBookings.filter(b => b.status === 'completed')
    const noShow = allOccurrenceBookings.filter(b => b.status === 'no_show')
    
    // Calculate total guests for confirmed bookings (used for revenue)
    const confirmedGuests = confirmed.reduce((sum, b) => sum + (b.party_size || 0), 0)
    const pendingGuests = pending.reduce((sum, b) => sum + (b.party_size || 0), 0)
    const completedGuests = completed.reduce((sum, b) => sum + (b.party_size || 0), 0)
    
    // Calculate expected counts (confirmed + pending for current_bookings)
    const expectedCurrentBookings = confirmedGuests + pendingGuests
    
    return {
      confirmed: { count: confirmed.length, guests: confirmedGuests },
      pending: { count: pending.length, guests: pendingGuests },
      cancelled: { count: cancelled.length, guests: cancelled.reduce((sum, b) => sum + (b.party_size || 0), 0) },
      declined: { count: declined.length, guests: declined.reduce((sum, b) => sum + (b.party_size || 0), 0) },
      completed: { count: completed.length, guests: completedGuests },
      noShow: { count: noShow.length, guests: noShow.reduce((sum, b) => sum + (b.party_size || 0), 0) },
      total: { count: allOccurrenceBookings.length, guests: allOccurrenceBookings.reduce((sum, b) => sum + (b.party_size || 0), 0) },
      expectedCurrentBookings,
    }
  }

  // Calculate revenue for an occurrence
  const calculateOccurrenceRevenue = (occurrenceId: string, occurrence: any) => {
    const stats = getOccurrenceStats(occurrenceId)
    const pricePerPerson = occurrence.override_price ?? event?.price_per_person ?? 0
    
    // Revenue from confirmed + completed guests (excluding service charge as it's for admin)
    const revenue = (stats.confirmed.guests + stats.completed.guests) * pricePerPerson
    
    return {
      revenue,
      pricePerPerson,
    }
  }

  // Calculate overall event statistics
  const getOverallStats = () => {
    if (!event?.occurrences) return null
    
    let totalConfirmedGuests = 0
    let totalPendingGuests = 0
    let totalCompletedGuests = 0
    let totalCancelledGuests = 0
    let totalDeclinedGuests = 0
    let totalRevenue = 0
    let totalCapacity = 0
    let totalConfirmedBookings = 0
    let upcomingOccurrences = 0
    let pastOccurrences = 0
    const now = new Date()
    
    event.occurrences.forEach(occ => {
      const stats = getOccurrenceStats(occ.id)
      const revenue = calculateOccurrenceRevenue(occ.id, occ)
      
      totalConfirmedGuests += stats.confirmed.guests
      totalPendingGuests += stats.pending.guests
      totalCompletedGuests += stats.completed.guests
      totalCancelledGuests += stats.cancelled.guests
      totalDeclinedGuests += stats.declined.guests
      totalConfirmedBookings += stats.confirmed.count
      totalRevenue += revenue.revenue
      
      if (occ.max_capacity) {
        totalCapacity += occ.max_capacity
      }
      
      // Count upcoming vs past
      const occDate = new Date(occ.occurrence_date)
      if (occDate > now) {
        upcomingOccurrences++
      } else {
        pastOccurrences++
      }
    })
    
    const totalActiveGuests = totalConfirmedGuests + totalPendingGuests
    const averagePartySize = totalConfirmedBookings > 0 ? Math.round(totalConfirmedGuests / totalConfirmedBookings) : 0
    
    return {
      totalConfirmedGuests,
      totalPendingGuests,
      totalCompletedGuests,
      totalCancelledGuests,
      totalDeclinedGuests,
      totalActiveGuests,
      totalRevenue,
      totalCapacity,
      totalConfirmedBookings,
      averagePartySize,
      upcomingOccurrences,
      pastOccurrences,
    }
  }

  const overallStats = getOverallStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-border" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-lg font-bold mb-1">Event Not Found</h2>
        <p className="text-sm text-muted-foreground mb-3">
          The event doesn't exist
        </p>
        <Button size="sm" onClick={() => router.push("/events")}>
          Back to Events
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-2 sm:px-4 pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">{event.title}</h1>
              <Badge variant="default" className="shrink-0 text-xs">
                {event.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {event.description && (
              <p className="text-xs text-muted-foreground truncate">{event.description}</p>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
              disabled={updateEvent.isPending}
              className="h-8 px-2 text-xs"
            >
              {event.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/events/${event.id}/edit`)}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Event Image */}
      {event.image_url && (
        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border bg-muted">
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Event Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {event.event_type && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{event.event_type.replace('_', ' ')}</span>
              </div>
            )}
            {event.minimum_age && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Age:</span>
                <span className="font-medium">{event.minimum_age}+</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Party Size:</span>
              <span className="font-medium">
                {event.minimum_party_size}
                {event.maximum_party_size && ` - ${event.maximum_party_size}`}
              </span>
            </div>
            {event.price_per_person !== undefined && event.price_per_person > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price/Person:</span>
                <span className="font-medium text-green-600">${Number(event.price_per_person).toFixed(2)}</span>
              </div>
            )}
            {event.special_requirements && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block text-xs mb-1">Requirements:</span>
                <p className="text-xs">{event.special_requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Stats & Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="text-xs font-medium">Confirmed</span>
                </div>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {overallStats?.totalConfirmedGuests || 0}
                </p>
                <p className="text-xs text-muted-foreground">guests</p>
              </div>
              
              <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 mb-0.5">
                  <ClockIcon className="h-3 w-3" />
                  <span className="text-xs font-medium">Pending</span>
                </div>
                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                  {overallStats?.totalPendingGuests || 0}
                </p>
                <p className="text-xs text-muted-foreground">guests</p>
              </div>
            </div>

            {/* Revenue */}
            {event.price_per_person !== undefined && event.price_per_person > 0 && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-0.5">
                  <DollarSign className="h-3 w-3" />
                  <span className="text-xs font-medium">Expected Revenue</span>
                </div>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  ${overallStats?.totalRevenue?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overallStats?.totalConfirmedGuests || 0} guests @ ${Number(event.price_per_person).toFixed(2)}/ea
                </p>
              </div>
            )}

            {/* Summary Stats */}
            <div className="space-y-1.5 pt-2 border-t text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Dates:</span>
                <span className="font-medium">
                  {event.occurrences?.length || 0}
                  {overallStats && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({overallStats.upcomingOccurrences}↑ {overallStats.pastOccurrences}↓)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity:</span>
                <span className="font-medium">
                  {overallStats?.totalCapacity || 'Unlimited'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fill Rate:</span>
                <span className="font-medium">
                  {overallStats?.totalCapacity 
                    ? `${Math.round((overallStats.totalActiveGuests / overallStats.totalCapacity) * 100)}%`
                    : 'N/A'
                  }
                </span>
              </div>
              {overallStats && overallStats.averagePartySize > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Party:</span>
                  <span className="font-medium">{overallStats.averagePartySize}</span>
                </div>
              )}
              {overallStats && (overallStats.totalCancelledGuests > 0 || overallStats.totalDeclinedGuests > 0) && (
                <div className="flex justify-between pt-1.5 border-t">
                  <span className="text-muted-foreground">Cancelled:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {overallStats.totalCancelledGuests + overallStats.totalDeclinedGuests}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Occurrences with Bookings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Event Dates & Bookings</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                View bookings for each occurrence
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={bookingStatusFilter} onValueChange={setBookingStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled_by_user">Cancelled</SelectItem>
                  <SelectItem value="declined_by_restaurant">Declined</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setShowAddOccurrence(true)}
                size="sm"
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {event.occurrences && event.occurrences.length > 0 ? (
            <div className="space-y-3">
              {event.occurrences.map((occurrence) => {
                const occurrenceBookings = getOccurrenceBookings(occurrence.id)
                const isExpanded = expandedOccurrences.has(occurrence.id)
                const stats = getOccurrenceStats(occurrence.id)
                const revenue = calculateOccurrenceRevenue(occurrence.id, occurrence)
                const isDataValid = occurrence.current_bookings === stats.expectedCurrentBookings
                
                return (
                  <Collapsible 
                    key={occurrence.id}
                    open={isExpanded}
                    onOpenChange={() => toggleOccurrence(occurrence.id)}
                  >
                    <Card className={cn(
                      "overflow-hidden",
                      !isDataValid && "border-red-300 dark:border-red-700"
                    )}>
                      <div className="flex items-start">
                        <CollapsibleTrigger asChild className="flex-1">
                          <button className="w-full text-left p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                {/* Date and Time */}
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="text-left">
                                    <p className="font-medium text-sm">
                                      {format(new Date(occurrence.occurrence_date), 'EEE, MMM d')}
                                      {occurrence.start_time && `, ${occurrence.start_time}`}
                                      {' → '}
                                      {occurrence.end_date 
                                        ? format(new Date(occurrence.end_date), 'EEE, MMM d')
                                        : format(new Date(occurrence.occurrence_date), 'EEE, MMM d')}
                                      {occurrence.end_time && `, ${occurrence.end_time}`}
                                    </p>
                                  </div>
                                </div>

                                {/* Stats Grid - Compact */}
                                <div className="grid grid-cols-4 gap-2 ml-6">
                                {/* Confirmed */}
                                <div className="flex items-center gap-1.5">
                                  <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                                      {stats.confirmed.guests}
                                    </p>
                                  </div>
                                </div>

                                {/* Pending */}
                                <div className="flex items-center gap-1.5">
                                  <div className="p-1 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                                    <ClockIcon className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                                      {stats.pending.guests}
                                    </p>
                                  </div>
                                </div>

                                {/* Capacity */}
                                {occurrence.max_capacity && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                                      <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="text-left">
                                      <p className="text-xs font-semibold">
                                        {stats.confirmed.guests}/{occurrence.max_capacity}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Revenue */}
                                {revenue.pricePerPerson > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded">
                                      <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="text-left">
                                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        ${revenue.revenue.toFixed(0)}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Cancelled/Declined summary */}
                              {(stats.cancelled.count > 0 || stats.declined.count > 0 || stats.noShow.count > 0) && (
                                <div className="flex items-center gap-3 ml-6 text-xs text-muted-foreground">
                                  {stats.cancelled.count > 0 && (
                                    <span className="flex items-center gap-1">
                                      <XCircle className="h-3 w-3 text-red-400" />
                                      {stats.cancelled.count} cancelled
                                    </span>
                                  )}
                                  {stats.declined.count > 0 && (
                                    <span className="flex items-center gap-1">
                                      <XCircle className="h-3 w-3 text-orange-400" />
                                      {stats.declined.count} declined
                                    </span>
                                  )}
                                  {stats.noShow.count > 0 && (
                                    <span className="flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                                      {stats.noShow.count} no-show
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Status Badge and Chevron */}
                              <Badge
                                variant={occurrence.status === 'scheduled' ? 'default' : 'secondary'}
                                className={cn(
                                  "text-xs",
                                  occurrence.status === 'full' && 'bg-yellow-500',
                                  occurrence.status === 'scheduled' && 'bg-green-500'
                                )}
                              >
                                {occurrence.status}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </button>
                        </CollapsibleTrigger>

                        {/* Action Buttons - Outside of trigger */}
                        <div className="flex items-center gap-1.5 shrink-0 p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditOccurrence(occurrence)
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOccurrenceToDelete(occurrence.id)
                              setShowDeleteOccurrenceDialog(true)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="border-t bg-muted/30 p-3">
                          {bookingsLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="animate-spin rounded-full h-6 w-6 border-4 border-border" />
                            </div>
                          ) : occurrenceBookings.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-xs text-muted-foreground">
                                  {bookingStatusFilter === 'confirmed' ? 'Confirmed' : bookingStatusFilter === 'all' ? 'All' : formatStatus(bookingStatusFilter)} ({occurrenceBookings.length})
                                </h4>
                                <div className="text-xs text-muted-foreground">
                                  {occurrenceBookings.reduce((sum, b) => sum + (b.party_size || 0), 0)} guests
                                </div>
                              </div>
                              {occurrenceBookings.map((booking) => {
                                const customer = Array.isArray(booking.profiles)
                                  ? booking.profiles[0]
                                  : booking.profiles
                                const guestName = booking.guest_name || customer?.full_name || "Unknown"
                                const guestEmail = booking.guest_email || customer?.email
                                const guestPhone = booking.guest_phone || customer?.phone_number

                                return (
                                  <Card key={booking.id} className="p-2 bg-background">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                          <span className="font-semibold text-sm truncate">{guestName}</span>
                                          <Badge 
                                            variant={getStatusBadgeVariant(booking.status)}
                                            className="text-xs"
                                          >
                                            {formatStatus(booking.status)}
                                          </Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground ml-5">
                                          <div className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            <span>{booking.party_size}</span>
                                          </div>
                                          {guestPhone && (
                                            <div className="flex items-center gap-1">
                                              <Phone className="h-3 w-3" />
                                              <span>{guestPhone}</span>
                                            </div>
                                          )}
                                          {booking.confirmation_code && (
                                            <div className="flex items-center gap-1">
                                              <Hash className="h-3 w-3" />
                                              <span className="font-mono">{booking.confirmation_code}</span>
                                            </div>
                                          )}
                                        </div>

                                        {booking.special_requests && (
                                          <div className="mt-1 p-1.5 bg-muted/50 rounded text-xs ml-5">
                                            <span className="text-muted-foreground line-clamp-2">
                                              {booking.special_requests}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-start gap-1">
                                        <div className="text-right text-xs text-muted-foreground shrink-0">
                                          <div>{format(new Date(booking.created_at), 'MMM d')}</div>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                              <MoreVertical className="h-3.5 w-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuLabel className="text-xs">Change Status</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                              className="text-xs"
                                              disabled={booking.status === 'confirmed'}
                                              onClick={() => handleBookingStatusChange(booking.id, 'confirmed')}
                                            >
                                              <Check className="h-3.5 w-3.5 mr-2 text-green-600" />
                                              Confirm
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              className="text-xs"
                                              disabled={booking.status === 'completed'}
                                              onClick={() => handleBookingStatusChange(booking.id, 'completed')}
                                            >
                                              <Check className="h-3.5 w-3.5 mr-2 text-blue-600" />
                                              Mark Completed
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              className="text-xs"
                                              disabled={booking.status === 'no_show'}
                                              onClick={() => handleBookingStatusChange(booking.id, 'no_show')}
                                            >
                                              <X className="h-3.5 w-3.5 mr-2 text-orange-600" />
                                              Mark No-Show
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                              className="text-xs text-destructive"
                                              disabled={booking.status === 'cancelled_by_restaurant'}
                                              onClick={() => handleBookingStatusChange(booking.id, 'cancelled_by_restaurant')}
                                            >
                                              <X className="h-3.5 w-3.5 mr-2" />
                                              Cancel Booking
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              className="text-xs text-destructive"
                                              disabled={booking.status === 'declined_by_restaurant'}
                                              onClick={() => handleBookingStatusChange(booking.id, 'declined_by_restaurant')}
                                            >
                                              <X className="h-3.5 w-3.5 mr-2" />
                                              Decline Booking
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </Card>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <Users className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                              <p className="text-xs text-muted-foreground">
                                No bookings yet
                              </p>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <h3 className="font-semibold text-sm mb-1">No dates scheduled</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Add dates to make this event bookable
              </p>
              <Button size="sm" onClick={() => setShowAddOccurrence(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Date
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Occurrence Dialog */}
      <Dialog open={showAddOccurrence} onOpenChange={setShowAddOccurrence}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Event Dates</DialogTitle>
            <DialogDescription className="text-xs">
              Select start dates, then set time range
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Calendar for start date selection */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Start Dates</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedDates.length}/{MAX_DATES_SELECTION}
                </span>
              </div>
              <div className="flex justify-center">
                <CalendarComponent
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={handleDateSelect}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="rounded-md border"
                  numberOfMonths={1}
                />
              </div>
              {selectedDates.length >= MAX_DATES_SELECTION && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Maximum reached
                </p>
              )}
            </div>

            {/* Selected dates display */}
            {selectedDates.length > 0 && (
              <div>
                <Label className="mb-1.5 block text-sm">
                  Selected ({selectedDates.length})
                </Label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-muted rounded-md max-h-20 overflow-y-auto">
                  {selectedDates
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((date, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1 text-xs"
                      >
                        {format(date, 'MMM d')}
                        <button
                          type="button"
                          onClick={() => handleRemoveDate(date)}
                          className="ml-0.5 hover:bg-background/50 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Start & End settings */}
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Start</Label>
                <div className="mt-1.5">
                  <Label htmlFor="start_time" className="text-xs">Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={occurrenceForm.start_time || ""}
                    onChange={(e) =>
                      setOccurrenceForm(prev => ({ ...prev, start_time: e.target.value }))
                    }
                    className="mt-1 h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">End</Label>
                <div className="grid gap-2 grid-cols-2 mt-1.5">
                  <div>
                    <Label htmlFor="end_date" className="text-xs">Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={occurrenceForm.end_date || ""}
                      onChange={(e) =>
                        setOccurrenceForm(prev => ({ ...prev, end_date: e.target.value }))
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time" className="text-xs">Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={occurrenceForm.end_time || ""}
                      onChange={(e) =>
                        setOccurrenceForm(prev => ({ ...prev, end_time: e.target.value }))
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Leave end date empty if same day</p>
              </div>

              <div>
                <Label htmlFor="max_capacity" className="text-xs">Max Capacity</Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min="1"
                  value={occurrenceForm.max_capacity || ""}
                  onChange={(e) =>
                    setOccurrenceForm(prev => ({
                      ...prev,
                      max_capacity: e.target.value ? parseInt(e.target.value) : null
                    }))
                  }
                  placeholder="Unlimited"
                  className="mt-1 h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddOccurrence(false)
                setSelectedDates([])
              }}
              disabled={createOccurrences.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddOccurrence}
              disabled={createOccurrences.isPending || selectedDates.length === 0}
            >
              {createOccurrences.isPending 
                ? "Adding..." 
                : selectedDates.length > 0 
                  ? `Add ${selectedDates.length}` 
                  : "Select Dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Event</DialogTitle>
            <DialogDescription className="text-xs">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteEvent.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteEvent}
              disabled={deleteEvent.isPending}
            >
              {deleteEvent.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Occurrence Dialog */}
      <Dialog open={showEditOccurrenceDialog} onOpenChange={setShowEditOccurrenceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Event Date</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Start</Label>
              <div className="grid gap-2 grid-cols-2 mt-1.5">
                <div>
                  <Label htmlFor="edit_occurrence_date" className="text-xs">Date</Label>
                  <Input
                    id="edit_occurrence_date"
                    type="date"
                    value={editOccurrenceForm.occurrence_date || ""}
                    onChange={(e) =>
                      setEditOccurrenceForm(prev => ({ ...prev, occurrence_date: e.target.value }))
                    }
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_start_time" className="text-xs">Time</Label>
                  <Input
                    id="edit_start_time"
                    type="time"
                    value={editOccurrenceForm.start_time || ""}
                    onChange={(e) =>
                      setEditOccurrenceForm(prev => ({ ...prev, start_time: e.target.value }))
                    }
                    className="mt-1 h-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">End</Label>
              <div className="grid gap-2 grid-cols-2 mt-1.5">
                <div>
                  <Label htmlFor="edit_end_date" className="text-xs">Date</Label>
                  <Input
                    id="edit_end_date"
                    type="date"
                    value={editOccurrenceForm.end_date || ""}
                    onChange={(e) =>
                      setEditOccurrenceForm(prev => ({ ...prev, end_date: e.target.value }))
                    }
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_end_time" className="text-xs">Time</Label>
                  <Input
                    id="edit_end_time"
                    type="time"
                    value={editOccurrenceForm.end_time || ""}
                    onChange={(e) =>
                      setEditOccurrenceForm(prev => ({ ...prev, end_time: e.target.value }))
                    }
                    className="mt-1 h-9"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Leave end date empty if same day</p>
            </div>

            <div>
              <Label htmlFor="edit_max_capacity" className="text-xs">Max Capacity</Label>
              <Input
                id="edit_max_capacity"
                type="number"
                min="1"
                value={editOccurrenceForm.max_capacity || ""}
                onChange={(e) =>
                  setEditOccurrenceForm(prev => ({
                    ...prev,
                    max_capacity: e.target.value ? parseInt(e.target.value) : null
                  }))
                }
                placeholder="Unlimited"
                className="mt-1 h-9"
              />
            </div>

            <div>
              <Label htmlFor="edit_status" className="text-xs">Status</Label>
              <Select
                value={editOccurrenceForm.status}
                onValueChange={(value: EventOccurrence["status"]) =>
                  setEditOccurrenceForm(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_special_notes" className="text-xs">Special Notes</Label>
              <Textarea
                id="edit_special_notes"
                value={editOccurrenceForm.special_notes || ""}
                onChange={(e) =>
                  setEditOccurrenceForm(prev => ({ ...prev, special_notes: e.target.value }))
                }
                placeholder="Any special notes for this date..."
                className="mt-1 h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowEditOccurrenceDialog(false)
                setEditingOccurrence(null)
              }}
              disabled={updateOccurrence.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveOccurrence}
              disabled={updateOccurrence.isPending}
            >
              {updateOccurrence.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Occurrence Confirmation Dialog */}
      <Dialog open={showDeleteOccurrenceDialog} onOpenChange={setShowDeleteOccurrenceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Event Date</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently delete this event date and cannot be undone. 
              Any existing bookings for this date will need to be handled separately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowDeleteOccurrenceDialog(false)
                setOccurrenceToDelete(null)
              }}
              disabled={deleteOccurrence.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteOccurrence}
              disabled={deleteOccurrence.isPending}
            >
              {deleteOccurrence.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}