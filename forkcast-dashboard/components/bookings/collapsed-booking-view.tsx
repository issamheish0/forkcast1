// components/bookings/collapsed-booking-view.tsx
"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Calendar,
  Clock,
  AlarmClock,
  Users,
  Phone,
  Mail,
  MapPin,
  Star,
  StickyNote,
  Table,
  UtensilsCrossed,
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Loader2,
  Check,
  X,
  ShieldCheck,
  PartyPopper,
  FileText,
  MessageSquare,
  Gift,
  Tag,
  Edit
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"
import type { Booking } from "@/types"
import { BookingModificationIndicator } from "@/components/basic/booking-modification-indicator"
import { TableSelectionModal } from "@/components/dashboard/table-selection-modal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BookingWarningsDialog } from "./booking-warnings-dialog"
import { getAcceptanceWarnings, sortWarnings, type BookingWarning } from "@/lib/booking-warnings"

interface CollapsedBookingViewProps {
  bookings: Booking[]
  isLoading: boolean
  onSelectBooking: (booking: Booking) => void
  onUpdateStatus: (bookingId: string, status: string) => void
  onRequestDecline?: (booking: Booking) => void
  onCancelBooking?: (booking: Booking) => void
  onOpenRestaurantNote?: (booking: Booking) => void
  onModifyBooking?: (booking: Booking) => void
  isActionLoading?: boolean
  restaurantId?: string
  onRefresh?: () => void
  // Floor plan addon props
  hasFloorPlan?: boolean
  allTables?: any[]
  allBookingsForConflicts?: any[] // All bookings (unfiltered) for table conflict detection
  onAssignTables?: (bookingId: string, tableIds: string[]) => void
  isAssigningTables?: boolean
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  'pending': {
    icon: Timer,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Pending'
  },
  'pending_payment': {
    icon: Timer,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Awaiting Payment'
  },
  'confirmed': {
    icon: CheckCircle,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    label: 'Confirmed'
  },
  'arrived': {
    icon: AlertCircle,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    label: 'Arrived'
  },
  'seated': {
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Seated'
  },
  'ordered': {
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Ordered'
  },
  'appetizers': {
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Appetizers'
  },
  'main_course': { 
    icon: Users, 
    color: 'text-green-700', 
    bgColor: 'bg-green-200',
    label: 'Main Course'
  },
  'dessert': { 
    icon: Users, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-100',
    label: 'Dessert'
  },
  'payment': { 
    icon: Clock, 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-200',
    label: 'Payment'
  },
  'completed': { 
    icon: CheckCircle, 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100',
    label: 'Completed'
  },
  'cancelled_by_user': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Cancelled by User'
  },
  'cancelled_by_restaurant': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Cancelled by Restaurant'
  },
  'declined_by_restaurant': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Declined'
  },
  'auto_declined': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Auto Declined'
  },
  'no_show': { 
    icon: AlertCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'No Show'
  }
}

