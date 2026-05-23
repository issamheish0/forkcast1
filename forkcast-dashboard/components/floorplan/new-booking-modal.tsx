// components/floorplan/new-booking-modal.tsx
"use client"

import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useMutation } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar as CalendarIcon, Clock, Users, Loader2, Table2, Check, Search, UserCheck, X, Star } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { RestaurantTable, Booking } from '@/types'
import { isTerminalStatus } from '@/lib/constants/floorplan'

interface NewBookingModalProps {
  isOpen: boolean
  onClose: () => void
  restaurantId: string
  availableTables: RestaurantTable[]
  allBookings?: Booking[]
  onSuccess: () => void
  isWalkIn?: boolean
  preselectedTableId?: string | null
  hasGuestCRM?: boolean
}

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function NewBookingModal({
  isOpen,
  onClose,
  restaurantId,
  availableTables,
  allBookings = [],
  onSuccess,
  isWalkIn = false,
  preselectedTableId = null,
  hasGuestCRM = false,
}: NewBookingModalProps) {
  const supabase = createClient()

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [partySize, setPartySize] = useState<number | ''>('')
  const [bookingDate, setBookingDate] = useState<Date | null>(null)
  const [bookingTime, setBookingTime] = useState('')

  // Customer search state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [specialRequests, setSpecialRequests] = useState('')
  const [turnTime, setTurnTime] = useState(90)

  // Pre-fill date, time, and table for walk-ins — use exact current time, not rounded
  useEffect(() => {
    if (isOpen && isWalkIn) {
      const now = new Date()
      setBookingDate(now)
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setBookingTime(timeStr)
      if (preselectedTableId) {
        setSelectedTableIds([preselectedTableId])
      }
    }
  }, [isOpen, isWalkIn, preselectedTableId])

  // Compute which tables are occupied during the selected booking window
  // Uses !isTerminalStatus to match floorplan logic (includes pending bookings as conflicts)
  const occupiedTableIds = useMemo(() => {
    if (!bookingDate || !bookingTime) return new Set<string>()
    const [h, m] = bookingTime.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + turnTime
    const dateStr = format(bookingDate, 'yyyy-MM-dd')
    const occupied = new Set<string>()
    for (const b of allBookings) {
      if (isTerminalStatus(b.status)) continue
      if (format(new Date(b.booking_time), 'yyyy-MM-dd') !== dateStr) continue
      const bt = new Date(b.booking_time)
      const bStartMin = bt.getHours() * 60 + bt.getMinutes()
      const bEndMin = bStartMin + (b.turn_time_minutes || 90)
      if (startMin < bEndMin && endMin > bStartMin) {
        const tableIds = b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []
        tableIds.forEach((id: string) => occupied.add(id))
      }
    }
    return occupied
  }, [bookingDate, bookingTime, turnTime, allBookings])

  // Search restaurant_customers from the dedicated search input
  const handleCustomerSearch = (value: string) => {
    setCustomerSearchQuery(value)

    if (searchTimeout) clearTimeout(searchTimeout)

    if (value.trim().length < 2) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      return
    }

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('restaurant_customers')
        .select(`
          id, guest_name, guest_email, guest_phone, user_id, vip_status, total_bookings,
          profile:profiles!restaurant_customers_user_id_fkey(
            full_name, email, phone_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .or(`guest_name.ilike.%${value}%,guest_email.ilike.%${value}%,guest_phone.ilike.%${value}%`)
        .limit(5)

      if (data && data.length > 0) {
        setCustomerResults(data)
        setShowCustomerDropdown(true)
      } else {
        setCustomerResults([])
        setShowCustomerDropdown(false)
      }
    }, 300)
    setSearchTimeout(timeout)
  }

  const handleCustomerSelect = (customer: any) => {
    const name = customer.guest_name || customer.profile?.full_name || ''
    const email = customer.guest_email || customer.profile?.email || ''
    const phone = customer.guest_phone || customer.profile?.phone_number || ''
    setGuestName(name)
    setGuestEmail(email)
    setGuestPhone(phone)
    setSelectedCustomerId(customer.id)
    setSelectedCustomer(customer)
    setShowCustomerDropdown(false)
    setCustomerResults([])
    setCustomerSearchQuery('')
  }

  const handleClearCustomer = () => {
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    setCustomerSearchQuery('')
  }

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      // For walk-ins, fall back to a default guest name when none was entered.
      const effectiveGuestName = guestName.trim() || (isWalkIn ? 'Walk-in guest' : guestName)

      // Walk-ins use exact current time; regular bookings use the selected date/time
      const nowIso = new Date().toISOString()
      let bookingTimeIso: string
      if (isWalkIn) {
        bookingTimeIso = nowIso
      } else {
        const [hours, minutes] = bookingTime.split(':').map(Number)
        const bookingDateTime = new Date(bookingDate!)
        bookingDateTime.setHours(hours, minutes, 0, 0)
        bookingTimeIso = bookingDateTime.toISOString()
      }

      // Resolve guest_id: use selected customer, or find/create one (only when CRM is active)
      let guestId: string | null = selectedCustomerId
      if (!guestId && hasGuestCRM) {
        // Try to find existing customer by email or phone
        const conditions: string[] = []
        if (guestEmail) conditions.push(`guest_email.eq.${guestEmail}`)
        if (guestPhone) conditions.push(`guest_phone.eq.${guestPhone}`)

        if (conditions.length > 0) {
          const { data: existing } = await supabase
            .from('restaurant_customers')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .or(conditions.join(','))
            .limit(1)
          if (existing && existing.length > 0) {
            guestId = existing[0].id
          }
        }

        // Still no match — create a new customer record
        if (!guestId) {
          const { data: newCustomer } = await supabase
            .from('restaurant_customers')
            .insert({
              restaurant_id: restaurantId,
              guest_name: effectiveGuestName,
              guest_email: guestEmail || null,
              guest_phone: guestPhone || null,
              source: isWalkIn ? 'walk_in' : 'manual',
              total_bookings: 0,
            })
            .select('id')
            .single()
          if (newCustomer) guestId = newCustomer.id
        }
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          restaurant_id: restaurantId,
          guest_name: effectiveGuestName,
          guest_phone: guestPhone || null,
          guest_email: guestEmail || null,
          guest_id: guestId || null,
          party_size: partySize as number,
          booking_time: bookingTimeIso,
          status: isWalkIn ? 'seated' : 'confirmed',
          special_requests: specialRequests || null,
          confirmation_code: generateConfirmationCode(),
          turn_time_minutes: turnTime,
          source: isWalkIn ? 'walk_in' : 'manual',
          ...(isWalkIn && { checked_in_at: nowIso, seated_at: nowIso }),
        })
        .select()
        .single()

      if (bookingError) throw bookingError

      // Assign tables if selected
      if (selectedTableIds.length > 0 && booking) {
        const rows = selectedTableIds.map(tableId => ({
          booking_id: booking.id,
          table_id: tableId,
        }))
        const { error: tableError } = await supabase
          .from('booking_tables')
          .insert(rows)

        if (tableError) {
          console.error('Failed to assign tables:', tableError)
          toast.error('Booking created but table assignment failed. Please assign tables manually.')
        }
      }

      return booking
    },
    onSuccess: () => {
      toast.success(`Booking created for ${guestName.trim() || (isWalkIn ? 'Walk-in guest' : 'guest')}`)
      resetForm()
      onSuccess()
    },
    onError: (error) => {
      toast.error('Failed to create booking')
      console.error(error)
    }
  })

  const resetForm = () => {
    setGuestName('')
    setGuestPhone('')
    setGuestEmail('')
    setPartySize('')
    setBookingDate(null)
    setBookingTime('')
    setSelectedTableIds([])
    setSpecialRequests('')
    setTurnTime(90)
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
    setCustomerResults([])
    setShowCustomerDropdown(false)
    setCustomerSearchQuery('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Walk-ins: guest name is optional. For regular bookings it's still required.
    if (!isWalkIn && !guestName.trim()) {
      toast.error('Please enter guest name')
      return
    }
    if (!partySize) {
      toast.error('Please enter number of guests')
      return
    }
    if (!bookingDate) {
      toast.error('Please select a date')
      return
    }
    if (!bookingTime) {
      toast.error('Please select a time')
      return
    }
    // Walk-ins always use current time, so skip past-time validation
    if (!isWalkIn) {
      const [h, m] = bookingTime.split(':').map(Number)
      const selectedDateTime = new Date(bookingDate)
      selectedDateTime.setHours(h, m, 0, 0)
      const now = new Date()
      const minutesFromNow = (selectedDateTime.getTime() - now.getTime()) / 60000
      if (minutesFromNow < -5) {
        toast.error('Cannot create a booking more than 5 minutes in the past')
        return
      }
    }
    // Block if any selected table has a turnover conflict
    if (selectedTableIds.length > 0) {
      const conflictingTable = selectedTableIds.find(id => occupiedTableIds.has(id))
      if (conflictingTable) {
        const table = availableTables.find(t => t.id === conflictingTable)
        toast.error(`Table ${table?.table_number || '?'} has a booking conflict — please deselect it`)
        return
      }
    }
    createBookingMutation.mutate()
  }

  // Generate time slots
  const timeSlots = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isWalkIn ? 'Walk-in Booking' : 'New Booking'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest CRM Search Section - Only shown when addon is enabled */}
          {hasGuestCRM && (
            <div className="space-y-2 rounded-lg border border-amber-200 p-3 bg-amber-50/50">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-600" />
                Search Existing Guest
                <Badge variant="outline" className="ml-1 text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                  Guest CRM
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Search your customer database to auto-fill guest details
              </p>

              {selectedCustomer ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-white border border-amber-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">
                          {selectedCustomer.guest_name || selectedCustomer.profile?.full_name}
                        </span>
                        {selectedCustomer.vip_status && (
                          <Badge className="text-[10px] bg-amber-500 text-white px-1 py-0">VIP</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedCustomer.total_bookings || 0} visits
                        {(selectedCustomer.guest_phone || selectedCustomer.profile?.phone_number) &&
                          ` • ${selectedCustomer.guest_phone || selectedCustomer.profile?.phone_number}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={handleClearCustomer}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true) }}
                    onBlur={() => { setTimeout(() => setShowCustomerDropdown(false), 200) }}
                    className="pl-8 text-sm"
                    autoComplete="off"
                  />
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {customerResults.map((c) => {
                        const name = c.guest_name || c.profile?.full_name || 'Unknown'
                        const email = c.guest_email || c.profile?.email || ''
                        const phone = c.guest_phone || c.profile?.phone_number || ''
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-3 hover:bg-accent text-sm transition-colors text-left"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleCustomerSelect(c)}
                          >
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <UserCheck className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.total_bookings || 0} visits
                                {(email || phone) && ` • ${[email, phone].filter(Boolean).join(' • ')}`}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Guest Name */}
          <div className="space-y-2">
            <Label htmlFor="guestName">
              Guest Name {isWalkIn ? <span className="text-muted-foreground font-normal">(optional)</span> : '*'}
            </Label>
            <Input
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={isWalkIn ? 'Leave blank for "Walk-in guest"' : 'Enter guest name'}
              required={!isWalkIn}
              aria-required={!isWalkIn}
              autoFocus={!hasGuestCRM}
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="guestPhone">Phone</Label>
              <Input
                id="guestPhone"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestEmail">Email</Label>
              <Input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="guest@email.com"
              />
            </div>
          </div>

          {/* Party Size */}
          <div className="space-y-2">
            <Label>Party Size</Label>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={50}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                placeholder="e.g. 4"
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">guests</span>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingDate ? format(bookingDate, 'MMM d, yyyy') : <span className="text-muted-foreground">Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={bookingDate}
                    onSelect={(date) => date && setBookingDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              {isWalkIn ? (
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>
                    {(() => {
                      const [h, m] = bookingTime.split(':').map(Number)
                      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                      const ampm = h < 12 ? 'AM' : 'PM'
                      return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
                    })()} (now)
                  </span>
                </div>
              ) : (
                <Select value={bookingTime} onValueChange={setBookingTime}>
                  <SelectTrigger>
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Pick a time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {timeSlots.map((time) => {
                      const [h, m] = time.split(':').map(Number)
                      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                      const ampm = h < 12 ? 'AM' : 'PM'
                      const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
                      return (
                        <SelectItem key={time} value={time}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Turn Time */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={turnTime.toString()} onValueChange={(v) => setTurnTime(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="150">2.5 hours</SelectItem>
                <SelectItem value="180">3 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table Selection - EatApp style visual grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Assign Table</Label>
              {selectedTableIds.length > 0 && (
                <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setSelectedTableIds([])}>
                  Clear all
                </button>
              )}
            </div>

            {/* Selected summary */}
            {selectedTableIds.length > 0 && (() => {
              const selected = selectedTableIds.map(id => availableTables.find(t => t.id === id)).filter(Boolean)
              const totalCapacity = selected.reduce((sum, t) => sum + (t?.max_capacity || 0), 0)
              return (
                <div className="flex items-center gap-2 p-2.5 bg-primary/10 border border-primary/30 rounded-lg">
                  <Table2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium flex-1">
                    {selected.map(t => `T${t?.table_number}`).join(' + ')}
                    <span className="text-muted-foreground ml-1">({totalCapacity} seats)</span>
                  </span>
                  {totalCapacity < (partySize || 0) && (
                    <Badge variant="destructive" className="text-[10px] ml-auto">Need more seats</Badge>
                  )}
                  {totalCapacity >= (partySize || 0) && (
                    <Badge className="bg-[hsl(var(--booking-confirmed))] text-white text-[10px] ml-auto">Fits {partySize}</Badge>
                  )}
                </div>
              )
            })()}

            {/* Table grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[180px] overflow-y-auto py-1">
              {availableTables.filter(t => t.is_active !== false).map(table => {
                const isSelected = selectedTableIds.includes(table.id)
                const isOccupied = occupiedTableIds.has(table.id)
                const minCap = table.min_capacity || 1
                const ps = partySize || 0
                const isExactFit = table.max_capacity >= ps && minCap <= ps
                const canAccommodate = table.max_capacity >= ps && minCap > ps
                const isSuitable = isExactFit || canAccommodate
                const isBestFit = isExactFit && table.max_capacity <= ps + 2
                const section = (table as any).section as { name?: string } | undefined
                return (
                  <button
                    key={table.id}
                    type="button"
                    disabled={isOccupied}
                    aria-label={`Table ${table.table_number}, ${table.min_capacity}-${table.max_capacity} seats${isOccupied ? ', occupied' : ''}${isBestFit ? ', best fit' : ''}${isSelected ? ', selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (isOccupied) return
                      setSelectedTableIds(prev =>
                        prev.includes(table.id) ? prev.filter(id => id !== table.id) : [...prev, table.id]
                      )
                    }}
                    className={cn(
                      "relative flex flex-col items-center p-2.5 rounded-xl border-2 transition-all text-center",
                      isOccupied
                        ? "border-[hsl(var(--status-taken)/.4)] bg-[hsl(var(--status-taken)/.06)] opacity-60 cursor-not-allowed"
                        : isSelected
                          ? "border-primary bg-primary/10 shadow-md scale-[1.03]"
                          : isBestFit
                            ? "border-[hsl(var(--status-available)/.5)] bg-[hsl(var(--status-available)/.06)] hover:border-[hsl(var(--status-available)/.7)]"
                            : isSuitable
                              ? "border-border hover:border-primary/40"
                              : "border-border/40 opacity-45 hover:opacity-60"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {isOccupied && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">✕</span>
                      </div>
                    )}
                    <span className={cn("font-bold text-base", isSelected && "text-primary", isOccupied && "text-[hsl(var(--status-taken)/.7)]")}>
                      {table.table_number}
                    </span>
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Users className="w-2.5 h-2.5" />
                      <span>{table.min_capacity}-{table.max_capacity}</span>
                    </div>
                    {section?.name && (
                      <span className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-full">{section.name}</span>
                    )}
                    {isOccupied && (
                      <span className="text-[8px] text-[hsl(var(--status-taken))] font-semibold mt-0.5">TAKEN</span>
                    )}
                    {!isOccupied && isBestFit && !isSelected && (
                      <span className="text-[8px] text-[hsl(var(--status-available))] font-semibold mt-0.5">BEST FIT</span>
                    )}
                  </button>
                )
              })}
            </div>

            {availableTables.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No tables configured</p>
            )}
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="specialRequests">Special Requests</Label>
            <Textarea
              id="specialRequests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Any special requests or notes..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={createBookingMutation.isPending}
            >
              {createBookingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 motion-safe:animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Booking'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