export function CollapsedBookingView({
  bookings,
  isLoading,
  onSelectBooking,
  onUpdateStatus,
  onRequestDecline,
  onCancelBooking,
  onOpenRestaurantNote,
  onModifyBooking,
  isActionLoading,
  restaurantId,
  onRefresh,
  hasFloorPlan = false,
  allTables = [],
  allBookingsForConflicts,
  onAssignTables,
  isAssigningTables = false,
}: CollapsedBookingViewProps) {
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState<number>(() => Date.now())
  const [actionLockById, setActionLockById] = useState<Record<string, boolean>>({})
  const [tableInputs, setTableInputs] = useState<Record<string, string>>({})
  const [isUpdatingTable, setIsUpdatingTable] = useState<Record<string, boolean>>({})
  const [editingTable, setEditingTable] = useState<Record<string, boolean>>({})
  const [localTableAssignments, setLocalTableAssignments] = useState<Record<string, string>>({})
  const [showModifyConfirmDialog, setShowModifyConfirmDialog] = useState(false)
  const [bookingToModify, setBookingToModify] = useState<Booking | null>(null)
  const [tableSelectionBooking, setTableSelectionBooking] = useState<Booking | null>(null)
  const [acceptWarnings, setAcceptWarnings] = useState<{
    isOpen: boolean
    bookingId: string | null
    warnings: BookingWarning[]
    isLoading: boolean
  }>({
    isOpen: false,
    bookingId: null,
    warnings: [],
    isLoading: false
  })
  const supabase = createClient()

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const formatElapsedShort = (createdAt?: string) => {
    if (!createdAt) return ""
    const start = new Date(createdAt).getTime()
    if (!Number.isFinite(start)) return ""
    const diffMs = Math.max(0, nowTs - start)
    const totalSeconds = Math.floor(diffMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${totalSeconds % 60}s`
    return `${totalSeconds}s`
  }

  const withActionLock = (bookingId: string, fn: () => void) => {
    if (actionLockById[bookingId]) return
    setActionLockById((prev) => ({ ...prev, [bookingId]: true }))
    try {
      fn()
    } finally {
      // Prevent accidental double taps/clicks
      window.setTimeout(() => {
        setActionLockById((prev) => {
          const next = { ...prev }
          delete next[bookingId]
          return next
        })
      }, 800)
    }
  }

  const handleTableChange = (bookingId: string, value: string) => {
    setTableInputs(prev => ({
      ...prev,
      [bookingId]: value
    }))
  }

  const handleTableClick = (bookingId: string, currentTable: string) => {
    setEditingTable(prev => ({ ...prev, [bookingId]: true }))
    setTableInputs(prev => ({ ...prev, [bookingId]: currentTable }))
  }

  const handleCancelEdit = (bookingId: string) => {
    setEditingTable(prev => ({ ...prev, [bookingId]: false }))
    setTableInputs(prev => ({ ...prev, [bookingId]: '' }))
  }

  const handleApplyTable = async (bookingId: string) => {
    const tableNumber = tableInputs[bookingId]?.trim()
    if (!tableNumber) {
      toast.error("Please enter a table number")
      return
    }

    setIsUpdatingTable(prev => ({ ...prev, [bookingId]: true }))

    try {
      // Update the booking with the assigned table number
      const { error } = await supabase
        .from('bookings')
        .update({ 
          assigned_table: tableNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (error) {
        console.error('Error updating table assignment:', error)
        toast.error("Failed to assign table")
        return
      }

      toast.success(`Table ${tableNumber} assigned successfully`)
      
      // Update local state to show the new table assignment immediately
      setLocalTableAssignments(prev => ({ ...prev, [bookingId]: tableNumber }))
      
      // Clear the input and exit edit mode after successful update
      setTableInputs(prev => ({ ...prev, [bookingId]: '' }))
      setEditingTable(prev => ({ ...prev, [bookingId]: false }))
      
      // Trigger refresh to get updated data from database
      if (onRefresh) {
        onRefresh()
      }
      
    } catch (error) {
      console.error('Error updating table assignment:', error)
      toast.error("Failed to assign table")
    } finally {
      setIsUpdatingTable(prev => ({ ...prev, [bookingId]: false }))
    }
  }

  const formatGuestName = (booking: Booking) => {
    // Handle both array and object formats for profiles
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    return booking.guest_name || customer?.full_name || 'Guest'
  }

  const formatGuestPhone = (booking: Booking) => {
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    return booking.guest_phone || customer?.phone_number || 'No phone'
  }

  const formatGuestEmail = (booking: Booking) => {
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    return booking.guest_email || customer?.email || ''
  }

  // Get tables from booking_tables join (for floor plan addon)
  const getBookingTables = (booking: Booking): any[] => {
    const tables = booking.tables
    if (Array.isArray(tables) && tables.length > 0) {
      return tables.filter(Boolean)
    }
    return []
  }

  const getAssignedTable = (booking: Booking) => {
    // If floor plan addon is active, show from booking_tables join
    if (hasFloorPlan) {
      const tables = getBookingTables(booking)
      if (tables.length > 0) {
        return tables.map((t: any) => t.table_number).join(', ')
      }
      return null
    }

    // Check local state first (for recently assigned tables)
    if (localTableAssignments[booking.id]) {
      return localTableAssignments[booking.id]
    }

    // Check if assigned_table field exists and has a valid value
    // booking.assigned_table will be null (object) if not set, so we need to check for that
    if (booking.assigned_table !== null &&
        booking.assigned_table !== undefined &&
        booking.assigned_table.trim() !== '') {
      return booking.assigned_table
    }

    return null
  }

  const getStatusBadgeVariant = (status: string): any => {
    const diningStatuses = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
    
    if (diningStatuses.includes(status)) return 'default'
    if (status === 'confirmed') return 'secondary'
    if (status === 'pending') return 'outline'
    if (status === 'arrived') return 'default'
    if (status === 'completed') return 'outline'
    if (['cancelled_by_user', 'cancelled_by_restaurant', 'declined_by_restaurant', 'no_show'].includes(status)) {
      return 'destructive'
    }
    return 'secondary'
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
          <p className="text-muted-foreground">No bookings match your current filters</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {bookings.map((booking) => {
        const bookingTime = new Date(booking.booking_time)
        const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG['pending']
        const StatusIcon = statusConfig.icon
        const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
        const isExpanded = expandedBookingId === booking.id
        const pendingElapsed = ["pending", "pending_payment"].includes(booking.status) ? formatElapsedShort(booking.created_at) : ""
        const actionLocked = !!actionLockById[booking.id]
        const disableActions = Boolean(isActionLoading) || actionLocked
        const sourceInfo = (() => {
          switch (booking.source) {
            case 'widget':
              return { text: 'Widget', className: 'bg-green-100 text-green-800 border-green-200', textClass: 'text-green-700' }
            case 'event_widget':
              return { text: 'Event Widget', className: 'bg-purple-100 text-purple-800 border-purple-200', textClass: 'text-purple-700' }
            case 'app':
              return { text: 'App', className: 'bg-blue-100 text-blue-800 border-blue-200', textClass: 'text-blue-700' }
            case 'manual':
              return { text: 'Manual', className: 'bg-gray-100 text-gray-800 border-gray-200', textClass: 'text-slate-700' }
            default:
              return booking.source ? { text: booking.source, className: 'bg-gray-100 text-gray-800 border-gray-200', textClass: 'text-slate-700' } : null
          }
        })()

        return (
          <Card
            key={booking.id}
            className={cn(
              "relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer",
              booking.status === "pending" && "bg-yellow-50/30",
              (booking.status as string) === "pending_payment" && "bg-amber-50/30"
            )}
            onClick={() => setExpandedBookingId(prev => (prev === booking.id ? null : booking.id))}
          >
            <CardContent className="relative p-3 min-h-[72px]">
              {/* Left status stripe (pulse only for pending) */}
              <div
                aria-hidden
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  // Always show a left status stripe
                  booking.status === "pending" && "bg-yellow-600 animate-[pulse_0.75s_ease-in-out_infinite]",
                  booking.status === "confirmed" && "bg-green-500",
                  booking.status === "completed" && "bg-blue-500",
                  booking.status === "declined_by_restaurant" && "bg-red-500",
                  booking.status === "auto_declined" && "bg-red-500",
                  booking.status === "cancelled_by_user" && "bg-red-500",
                  booking.status === "cancelled_by_restaurant" && "bg-red-500",
                  booking.status === "no_show" && "bg-red-500",
                  // dining flow statuses (neutral/brand-ish)
                  booking.status === "arrived" && "bg-indigo-500",
                  booking.status === "seated" && "bg-purple-500",
                  booking.status === "ordered" && "bg-orange-500",
                  booking.status === "appetizers" && "bg-green-500",
                  booking.status === "main_course" && "bg-green-600",
                  booking.status === "dessert" && "bg-pink-500",
                  booking.status === "payment" && "bg-yellow-600",
                  // fallback
                  ![
                    "pending",
                    "confirmed",
                    "completed",
                    "declined_by_restaurant",
                    "auto_declined",
                    "cancelled_by_user",
                    "cancelled_by_restaurant",
                    "no_show",
                    "arrived",
                    "seated",
                    "ordered",
                    "appetizers",
                    "main_course",
                    "dessert",
                    "payment",
                  ].includes(booking.status) && "bg-slate-300"
                )}
              />
              {/* Event indicator (bottom-right of whole row) */}
              {booking.is_event_booking && (
                <div
                  className="absolute bottom-1 right-1 z-10 h-5 w-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs pointer-events-none"
                  aria-label="Event booking"
                  title="Event booking"
                >
                  🎉
                </div>
              )}
              {/* Source Badge - Top Left */}
              {sourceInfo && (
                <div
                  className={cn(
                    "absolute top-1 left-2 z-10 text-[10px] font-semibold leading-none pointer-events-none whitespace-nowrap",
                    sourceInfo.textClass
                  )}
                  title={`Source: ${sourceInfo.text}`}
                >
                  {sourceInfo.text}
                </div>
              )}
              
              {/* Icons Only - Top Right */}
              <div className="absolute top-1 right-2 z-10 flex items-center gap-1 pointer-events-none">
                {/* Multiple Icons - One for each type of note/info */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Special Requests Icon */}
                  {booking.special_requests && 
                    typeof booking.special_requests === 'string' && 
                    booking.special_requests.trim().length > 0 && (
                    <div 
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white border border-blue-700 shadow-sm"
                      title={`Special Request: ${booking.special_requests}`}
                    >
                      <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                  )}
                  
                  {/* Dietary Notes Icon */}
                  {booking.dietary_notes && 
                    Array.isArray(booking.dietary_notes) && 
                    booking.dietary_notes.length > 0 && (
                    <div 
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white border border-green-700 shadow-sm"
                      title={`Dietary Notes: ${booking.dietary_notes.join(', ')}`}
                    >
                      <UtensilsCrossed className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                  )}
                  
                  {/* Restaurant Notes Icon */}
                  {(() => {
                    const restNotes = booking.rest_notes || booking.restaurant_notes;
                    return restNotes && 
                      typeof restNotes === 'string' && 
                      restNotes.trim().length > 0 ? (
                      <div 
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-500 text-white border border-purple-700 shadow-sm"
                        title={`Restaurant Note: ${restNotes}`}
                      >
                        <StickyNote className="h-3 w-3" strokeWidth={2.5} />
                      </div>
                    ) : null;
                  })()}
                  
                  {/* Occasion Icon */}
                  {booking.occasion && 
                    typeof booking.occasion === 'string' && 
                    booking.occasion.trim().length > 0 && (
                    <div 
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-pink-500 text-white border border-pink-700 shadow-sm"
                      title={`Occasion: ${booking.occasion}`}
                    >
                      <Gift className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                  )}
                  
                  {/* Preferred Section Icon */}
                  {booking.preferred_section &&
                    typeof booking.preferred_section === 'string' &&
                    booking.preferred_section.trim().length > 0 && (
                    <div
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-500 text-white border border-indigo-700 shadow-sm"
                      title={`Preferred Section: ${booking.preferred_section}`}
                    >
                      <MapPin className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                  )}

                  {/* Applied Offer Icon */}
                  {booking.special_offers && (
                    <div
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white border border-emerald-700 shadow-sm"
                      title={`Offer: ${booking.special_offers.title} - ${booking.special_offers.discount_percentage}% OFF`}
                    >
                      <Gift className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                  )}

                  {/* Promo Code Icon */}
                  {booking.promo_codes && (
                    <div
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-violet-500 text-white border border-violet-700 shadow-sm"
                      title={`Promo: ${booking.promo_codes.code} - ${booking.promo_codes.discount_type === 'percentage' ? `${booking.promo_codes.discount_value}% OFF` : `$${booking.promo_codes.discount_value} OFF`}`}
                    >
                      <Tag className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              </div>
              {/* Top row wrapper (keeps status fixed when expanded) */}
              <div className="relative min-h-[72px] flex items-center">
                <div className="w-full grid grid-cols-[minmax(0,1fr)_120px] sm:grid-cols-[minmax(0,1fr)_78px_88px_64px_116px] md:grid-cols-[minmax(0,1fr)_92px_104px_84px_128px] lg:grid-cols-[minmax(280px,420px)_92px_104px_84px_minmax(220px,1fr)_128px] gap-x-3 sm:gap-x-3 md:gap-x-4 lg:gap-x-6 gap-y-2 items-center">
                  {/* Guest Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">
                        {formatGuestName(booking)}
                      </h3>
                      {booking.modifications && booking.modifications.length > 0 && (
                        <BookingModificationIndicator
                          bookingId={booking.id}
                          modifications={booking.modifications}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {formatGuestEmail(booking) && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="font-medium truncate">{formatGuestEmail(booking)}</span>
                        </span>
                      )}
                      {formatGuestPhone(booking) !== "No phone" && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span className="font-medium">{formatGuestPhone(booking)}</span>
                        </span>
                      )}
                    </div>

                    {/* Mobile collapsed row: show date / time / pax */}
                    <div className="sm:hidden mt-1 flex items-center gap-2 text-[11px] text-slate-600 min-w-0 whitespace-nowrap">
                      <span className="tabular-nums">{format(bookingTime, "MMM d")}</span>
                      <span className="text-slate-300">•</span>
                      <span className="tabular-nums">{format(bookingTime, "h:mm a")}</span>
                      <span className="text-slate-300">•</span>
                      <span className="tabular-nums font-semibold">{booking.party_size}p</span>
                    </div>
                  </div>

                {(() => {
                  const modifications = booking.modifications || [];
                  const modifiedFields = (() => {
                    const s = new Set<string>();
                    modifications.forEach((mod: any) => {
                      if (!mod?.old_values || !mod?.new_values) return;
                      const allFields = new Set([
                        ...Object.keys(mod.old_values),
                        ...Object.keys(mod.new_values),
                      ]);
                      const IGNORED_FIELDS = new Set(['id', 'updated_at', 'created_at', 'created_by', 'last_modified_by']);
                      allFields.forEach((field) => {
                        if (IGNORED_FIELDS.has(field)) return;
                        const oldVal = mod.old_values[field];
                        const newVal = mod.new_values[field];
                        if (oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                          s.add(field);
                        }
                      });
                    });
                    return s;
                  })();
                  const isBookingTimeModified = modifiedFields.has('booking_time');
                  const isPartySizeModified = modifiedFields.has('party_size');
                  return (
                    <>
                      {/* Date */}
                      <div className="hidden sm:flex justify-self-start sm:col-start-2 md:col-start-2">
                        <div
                          className={cn(
                            "flex items-center gap-1 text-xs h-7 px-2 rounded-md whitespace-nowrap",
                            "bg-transparent text-slate-700",
                            "w-[78px] md:w-[92px] justify-center",
                            "sm:h-6 sm:px-1.5 sm:text-[11px]",
                            isBookingTimeModified && "bg-orange-50 text-orange-700"
                          )}
                        >
                          <Calendar className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium tabular-nums">{format(bookingTime, "MMM d")}</span>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="hidden sm:flex justify-self-start sm:col-start-3 md:col-start-3">
                        <div
                          className={cn(
                            "flex items-center gap-1 text-xs h-7 px-2 rounded-md whitespace-nowrap",
                            "bg-transparent text-slate-700",
                            "w-[88px] md:w-[104px] justify-center",
                            "sm:h-6 sm:px-1.5 sm:text-[11px]",
                            isBookingTimeModified && "bg-orange-50 text-orange-700"
                          )}
                        >
                          <AlarmClock className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium tabular-nums">{format(bookingTime, "h:mm a")}</span>
                        </div>
                      </div>

                      {/* Guests */}
                      <div className="hidden sm:flex justify-self-start sm:col-start-4 md:col-start-4">
                        <div
                          className={cn(
                            "flex items-center gap-1 text-xs h-7 px-2 rounded-md whitespace-nowrap",
                            "bg-transparent text-slate-700",
                            "w-[64px] md:w-[84px] justify-center",
                            "sm:h-6 sm:px-1.5 sm:text-[11px]",
                            isPartySizeModified && "bg-orange-50 text-orange-700"
                          )}
                        >
                          <Users className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-semibold tabular-nums">{booking.party_size}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Desktop details column (use extra horizontal space) */}
                <div className="hidden lg:block min-w-0 justify-self-stretch lg:col-start-5">
                  <div className="flex items-center justify-between gap-4 min-w-0 w-full">

{hasFloorPlan ? (
  /* Floor Plan addon: visual table selection with modal */
  (() => {
    const assignedTables = getBookingTables(booking)
    const tableLabel = assignedTables.length > 0
      ? assignedTables.map((t: any) => `T${t.table_number}`).join(', ')
      : null
    const totalCapacity = assignedTables.reduce((sum: number, t: any) => sum + (t.capacity || 0), 0)

    return booking.status === 'confirmed' ? (
      <div
        className="flex items-center gap-1.5 cursor-pointer group min-w-0"
        onClick={(e) => {
          e.stopPropagation()
          setTableSelectionBooking(booking)
        }}
      >
        {tableLabel ? (
          <>
            <Badge variant="outline" className="text-xs font-medium bg-blue-50 border-blue-200 text-blue-700 group-hover:bg-blue-100 transition-colors whitespace-nowrap">
              <Table className="h-3 w-3 mr-1" />
              {tableLabel}
            </Badge>
            {totalCapacity > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({totalCapacity} seats)
              </span>
            )}
          </>
        ) : (
          <Badge variant="outline" className="text-xs font-medium border-dashed border-gray-300 text-gray-500 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors whitespace-nowrap">
            <Table className="h-3 w-3 mr-1" />
            Assign table
          </Badge>
        )}
      </div>
    ) : (
      <span className="font-medium text-xs text-muted-foreground whitespace-nowrap">
        {tableLabel ? (
          <Badge variant="outline" className="text-xs font-medium bg-gray-50 border-gray-200 text-gray-600 whitespace-nowrap">
            <Table className="h-3 w-3 mr-1" />
            {tableLabel}
          </Badge>
        ) : "—"}
      </span>
    )
  })()
) : booking.status === 'confirmed' && editingTable[booking.id] ? (
  <div className="relative w-28 md:w-36"> {/* Responsive width */}
    <Input
      placeholder="Table #"
      value={tableInputs[booking.id] || ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleTableChange(booking.id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleApplyTable(booking.id);
        if (e.key === "Escape") handleCancelEdit(booking.id);
      }}
      className="
        h-7 md:h-8 w-full text-xs pr-14 md:pr-16
        rounded-md
        transition-[box-shadow,background-color,border-color]
        border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500
      "
    />

    {/* End adornment inside input */}
    <div className="absolute inset-y-0 right-1 flex items-center">
      <div className="flex items-center -space-x-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isUpdatingTable[booking.id]}
          onClick={() => handleApplyTable(booking.id)}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="
            h-5 w-5 rounded-md
            hover:bg-muted/70
            focus-visible:ring-1 focus-visible:ring-blue-500
            transition
          "
          aria-label="Apply"
          title="Apply"
        >
          {isUpdatingTable[booking.id]
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Check className="h-3.5 w-3.5" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleCancelEdit(booking.id)}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="
            h-5 w-5 rounded-md p-0
            hover:bg-muted/70
            focus-visible:ring-1 focus-visible:ring-blue-500
            transition
          "
          aria-label="Cancel"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
) : booking.status === 'confirmed' ? (
  <div
    className="flex items-center gap-2 cursor-pointer group min-w-0"
    onClick={(e) => {
      e.stopPropagation();
      const currentTable = getAssignedTable(booking);
      if (currentTable) {
        handleTableClick(booking.id, currentTable);
      } else {
        setEditingTable((prev) => ({ ...prev, [booking.id]: true }));
        setTableInputs((prev) => ({ ...prev, [booking.id]: "" }));
      }
    }}
  >
    <span className="font-medium text-xs whitespace-nowrap truncate group-hover:text-blue-600 transition-colors">
      {getAssignedTable(booking) ? `Table ${getAssignedTable(booking)}` : "Assign table"}
    </span>
    <span className="text-[11px] text-muted-foreground group-hover:text-blue-600 transition-colors">✏️</span>
  </div>
) : (
  <span className="font-medium text-xs text-muted-foreground whitespace-nowrap">
    {getAssignedTable(booking) ? `Table ${getAssignedTable(booking)}` : "—"}
  </span>
)}

                    {/* Desktop-only: inline preview uses the remaining horizontal space */}
                    {!editingTable[booking.id] && (
                      <div className="min-w-0 flex-1 text-[11px] text-muted-foreground text-sm">{(() => {
                          const eventTitle =
                            booking?.event_occurrence?.event?.title ||
                            (booking as any)?.event_occurrences?.event?.title ||
                            (booking as any)?.event_title ||
                            (booking as any)?.event_name ||
                            ""
                          const isEvent =
                            Boolean(booking.is_event_booking) ||
                            booking.source === "event_widget" ||
                            booking.source === "event_booking" ||
                            String(eventTitle).trim().length > 0

                          // On big screens, don't show any event label/name in the row.
                          if (isEvent) return null

                          const preview =
                            (booking.special_requests && String(booking.special_requests).trim()) ||
                            (booking.occasion && String(booking.occasion).trim()) ||
                            ""
                          if (!preview) return null

                          return (
                            <div className="flex items-center gap-1 min-w-0">
                              <StickyNote className="h-3 w-3 shrink-0" />
                              <span className="truncate">{preview}</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Status column (far right) */}
                <div className="col-start-2 sm:col-start-5 md:col-start-5 lg:col-start-6 self-center justify-self-end flex items-center justify-end">
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      "rounded-l-xl rounded-r-xl",
                      "px-1.5 py-0.5",
                      "w-[120px] sm:w-[116px] md:w-[128px] justify-center",
                      "overflow-hidden",
                      booking.status === "pending" && "animate-[pulse_0.75s_ease-in-out_infinite] ring-2 ring-yellow-400/70 shadow-sm",
                      (booking.status as string) === "pending_payment" && "animate-[pulse_0.75s_ease-in-out_infinite] ring-2 ring-amber-400/70 shadow-sm",
                      statusConfig.bgColor,
                      statusConfig.color
                    )}
                    title={pendingElapsed ? `${statusConfig.label} · ${pendingElapsed}` : statusConfig.label}
                  >
                    <StatusIcon className={cn("h-3 w-3", statusConfig.color)} />
                    <span className="min-w-0 text-[10px] font-semibold truncate">
                      {pendingElapsed ? `${statusConfig.label} · ${pendingElapsed}` : statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>
              </div>

              {isExpanded && (
                <div
                  className="mt-2 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    {/* Card top: date/time/pax + badges */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium tabular-nums">{format(bookingTime, "MMM d")}</span>
                      </div>
                      <span className="text-slate-300">·</span>
                      <div className="flex items-center gap-1.5">
                        <AlarmClock className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium tabular-nums">{format(bookingTime, "h:mm a")}</span>
                      </div>
                      <span className="text-slate-300">·</span>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold tabular-nums">{booking.party_size}</span>
                      </div>
                      {/* Top badges */}
                      {booking.booking_guarantee?.status === "held" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 bg-green-50 text-green-700 border-green-200 gap-0.5 ml-auto">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          Card Held
                        </Badge>
                      )}
                      {booking.is_event_booking && booking.payment_status === "paid" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 gap-0.5 ml-auto">
                          <PartyPopper className="h-2.5 w-2.5" />
                          Paid: ${booking.payment_amount}
                        </Badge>
                      )}
                    </div>

                    {/* Card body: details */}
                    <div className="space-y-2 mb-2">
                    {(() => {
                      const tablePref = (() => {
                        const v = booking.table_preferences
                        if (!v) return ""
                        if (Array.isArray(v)) return v.join(", ")
                        if (typeof v === "string") return v
                        try { return JSON.stringify(v) } catch { return String(v) }
                      })()

                      const formatOccasion = (raw?: string) => {
                        const v = (raw || "").trim()
                        if (!v) return ""
                        return v.replace(/_/g, " ").split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ")
                      }

                      const dietaryTags = (() => {
                        const raw = booking.dietary_notes
                        if (!raw) return [] as string[]
                        const s = Array.isArray(raw) ? raw.join(",") : String(raw)
                        return s.split(/[,;\n]+/g).map((t) => t.trim()).filter(Boolean)
                      })()

                      const promoDisplay = booking.promo_codes
                        ? `${booking.promo_codes.code} — ${booking.promo_codes.discount_type === 'percentage' ? `${booking.promo_codes.discount_value}% OFF` : `$${booking.promo_codes.discount_value} OFF`}${booking.promo_codes.max_discount_amount ? ` (max $${booking.promo_codes.max_discount_amount})` : ''}${booking.promo_codes.description ? ` · ${booking.promo_codes.description}` : ''}`
                        : ""
                      const offerDisplay = booking.special_offers
                        ? `${booking.special_offers.title}${booking.special_offers.discount_percentage ? ` — ${booking.special_offers.discount_percentage}% OFF` : ''}${booking.special_offers.description ? ` · ${booking.special_offers.description}` : ''}`
                        : ""

                      const email = formatGuestEmail(booking)
                      const rating = typeof customer?.user_rating === "number" ? customer.user_rating.toFixed(1) : ""
                      const section = booking.preferred_section || ""
                      const occasion = formatOccasion(booking.occasion)
                      const specialReq = booking.special_requests || ""
                      const restNote = booking.rest_notes || ""

                      type DetailRow = { icon: any; label: string; value: string; iconClass?: string }
                      const rows: DetailRow[] = [
                        email ? { icon: Mail, label: "Email", value: email } : null,
                        rating ? { icon: Star, label: "Rating", value: rating, iconClass: "text-amber-500" } : null,
                        section ? { icon: MapPin, label: "Section", value: section } : null,
                        tablePref ? { icon: Table, label: "Table pref", value: tablePref } : null,
                        occasion ? { icon: PartyPopper, label: "Occasion", value: occasion } : null,
                        specialReq ? { icon: MessageSquare, label: "Request", value: specialReq } : null,
                        restNote ? { icon: StickyNote, label: "Note", value: restNote } : null,
                        promoDisplay ? { icon: Tag, label: "Promo", value: promoDisplay } : null,
                        offerDisplay ? { icon: Gift, label: "Offer", value: offerDisplay } : null,
                      ].filter(Boolean) as DetailRow[]

                      if (rows.length === 0 && dietaryTags.length === 0) return null

                      return (
                        <div className="space-y-1">
                          {rows.map((row) => (
                            <div key={row.label} className="flex items-start gap-2 text-[11px] leading-tight">
                              <row.icon className={cn("h-3 w-3 mt-0.5 shrink-0 text-muted-foreground", row.iconClass)} />
                              <span className="text-muted-foreground shrink-0 w-14">{row.label}</span>
                              <span className="text-foreground font-medium truncate min-w-0">{row.value}</span>
                            </div>
                          ))}
                          {dietaryTags.length > 0 && (
                            <div className="flex items-start gap-2 text-[11px] leading-tight">
                              <UtensilsCrossed className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground shrink-0 w-14">Dietary</span>
                              <div className="flex flex-wrap gap-1">
                                {dietaryTags.map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Floor Plan: Table info */}
                    {hasFloorPlan && (() => {
                      const tables = getBookingTables(booking)
                      const tableLabel = tables.length > 0
                        ? tables.map((t: any) => `T${t.table_number}`).join(', ')
                        : null
                      const totalCap = tables.reduce((s: number, t: any) => s + (t.capacity || 0), 0)

                      return (
                        <div className="flex items-center gap-2 lg:hidden">
                          {booking.status === 'confirmed' ? (
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-xs"
                              onClick={() => setTableSelectionBooking(booking)}
                            >
                              {tableLabel ? (
                                <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-[10px] h-5 gap-1">
                                  <Table className="h-3 w-3" />
                                  {tableLabel}
                                  <span className="text-[10px] opacity-70">({totalCap} seats)</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-dashed border-gray-300 text-gray-500 text-[10px] h-5 gap-1">
                                  <Table className="h-3 w-3" />
                                  Assign table
                                </Badge>
                              )}
                            </button>
                          ) : tableLabel ? (
                            <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600 text-[10px] h-5 gap-1">
                              <Table className="h-3 w-3" />
                              {tableLabel}
                            </Badge>
                          ) : null}
                        </div>
                      )
                    })()}
                    </div>

                    {/* Card footer: action buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
                      {booking.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[11px] px-3"
                            disabled={disableActions}
                            onClick={(e) => {
                              e.stopPropagation()
                              withActionLock(booking.id, () => {
                                if (onRequestDecline) {
                                  onRequestDecline(booking)
                                } else {
                                  onUpdateStatus(booking.id, "declined_by_restaurant")
                                }
                              })
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-[11px] px-3 bg-green-600 text-white hover:bg-green-700"
                            disabled={disableActions}
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                const warnings = await getAcceptanceWarnings(booking, booking.restaurant_id)
                                if (warnings.length > 0) {
                                  setAcceptWarnings({ isOpen: true, bookingId: booking.id, warnings: sortWarnings(warnings), isLoading: false })
                                  return
                                }
                              } catch { /* proceed */ }
                              withActionLock(booking.id, () => onUpdateStatus(booking.id, "confirmed"))
                            }}
                          >
                            Confirm
                          </Button>
                          <div className="w-px h-4 bg-slate-200/80 mx-0.5" />
                          {onOpenRestaurantNote && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onOpenRestaurantNote(booking) }}>
                              <StickyNote className="h-3.5 w-3.5 mr-1" />Note
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onSelectBooking(booking) }}>
                            Guest details
                          </Button>
                          {(() => {
                            const phoneNumber = booking.guest_phone || customer?.phone_number
                            if (!phoneNumber) return null
                            const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '')
                            const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone
                            return (
                              <div className="flex gap-1 ml-auto">
                                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-green-500 hover:bg-green-600 border-green-600 text-white hover:text-white" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${whatsappPhone}`, '_blank') }} title="WhatsApp">
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </Button>
                                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 border-blue-600 text-white hover:text-white" onClick={(e) => { e.stopPropagation(); window.open(`tel:${cleanPhone}`, '_self') }} title="Call">
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )
                          })()}
                        </>
                      ) : (booking.status as string) === "pending_payment" ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[11px] px-3"
                            disabled={disableActions}
                            onClick={(e) => {
                              e.stopPropagation()
                              withActionLock(booking.id, () => {
                                if (onRequestDecline) { onRequestDecline(booking) } else { onUpdateStatus(booking.id, "declined_by_restaurant") }
                              })
                            }}
                          >
                            Decline
                          </Button>
                          <div className="w-px h-4 bg-slate-200/80 mx-0.5" />
                          {onOpenRestaurantNote && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onOpenRestaurantNote(booking) }}>
                              <StickyNote className="h-3.5 w-3.5 mr-1" />Note
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onSelectBooking(booking) }}>
                            Guest details
                          </Button>
                          {(() => {
                            const phoneNumber = booking.guest_phone || customer?.phone_number
                            if (!phoneNumber) return null
                            const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '')
                            const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone
                            return (
                              <div className="flex gap-1 ml-auto">
                                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-green-500 hover:bg-green-600 border-green-600 text-white hover:text-white" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${whatsappPhone}`, '_blank') }} title="WhatsApp">
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </Button>
                                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 border-blue-600 text-white hover:text-white" onClick={(e) => { e.stopPropagation(); window.open(`tel:${cleanPhone}`, '_self') }} title="Call">
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )
                          })()}
                          <p className="w-full text-[10px] text-amber-600 mt-0.5">Awaiting guest payment</p>
                        </>
                      ) : (
                        <>
                          {booking.status === "confirmed" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" disabled={disableActions} onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="h-3.5 w-3.5 mr-1" />Manage
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {onModifyBooking && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setBookingToModify(booking); setShowModifyConfirmDialog(true) }} disabled={disableActions}>
                                    <Edit className="h-4 w-4 mr-2" />Modify Booking
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); withActionLock(booking.id, () => onUpdateStatus(booking.id, "no_show")) }} className="text-red-600" disabled={disableActions}>
                                  <XCircle className="h-4 w-4 mr-2" />Mark no show
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); if (!onCancelBooking) return; withActionLock(booking.id, () => onCancelBooking(booking)) }} className="text-red-600" disabled={disableActions || !onCancelBooking}>
                                  <XCircle className="h-4 w-4 mr-2" />Cancel booking
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); const ok = confirm("Only mark 'Cancelled by Customer' if the customer called the restaurant and cancelled."); if (!ok) return; withActionLock(booking.id, () => onUpdateStatus(booking.id, "cancelled_by_user")) }} className="text-red-600" disabled={disableActions}>
                                  <XCircle className="h-4 w-4 mr-2" />Cancelled by customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {onOpenRestaurantNote && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onOpenRestaurantNote(booking) }}>
                              <StickyNote className="h-3.5 w-3.5 mr-1" />Note
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onSelectBooking(booking) }}>
                            Guest details
                          </Button>
                          {/* WhatsApp & Call */}
                          {(() => {
                            const phoneNumber = booking.guest_phone || customer?.phone_number
                            if (!phoneNumber) return null
                            const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '')
                            const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone
                            return (
                              <div className="flex gap-1 ml-auto">
                                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-green-500 hover:bg-green-600 border-green-600 text-white hover:text-white" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${whatsappPhone}`, '_blank') }} title="WhatsApp">
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </Button>
                                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 border-blue-600 text-white hover:text-white" onClick={(e) => { e.stopPropagation(); window.open(`tel:${cleanPhone}`, '_self') }} title="Call">
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Modify Booking Confirmation Dialog */}
      <Dialog open={showModifyConfirmDialog} onOpenChange={setShowModifyConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Modify Confirmed Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                This booking has been confirmed. Please make sure the client approves of any modifications before saving changes.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              You are about to modify a booking that has already been confirmed with the guest. It's important to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Contact the guest to inform them of the changes</li>
              <li>Get their approval before saving</li>
              <li>Update any confirmation emails or messages</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowModifyConfirmDialog(false)
                  setBookingToModify(null)
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowModifyConfirmDialog(false)
                  if (bookingToModify && onModifyBooking) {
                    onModifyBooking(bookingToModify)
                  }
                  setBookingToModify(null)
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Proceed to Modify
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Selection Modal for Floor Plan addon */}
      {hasFloorPlan && tableSelectionBooking && (
        <TableSelectionModal
          isOpen={!!tableSelectionBooking}
          onClose={() => setTableSelectionBooking(null)}
          booking={tableSelectionBooking}
          allTables={allTables}
          allBookings={allBookingsForConflicts || bookings}
          onConfirmSelection={(tableIds) => {
            if (onAssignTables && tableSelectionBooking) {
              onAssignTables(tableSelectionBooking.id, tableIds)
            }
            setTableSelectionBooking(null)
          }}
          isProcessing={isAssigningTables}
        />
      )}

      {/* Acceptance Warnings Dialog */}
      <BookingWarningsDialog
        open={acceptWarnings.isOpen}
        onOpenChange={(open) => {
          if (!open) setAcceptWarnings(prev => ({ ...prev, isOpen: false }))
        }}
        warnings={acceptWarnings.warnings}
        actionLabel="Accept Booking"
        description="The following issues were detected for this booking. You can still proceed."
        isLoading={acceptWarnings.isLoading}
        onConfirm={() => {
          if (acceptWarnings.bookingId) {
            onUpdateStatus(acceptWarnings.bookingId, 'confirmed')
          }
          setAcceptWarnings({ isOpen: false, bookingId: null, warnings: [], isLoading: false })
        }}
        onCancel={() => {
          setAcceptWarnings({ isOpen: false, bookingId: null, warnings: [], isLoading: false })
        }}
      />
    </div>
  )
}
