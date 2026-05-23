// components/dashboard/unified-floor-plan.tsx
"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, titleCase } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table2,
  ChefHat,
  AlertCircle,
  CheckCircle,
  Timer,
  CreditCard,
  Coffee,
  UserCheck,
  Hand,
  Eye,
  Layers,
  Grid3X3,
  Home,
  Trees,
  Wine,
  Lock,
  Sparkles,
  MapPin,
  Building,
  Maximize2,
  Pencil,
  X,
  Users,
  Utensils,
  Gift
} from "lucide-react"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { useSharedTablesSummary } from "@/hooks/use-shared-tables"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RestaurantSection } from "@/types"

const SECTION_ICONS = {
  grid: Grid3X3,
  home: Home,
  trees: Trees,
  wine: Wine,
  lock: Lock,
  sparkles: Sparkles,
  mappin: MapPin,
  building: Building,
  layers: Layers,
}

// Drag state interface for better performance
interface DragState {
  tableId: string | null
  element: HTMLElement | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  initialLeft: number
  initialTop: number
  animationId: number | null
  touchId: number | null
  isDragConfirmed: boolean
  startTime: number
}

interface UnifiedFloorPlanProps {
  tables: any[]
  bookings: any[]
  currentTime: Date
  restaurantId: string
  userId: string
  onTableClick?: (table: any, status: any) => void
  onStatusUpdate?: (bookingId: string, newStatus: DiningStatus) => void
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void
  onCheckIn?: (bookingId: string, tableIds: string[]) => void
  onTableUpdate?: (tableId: string, position: { x: number; y: number }) => void
  searchQuery?: string
  defaultSectionId?: string
}

const STATUS_ICONS: any = {
  'pending': Timer,
  'confirmed': CheckCircle,
  'arrived': UserCheck,
  'seated': ChefHat,
  'ordered': Coffee,
  'appetizers': Coffee,
  'main_course': Utensils,
  'dessert': Coffee,
  'payment': CreditCard,
  'completed': CheckCircle,
  'no_show': AlertCircle,
  'cancelled': AlertCircle
}

const STATUS_COLORS: any = {
  'pending': 'bg-secondary/50 border-secondary text-secondary-foreground',
  'confirmed': 'bg-primary/20 border-primary/40 text-primary',
  'arrived': 'bg-accent/30 border-accent text-accent-foreground',
  'seated': 'bg-primary/30 border-primary text-primary',
  'ordered': 'bg-secondary/70 border-secondary text-secondary-foreground',
  'appetizers': 'bg-secondary/60 border-secondary text-secondary-foreground',
  'main_course': 'bg-primary/35 border-primary text-primary',
  'dessert': 'bg-accent/40 border-accent text-accent-foreground',
  'payment': 'bg-primary/40 border-primary text-primary',
  'completed': 'bg-muted border-border text-muted-foreground',
  'no_show': 'bg-destructive/20 border-destructive text-destructive',
  'cancelled': 'bg-destructive/20 border-destructive text-destructive'
}

const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30 shadow-primary/10",
  window: "bg-gradient-to-br from-accent/10 to-accent/20 border-accent/30 shadow-accent/10",
  patio: "bg-gradient-to-br from-secondary/20 to-secondary/30 border-secondary/40 shadow-secondary/10",
  standard: "bg-gradient-to-br from-card to-muted border-border shadow-sm",
  bar: "bg-gradient-to-br from-accent/20 to-accent/30 border-accent/40 shadow-accent/10",
  private: "bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30 shadow-primary/10",
}

export const UnifiedFloorPlan = React.memo(function UnifiedFloorPlan({ 
  tables, 
  bookings, 
  currentTime,
  restaurantId,
  userId,
  onTableClick,
  onStatusUpdate,
  onTableSwitch,
  onCheckIn,
  onTableUpdate,
  searchQuery,
  defaultSectionId
}: UnifiedFloorPlanProps) {
  const [tableStatuses, setTableStatuses] = useState<Map<string, any>>(new Map())
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null)
  const [activeMenuTable, setActiveMenuTable] = useState<string | null>(null)
  const [hoveredTable, setHoveredTable] = useState<string | null>(null)
  const [loadingTransition, setLoadingTransition] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string>(defaultSectionId || "")
  const [sectionViewMode, setSectionViewMode] = useState<"tabs" | "dropdown">("tabs")
  const [showSectionOverview, setShowSectionOverview] = useState(false)
  const floorPlanRef = useRef<HTMLDivElement>(null)
  
  const supabase = createClient()

  // Use refs for drag state to avoid re-renders and improve performance
  const dragStateRef = useRef<DragState>({
    tableId: null,
    element: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    initialLeft: 0,
    initialTop: 0,
    animationId: null,
    touchId: null,
    isDragConfirmed: false,
    startTime: 0
  })

  // Track final positions for smooth updates
  const finalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  
  const tableStatusService = useMemo(() => new TableStatusService(), [])

  // Fetch sections
  const { data: sections } = useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId,
  })

  // Fetch shared tables data
  const { data: sharedTablesSummary = [] } = useSharedTablesSummary(restaurantId, currentTime)

  // Set first section as default when sections are loaded
  useEffect(() => {
    if (sections && sections.length > 0) {
      if (defaultSectionId && sections.find(s => s.id === defaultSectionId)) {
        // Use provided default section if it exists
        setSelectedSection(defaultSectionId)
      } else if (!selectedSection || selectedSection === "" || selectedSection === "all") {
        // Set first section as default if no valid section is selected
        setSelectedSection(sections[0].id)
      }
    }
  }, [sections, defaultSectionId, selectedSection])

  // Filter tables by selected section
  const filteredTables = useMemo(() => {
    if (!selectedSection || selectedSection === "" || selectedSection === "all") {
      return tables
    }
    return tables.filter(table => table.section_id === selectedSection)
  }, [tables, selectedSection])

  // Calculate section statistics
  const sectionStats = useMemo(() => {
    if (!sections) return []
    
    return sections.map(section => {
      const sectionTables = tables.filter(t => t.section_id === section.id)
      const occupiedTables = sectionTables.filter(table => {
        const hasActiveBooking = bookings.some(booking => 
          booking.tables?.some((t: any) => t.id === table.id) &&
          ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
        )
        return hasActiveBooking
      })
      
      return {
        ...section,
        tableCount: sectionTables.length,
        occupiedCount: occupiedTables.length,
        availableCount: sectionTables.length - occupiedTables.length,
        occupancyRate: sectionTables.length > 0 
          ? Math.round((occupiedTables.length / sectionTables.length) * 100)
          : 0
      }
    })
  }, [sections, tables, bookings])


  // Initialize positions
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    tables.forEach(table => {
      positions[table.id] = { x: table.x_position, y: table.y_position }
    })
    finalPositionsRef.current = { ...positions }
  }, [tables])

  // Section overview component - responsive
  const SectionOverview = () => {
    if (!showSectionOverview || !sections) return null

    return (
      <Card className="fixed top-4 right-4 w-64 max-w-[calc(100vw-2rem)] z-50 shadow-xl max-h-[calc(100vh-6rem)] overflow-auto">
        <div className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Section Overview
          </h3>
          <div className="space-y-2">
            {sectionStats.map(stat => {
              const Icon = SECTION_ICONS[stat.icon as keyof typeof SECTION_ICONS] || Grid3X3
              const isActive = stat.id === selectedSection
              
              return (
                <button
                  key={stat.id}
                  className={cn(
                    "w-full p-2 rounded-lg border text-left transition-all touch-action-manipulation",
                    isActive 
                      ? "bg-primary/10 border-primary shadow-sm" 
                      : "hover:bg-muted border-border"
                  )}
                  onClick={() => {
                    setSelectedSection(stat.id)
                    setShowSectionOverview(false) // Auto-hide on mobile after selection
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon 
                        className="h-4 w-4 flex-shrink-0" 
                        style={{ color: stat.color }}
                      />
                      <span className="font-medium text-sm truncate">{stat.name}</span>
                    </div>
                    <Badge 
                      variant={stat.occupancyRate > 80 ? "destructive" : 
                               stat.occupancyRate > 50 ? "secondary" : "outline"}
                      className="text-xs flex-shrink-0"
                    >
                      {stat.occupancyRate}%
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{stat.occupiedCount}/{stat.tableCount} occupied
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </Card>
    )
  }

  // Load table statuses
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses = await tableStatusService.getTableStatuses(restaurantId, currentTime)
      setTableStatuses(statuses)
    }
    loadStatuses()

    const interval = setInterval(loadStatuses, 30000)
    return () => clearInterval(interval)
  }, [restaurantId, currentTime, tableStatusService])

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (floorPlanRef.current && !floorPlanRef.current.contains(event.target as Node)) {
        setSelectedTable(null)
        setActiveMenuTable(null)
      }
    }

    if (selectedTable) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedTable])

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTable(null)
        setActiveMenuTable(null)
        setEditMode(false)
        // Reset drag state
        dragStateRef.current = {
          tableId: null,
          element: null,
          startX: 0,
          startY: 0,
          offsetX: 0,
          offsetY: 0,
          initialLeft: 0,
          initialTop: 0,
          animationId: null,
          touchId: null,
          isDragConfirmed: false,
          startTime: 0
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Helper functions for event handling
  const getEventCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
    } else if ('clientX' in e) {
      return { clientX: e.clientX, clientY: e.clientY }
    }
    return { clientX: 0, clientY: 0 }
  }

  const getTouchById = (touches: TouchList, touchId: number) => {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === touchId) {
        return touches[i]
      }
    }
    return null
  }

  // Enhanced table drag handlers with proper touch support and performance optimization
  const handleTableDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    if (!editMode) return

    e.preventDefault()
    e.stopPropagation()

    const table = tables.find(t => t.id === tableId)
    if (!table) return

    const element = document.querySelector(`[data-table-id="${tableId}"]`) as HTMLElement
    const container = floorPlanRef.current
    if (!element || !container) return

    setSelectedTable(tableId)

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const coords = getEventCoordinates(e)

    // Get touch ID for touch events
    const touchId = 'touches' in e && e.touches.length > 0 ? e.touches[0].identifier : null
    const isTouch = 'touches' in e

    // Calculate precise offset from touch/mouse to element's top-left
    const offsetX = coords.clientX - elementRect.left
    const offsetY = coords.clientY - elementRect.top

    // Get current position
    const currentLeft = elementRect.left - containerRect.left
    const currentTop = elementRect.top - containerRect.top

    dragStateRef.current = {
      tableId,
      element,
      startX: coords.clientX,
      startY: coords.clientY,
      offsetX,
      offsetY,
      initialLeft: currentLeft,
      initialTop: currentTop,
      animationId: null,
      touchId,
      isDragConfirmed: !isTouch, // For mouse, immediately confirm. For touch, wait for movement.
      startTime: Date.now()
    }

    // Visual feedback
    element.style.zIndex = '1000'
    element.style.touchAction = 'none'
  }, [editMode, tables])

  const handleTableDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    const dragState = dragStateRef.current

    // Handle dragging
    if (dragState.tableId && dragState.element && floorPlanRef.current && editMode) {
      let coords: { clientX: number; clientY: number }

      // For touch events, check if it's the same touch
      if ('touches' in e && dragState.touchId !== null) {
        const touch = getTouchById(e.touches, dragState.touchId)
        if (!touch) return
        coords = { clientX: touch.clientX, clientY: touch.clientY }
      } else {
        coords = getEventCoordinates(e)
      }

      // Calculate movement distance to determine if this is a drag or just a tap/scroll
      const deltaX = coords.clientX - dragState.startX
      const deltaY = coords.clientY - dragState.startY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // For touch events, require minimum movement to confirm drag
      if (!dragState.isDragConfirmed) {
        const DRAG_THRESHOLD = 8 // pixels
        const TIME_THRESHOLD = 150 // ms

        if (distance > DRAG_THRESHOLD || (Date.now() - dragState.startTime) > TIME_THRESHOLD) {
          dragState.isDragConfirmed = true
          e.preventDefault()
        } else {
          return // Don't prevent default yet, allow scrolling
        }
      } else {
        e.preventDefault()
      }

      // Cancel any pending animation frame
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }

      // Use requestAnimationFrame for smooth 60fps updates
      dragState.animationId = requestAnimationFrame(() => {
        const containerRect = floorPlanRef.current!.getBoundingClientRect()

        const newLeft = dragState.initialLeft + deltaX
        const newTop = dragState.initialTop + deltaY

        // Apply boundaries
        const elementWidth = dragState.element!.offsetWidth
        const elementHeight = dragState.element!.offsetHeight

        const boundedLeft = Math.max(0, Math.min(containerRect.width - elementWidth, newLeft))
        const boundedTop = Math.max(0, Math.min(containerRect.height - elementHeight, newTop))

        // Apply position directly to DOM (super fast)
        dragState.element!.style.left = `${boundedLeft}px`
        dragState.element!.style.top = `${boundedTop}px`

        // Calculate percentage for final save
        const percentX = (boundedLeft / containerRect.width) * 100
        const percentY = (boundedTop / containerRect.height) * 100

        finalPositionsRef.current[dragState.tableId!] = { x: percentX, y: percentY }
      })
    }
  }, [editMode])

  const handleTableDragEnd = useCallback((e?: MouseEvent | TouchEvent) => {
    const dragState = dragStateRef.current

    // For touch events, check if the ended touch matches our tracked touch
    if (e && 'changedTouches' in e) {
      let relevantTouch = false
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === dragState.touchId) {
          relevantTouch = true
          break
        }
      }
      if (!relevantTouch) return
    }

    // Handle drag end
    if (dragState.tableId && dragState.element && editMode && onTableUpdate) {
      // Reset visual state
      dragState.element.style.zIndex = ''
      dragState.element.style.touchAction = ''

      // Save final position to database only if drag was confirmed
      if (dragState.isDragConfirmed) {
        const finalPos = finalPositionsRef.current[dragState.tableId]
        if (finalPos) {
          try {
            onTableUpdate(dragState.tableId, finalPos)
          } catch (error) {
            console.error('Failed to update table position:', error)
            // Reset position on error
            const table = tables.find(t => t.id === dragState.tableId)
            if (table && dragState.element) {
              dragState.element.style.left = `${table.x_position}%`
              dragState.element.style.top = `${table.y_position}%`
              finalPositionsRef.current[dragState.tableId] = { x: table.x_position, y: table.y_position }
            }
          }
        }
      }

      // Clean up animation frame
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }
    }

    // Reset drag state
    dragStateRef.current = {
      tableId: null,
      element: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      initialLeft: 0,
      initialTop: 0,
      animationId: null,
      touchId: null,
      isDragConfirmed: false,
      startTime: 0
    }
  }, [editMode, onTableUpdate, tables])

  // Setup global event listeners for both mouse and touch
  useEffect(() => {
    // Mouse events - always passive false for mouse move to allow prevention
    document.addEventListener('mousemove', handleTableDragMove, { passive: false })
    document.addEventListener('mouseup', handleTableDragEnd)

    // Touch events - conditional passive based on whether we have an active touch interaction
    const handleTouchMove = (e: TouchEvent) => {
      const dragState = dragStateRef.current

      // Check if this touch event is relevant to our current interaction
      let isRelevantTouch = false
      if (dragState.touchId !== null) {
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === dragState.touchId) {
            isRelevantTouch = true
            break
          }
        }
      }

      if (isRelevantTouch) {
        handleTableDragMove(e)
      }
      // If not relevant, let the browser handle it normally for scrolling
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTableDragEnd)
    document.addEventListener('touchcancel', handleTableDragEnd)

    return () => {
      // Mouse events
      document.removeEventListener('mousemove', handleTableDragMove)
      document.removeEventListener('mouseup', handleTableDragEnd)

      // Touch events
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTableDragEnd)
      document.removeEventListener('touchcancel', handleTableDragEnd)

      // Clean up any pending animation frames
      if (dragStateRef.current.animationId) {
        cancelAnimationFrame(dragStateRef.current.animationId)
      }
    }
  }, [handleTableDragMove, handleTableDragEnd])

  const getTableBookingInfo = (table: any) => {
    // Check if this is a shared table
    const sharedTableInfo = sharedTablesSummary.find(st => st.table_id === table.id)
    const isSharedTable = !!sharedTableInfo

    // Get all bookings for this table (current, upcoming, and recent)
    let allTableBookings = bookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id)
    )

    // For shared tables, also include shared table bookings
    if (isSharedTable) {
      const sharedBookings = bookings.filter(booking => 
        booking.is_shared_booking && booking.shared_table_id === table.id
      )
      allTableBookings = [...allTableBookings, ...sharedBookings]
    }

    // Current active bookings
    const activeBookings = allTableBookings.filter(booking =>
      ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
    )

    const currentBooking = activeBookings.find(booking => {
      const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
      if (physicallyPresent) return true
      
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
      return currentTime >= bookingStart && currentTime <= bookingEnd
    })

    // Upcoming bookings (next 3)
    const upcomingBookings = allTableBookings
      .filter(booking => 
        new Date(booking.booking_time) > currentTime &&
        ['confirmed', 'pending'].includes(booking.status)
      )
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      .slice(0, 3)

    // Recent history (last 3 completed bookings from today)
    const todayStart = new Date(currentTime)
    todayStart.setHours(0, 0, 0, 0)
    
    const recentHistory = allTableBookings
      .filter(booking => {
        const bookingDate = new Date(booking.booking_time)
        return bookingDate >= todayStart && 
               bookingDate < currentTime &&
               ['completed', 'no_show'].includes(booking.status)
      })
      .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
      .slice(0, 3)

    return {
      current: currentBooking,
      upcoming: upcomingBookings[0],
      allUpcoming: upcomingBookings,
      recentHistory,
      status: tableStatuses.get(table.id),
      sharedTableInfo,
      isSharedTable,
      activeSharedBookings: isSharedTable ? activeBookings.filter(b => b.is_shared_booking) : []
    }
  }

  const handleTableDrop = useCallback((tableId: string) => {
    if (draggedBookingId && onTableSwitch) {
      onTableSwitch(draggedBookingId, [tableId])
      setDraggedBookingId(null)
      setIsDragging(false)
    }
  }, [draggedBookingId, onTableSwitch])

  const handleStatusTransition = useCallback(async (bookingId: string, newStatus: DiningStatus) => {
    try {
      setLoadingTransition(bookingId)
      await tableStatusService.updateBookingStatus(bookingId, newStatus, userId)
      if (onStatusUpdate) {
        onStatusUpdate(bookingId, newStatus)
      }
    } catch (error) {
      console.error('Status update error:', error)
    } finally {
      setLoadingTransition(null)
    }
  }, [onStatusUpdate, userId, tableStatusService])

  // Highlight tables based on search
  const isTableHighlighted = (table: any, booking: any) => {
    if (!searchQuery) return false
    const query = searchQuery.toLowerCase()
    
    if (booking) {
      const guestName = (booking.guest_name || booking.user?.full_name || '').toLowerCase()
      const phone = (booking.user?.phone_number || booking.guest_phone || '').toLowerCase()
      return guestName.includes(query) || phone.includes(query)
    }
    
    return `t${table.table_number}`.toLowerCase().includes(query)
  }

  const renderTable = (table: any) => {
    const { current, upcoming, allUpcoming, recentHistory, sharedTableInfo, isSharedTable, activeSharedBookings } = getTableBookingInfo(table)
    const isOccupied = !!current
    const StatusIcon = current ? STATUS_ICONS[current.status as DiningStatus] : (isSharedTable ? Users : Table2)
    const isHighlighted = isTableHighlighted(table, current)
    const bookingTime = current ? new Date(current.booking_time) : null
    
    // Use checked_in_at for elapsed time if guest has checked in, otherwise use booking_time
    const timeReference = current?.checked_in_at ? new Date(current.checked_in_at) : bookingTime
    const minutesSinceArrival = timeReference ? differenceInMinutes(currentTime, timeReference) : 0

    return (
      <TooltipProvider key={table.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              data-table-id={table.id}
              aria-label={`Table ${table.table_number}, capacity ${table.min_capacity}-${table.max_capacity}${current ? `, occupied by ${current.guest_name || current.user?.full_name || 'Guest'}, status: ${current.status ? titleCase(current.status) : ''}` : ', available'}`}
              className={cn(
                "relative rounded-lg border-3 cursor-pointer transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2",
                TABLE_TYPE_COLORS[table.table_type] || "bg-gradient-to-br from-background to-card border-border shadow-lg",
                // Shared table styling
                isSharedTable && "ring-2 ring-purple-400/50 border-purple-300/50",
                // Occupied table styling
                isOccupied && "ring-4 ring-offset-2 ring-offset-background shadow-xl",
                isOccupied && STATUS_COLORS[current.status as DiningStatus],
                // Hover effects with better feedback
                hoveredTable === table.id && !isOccupied && "shadow-xl scale-102 ring-2 ring-blue-400/50 ring-offset-2",
                hoveredTable === table.id && isOccupied && "shadow-2xl scale-102 brightness-110",
                // Loading state
                loadingTransition === current?.id && "motion-safe:animate-pulse ring-4 ring-yellow-400 ring-offset-2",
                // Selection state
                selectedTable === table.id && "ring-4 ring-blue-500 ring-offset-2 ring-offset-background scale-105 shadow-2xl",
                // Search highlighting
                isHighlighted && "ring-4 ring-yellow-400 motion-safe:animate-pulse ring-offset-2 ring-offset-background",
                // Drag states
                isDragging && !isOccupied && "border-dashed border-green-500 bg-green-50/70 shadow-green-200/50",
                dragStateRef.current.tableId === table.id && "shadow-2xl scale-110 cursor-grabbing z-50",
                // Edit mode styling
                editMode && "hover:ring-2 hover:ring-purple-400",
                editMode && !isOccupied && "cursor-move",
                // Shape
                table.shape === "circle" ? "rounded-full" : "rounded-lg",
                // Interactive states
                "transform-gpu will-change-transform overflow-hidden text-xs"
              )}
              style={{
                position: "absolute",
                left: `${finalPositionsRef.current[table.id]?.x ?? table.x_position}%`,
                top: `${finalPositionsRef.current[table.id]?.y ?? table.y_position}%`,
                width: `${(table.width || 120) * 0.8}px`,
                height: `${(table.height || 100) * 0.8}px`,
                padding: "6px",
                transition: dragStateRef.current.tableId === table.id ? 'none' : undefined,
                // Optimize for performance
                willChange: editMode ? "transform, left, top" : "auto",
                // Prevent iOS bounce and ensure proper touch handling
                touchAction: dragStateRef.current.tableId === table.id ? "none" : "manipulation"
              }}
              onClick={() => {
                if (editMode) return // Prevent click when in edit mode
                
                // Simple click-to-toggle selection
                if (selectedTable === table.id) {
                  setSelectedTable(null)
                  setActiveMenuTable(null)
                } else {
                  setSelectedTable(table.id)
                  // Auto-show menu for occupied tables
                  if (current) {
                    setActiveMenuTable(table.id)
                  } else {
                    // For empty tables, show details immediately
                    if (onTableClick) onTableClick(table, { 
                      current, 
                      upcoming, 
                      allUpcoming, 
                      recentHistory,
                      tableInfo: {
                        hasUpcoming: allUpcoming.length > 0,
                        hasHistory: recentHistory.length > 0,
                        nextBookingTime: allUpcoming[0]?.booking_time,
                        lastCompletedTime: recentHistory[0]?.booking_time
                      }
                    })
                  }
                }
              }}
              onMouseDown={(e) => {
                if (editMode && !isOccupied) {
                  handleTableDragStart(e, table.id)
                }
              }}
              onTouchStart={(e) => {
                if (editMode && !isOccupied) {
                  handleTableDragStart(e, table.id)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  // Trigger same logic as click
                  if (selectedTable === table.id) {
                    setSelectedTable(null)
                    setActiveMenuTable(null)
                  } else {
                    setSelectedTable(table.id)
                    if (current) {
                      setActiveMenuTable(table.id)
                    } else if (onTableClick) {
                      onTableClick(table, { 
                        current, 
                        upcoming, 
                        allUpcoming, 
                        recentHistory,
                        tableInfo: {
                          hasUpcoming: allUpcoming.length > 0,
                          hasHistory: recentHistory.length > 0,
                          nextBookingTime: allUpcoming[0]?.booking_time,
                          lastCompletedTime: recentHistory[0]?.booking_time
                        }
                      })
                    }
                  }
                }
              }}
              onMouseEnter={() => setHoveredTable(table.id)}
              onMouseLeave={() => setHoveredTable(null)}
              onDragOver={(e) => {
                if (!isOccupied && !editMode) {
                  e.preventDefault()
                  e.currentTarget.classList.add("scale-105")
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("scale-105")
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove("scale-105")
                if (!isOccupied && !editMode) {
                  handleTableDrop(table.id)
                }
              }}
            >
           

              {/* Table header - Improved visibility */}
              <div className="flex flex-col items-center mb-1">
                <div className="flex items-center gap-1">
                  <StatusIcon className={cn(
                    "h-4 w-4 text-current",
                    isSharedTable && "text-purple-500"
                  )} />
                  <span className="font-bold text-sm text-foreground">T{table.table_number}</span>
                  {isSharedTable && (
                    <div className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-semibold">
                      SHARED
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center mt-1">
                  <UserCheck className="h-3 w-3 inline-block mr-1" />
                  <span className="text-xs text-muted-foreground font-semibold">
                    {isSharedTable ? (
                      <span className="text-purple-600">
                        {sharedTableInfo?.current_occupancy || 0}/{sharedTableInfo?.capacity || table.max_capacity}
                      </span>
                    ) : (
                      table.max_capacity
                    )}
                  </span>
                </div>
              </div>

              {/* Current booking info */}
              {isOccupied && current ? (
                <div className="space-y-2">
                  {/* Guest info - Enhanced readability */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <p className="font-bold text-xs truncate text-foreground leading-tight">
                        {(current.guest_name || current.user?.full_name || 'Guest').split(' ')[0]}
                      </p>
                      {current.special_offers && (
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div className="flex-shrink-0">
                                <Gift className="h-3 w-3 text-green-600" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="text-xs space-y-1">
                                <p className="font-semibold text-green-700">{current.special_offers.title}</p>
                                {current.special_offers.discount_percentage && (
                                  <p className="text-green-600">{current.special_offers.discount_percentage}% OFF</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {current.is_shared_booking && (
                        <span className="ml-1 text-purple-500 text-[10px]">({current.seats_requested} seats)</span>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {/* Party size with visual indicators */}
                      <div className={cn(
                        "flex items-center px-2 py-1 rounded text-xs font-bold",
                        current.party_size > table.max_capacity 
                          ? "bg-red-500 text-white" 
                          : "bg-blue-500 text-white"
                      )}>
                        <UserCheck className="h-3 w-3 inline-block mr-1" />{current.party_size}{current.party_size > table.max_capacity && '⚠️'}
                      </div>
                      
                      {/* Time indicator with urgency colors */}
                      <div className={cn(
                        "flex items-center px-2 py-1 rounded text-xs font-bold",
                        minutesSinceArrival > (current.turn_time_minutes || 120) 
                          ? "bg-red-500 text-white" :
                        minutesSinceArrival > (current.turn_time_minutes || 120) * 0.8 
                          ? "bg-orange-500 text-white" :
                        "bg-green-500 text-white"
                      )}>
                        ⏱️{minutesSinceArrival}m{minutesSinceArrival > (current.turn_time_minutes || 120) && '⚠️'}
                      </div>
                    </div>
                    
                    {/* Call button - centered */}
                    {(current.user?.phone_number || current.guest_phone) && (
                      <div className="flex justify-center mt-1">
                        <button
                          aria-label={`Call guest`}
                          className="text-sm hover:scale-125 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation()
                            const phone = current.user?.phone_number || current.guest_phone
                            window.open(`tel:${phone}`, '_self')
                          }}
                        >
                          📞
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status indicator - centered and larger */}
                  <div className="flex items-center justify-center mt-1">
                    <div className="text-lg">
                      {current.status === 'arrived' && '👋'}
                      {current.status === 'seated' && '🪑'}
                      {current.status === 'ordered' && '📝'}
                      {current.status === 'appetizers' && '🥗'}
                      {current.status === 'main_course' && '🍽️'}
                      {current.status === 'dessert' && '🍰'}
                      {current.status === 'payment' && '💳'}
                      {current.status === 'completed' && '✅'}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="mb-2 flex justify-center">
                    {isSharedTable ? (
                      <div className="w-6 h-6 mx-auto bg-purple-500 rounded-full flex items-center justify-center">
                        <Users className="text-white text-xs" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 mx-auto bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Shared table availability info */}
                  {isSharedTable && sharedTableInfo && (
                    <div className="text-center p-2 bg-purple-50 border border-purple-200 rounded text-xs mb-2">
                      <div className="font-bold text-purple-800">
                        {(sharedTableInfo.capacity - sharedTableInfo.current_occupancy)} seats available
                      </div>
                      {activeSharedBookings.length > 0 && (
                        <div className="text-purple-700 text-[10px] mt-1">
                          {activeSharedBookings.length} active booking{activeSharedBookings.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Enhanced upcoming booking display */}
                  {upcoming && (
                    <div className="text-center p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <div className="font-bold text-blue-800 mb-1">
                        🕒{format(new Date(upcoming.booking_time), 'H:mm')}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-blue-700">
                        <span className="truncate">{(upcoming.guest_name || upcoming.user?.full_name || '').split(' ')[0]} ({upcoming.party_size})</span>
                        {upcoming.special_offers && (
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <div className="flex-shrink-0">
                                  <Gift className="h-2.5 w-2.5 text-green-600" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="text-xs space-y-1">
                                  <p className="font-semibold text-green-700">{upcoming.special_offers.title}</p>
                                  {upcoming.special_offers.discount_percentage && (
                                    <p className="text-green-600">{upcoming.special_offers.discount_percentage}% OFF</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {upcoming.is_shared_booking && (
                          <div className="text-purple-600 text-[10px]">{upcoming.seats_requested} seats</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Enhanced activity indicators */}
                  {!upcoming && (allUpcoming.length > 0 || recentHistory.length > 0) && (
                    <div className="flex justify-center gap-2 mt-2">
                      {allUpcoming.length > 0 && (
                        <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded font-medium">
                          📅{allUpcoming.length}
                        </div>
                      )}
                      {recentHistory.length > 0 && (
                        <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded font-medium">
                          ✅{recentHistory.length}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Drag handle for moving bookings between tables */}
              {isOccupied && current && !editMode && (
                <div
                  className="absolute top-1 right-1 p-1 bg-background/80 border border-border rounded cursor-move hover:bg-background transition-colors"
                  draggable
                  onDragStart={(e) => {
                    setIsDragging(true)
                    setDraggedBookingId(current.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={() => {
                    setIsDragging(false)
                    setDraggedBookingId(null)
                  }}
                >
                  <Hand className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            {current ? (
              <div className="space-y-2">
                <p className="font-semibold text-primary-foreground">{current.guest_name || current.user?.full_name}</p>
                <div className="space-y-1 text-sm text-primary-foreground">
                  <p>Party of {current.party_size}</p>
                  {current.is_shared_booking && (
                    <p className="text-purple-200">Shared table booking ({current.seats_requested} seats)</p>
                  )}
                  <p>Arrived: {format(bookingTime!, 'h:mm a')}</p>
                  <p>Status: {titleCase(current.status)}</p>
                  {current.special_requests && (
                    <div className="mt-2 p-2 bg-primary-foreground/10 rounded border border-primary-foreground/20">
                      <p className="text-xs font-medium text-primary-foreground/90 mb-1 not-italic">Special Requests:</p>
                      <p className="text-xs text-primary-foreground/80 leading-relaxed break-words whitespace-pre-wrap not-italic">{current.special_requests}</p>
                    </div>
                  )}
                  {(current.user?.phone_number || current.guest_phone) && (
                    <p className="font-mono text-primary-foreground">📞 {current.user?.phone_number || current.guest_phone}</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-primary-foreground">Table {table.table_number}</p>
                <p className="text-sm text-primary-foreground">Capacity: {table.min_capacity}-{table.max_capacity}</p>
                <p className="text-sm text-primary-foreground">Type: {titleCase(table.table_type)}</p>
                {isSharedTable && sharedTableInfo && (
                  <div className="text-sm mt-2">
                    <p className="text-purple-200 font-medium">🤝 Shared Table</p>
                    <p className="text-primary-foreground">Occupancy: {sharedTableInfo.current_occupancy}/{sharedTableInfo.capacity}</p>
                    <p className="text-primary-foreground">Available: {sharedTableInfo.capacity - sharedTableInfo.current_occupancy} seats</p>
                  </div>
                )}
                {upcoming && (
                  <p className="text-sm mt-2 text-primary-foreground">
                    Next: {format(new Date(upcoming.booking_time), 'h:mm a')}
                    {upcoming.is_shared_booking && (
                      <span className="text-purple-200"> ({upcoming.seats_requested} seats)</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }


  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-background to-card ">
      {/* Enhanced section navigation with improved visibility */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-10">
        <div className="px-4 py-3">
          {sectionViewMode === "tabs" ? (
            /* Horizontal inline layout - improved spacing and size */
            <div className="flex items-center gap-2 flex-wrap">
              {sectionStats.map(stat => {
                const Icon = SECTION_ICONS[stat.icon as keyof typeof SECTION_ICONS] || Grid3X3
                const isActive = stat.id === selectedSection
                
                return (
                  <Tooltip key={stat.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedSection(stat.id)}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all touch-manipulation relative shadow-sm",
                          isActive 
                            ? "bg-primary/15 text-primary border-2 border-primary/40 shadow-md" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-2 border-transparent hover:border-border"
                        )}
                      >
                        <div className="relative">
                          <Icon className="h-4 w-4" style={{ color: stat.color }} />
                          {stat.occupiedCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                          )}
                        </div>
                        <span className="font-semibold truncate max-w-24">{stat.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full font-medium">
                          {stat.tableCount}{stat.occupiedCount > 0 && <span className="text-red-600 font-bold">/{stat.occupiedCount}</span>}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p className="font-semibold text-primary-foreground">{stat.name}</p>
                        <p className="text-xs text-primary-foreground">
                          {stat.tableCount} tables • {stat.occupiedCount} occupied • {stat.availableCount} available • {stat.occupancyRate}% occupancy
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ) : (
            /* Compact dropdown mode */
            <div className="flex items-center gap-2">
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger className="w-48 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectionStats.map(stat => {
                    const Icon = SECTION_ICONS[stat.icon as keyof typeof SECTION_ICONS] || Grid3X3
                    
                    return (
                      <SelectItem key={stat.id} value={stat.id}>
                        <div className="flex items-center gap-2 text-xs">
                          <Icon className="h-3 w-3" style={{ color: stat.color }} />
                          {stat.name} ({stat.tableCount}/{stat.occupiedCount})
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              
              {/* Compact stats */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {filteredTables.filter(t => {
                    const hasBooking = bookings.some(b => 
                      b.tables?.some((bt: any) => bt.id === t.id) &&
                      ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
                    )
                    return !hasBooking
                  }).length}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  {filteredTables.filter(t => {
                    const hasBooking = bookings.some(b => 
                      b.tables?.some((bt: any) => bt.id === t.id) &&
                      ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
                    )
                    return hasBooking
                  }).length}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floor Plan Area */}
      <div className="flex-1 relative bg-gradient-to-br from-card to-muted overflow-auto px-3 md:px-4" ref={floorPlanRef}>
        
        {/* Edit Mode Toggle - Positioned within floor plan area */}
        {onTableUpdate && (
          <div className="absolute top-4 left-4 z-30">
            <Button
              size="icon"
              aria-label={editMode ? "Exit Edit Layout" : "Edit Layout"}
              variant={editMode ? "destructive" : "secondary"}
              onClick={() => {
                setEditMode(!editMode)
                // Reset drag state when exiting edit mode
                dragStateRef.current = {
                  tableId: null,
                  element: null,
                  startX: 0,
                  startY: 0,
                  offsetX: 0,
                  offsetY: 0,
                  initialLeft: 0,
                  initialTop: 0,
                  animationId: null,
                  touchId: null,
                  isDragConfirmed: false,
                  startTime: 0
                }
              }}
              className={cn(
                "shadow-lg transition-all duration-200",
                editMode 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-background/90 hover:bg-background text-foreground border border-border"
              )}
            >
              {editMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </Button>
          </div>
        )}
        
        {/* Floating control buttons - top right */}
        {/* 
        <div className="fixed top-4 right-4 z-40 flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSectionViewMode(sectionViewMode === "tabs" ? "dropdown" : "tabs")}
            className="h-5 w-5 p-0 shadow-lg bg-background/90 hover:bg-background border"
            title="Toggle view mode"
          >
            <Eye className="h-3 w-3" />
          </Button>
          
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowSectionOverview(!showSectionOverview)}
            className="h-5 w-5 p-0 shadow-lg bg-background/90 hover:bg-background border"
            title="Section overview"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        */}
        <div 
          className="relative w-full h-full"
          style={{ minHeight: "600px", minWidth: "700px" }}
          onClick={(e) => {
            // Only deselect if clicking on empty space
            if (e.target === e.currentTarget) {
              setSelectedTable(null)
              setActiveMenuTable(null)
            }
          }}
        >
          {/* Render filtered tables */}
          {filteredTables.filter(t => t.is_active).map(renderTable)}
          
          {/* Floating Quick Actions Menu - positioned to avoid overlap with section headers */}
          {selectedTable && activeMenuTable && (() => {
            const selectedTableData = filteredTables.find(t => t.id === selectedTable)
            if (!selectedTableData) return null
            
            const { current } = getTableBookingInfo(selectedTableData)
            if (!current) return null
            
            return (
              <div 
                className="fixed z-[9999] bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl p-2 pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
                style={{
                  right: '20px',
                  bottom: '20px',
                  maxWidth: 'calc(100vw - 40px)',
                }}
              >
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground mr-2 whitespace-nowrap">
                    T{selectedTableData.table_number}:
                  </span>
                  
                  {/* Enhanced quick status buttons */}
                  {current.status === 'arrived' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-lg font-semibold border border-primary/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'seated')}
                      disabled={loadingTransition === current.id}
                    >
                      <ChefHat className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {current.status === 'seated' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary text-secondary-foreground rounded-lg font-semibold border border-secondary/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'ordered')}
                      disabled={loadingTransition === current.id}
                    >
                      <Coffee className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {current.status === 'ordered' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground rounded-lg font-semibold border border-accent/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'appetizers')}
                      disabled={loadingTransition === current.id}
                    >
                      <Coffee className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {current.status === 'appetizers' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-lg font-semibold border border-primary/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'main_course')}
                      disabled={loadingTransition === current.id}
                    >
                      <Utensils className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {current.status === 'main_course' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground rounded-lg font-semibold border border-accent/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'dessert')}
                      disabled={loadingTransition === current.id}
                    >
                      <Coffee className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {current.status === 'dessert' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground rounded-lg font-semibold border border-accent/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'payment')}
                      disabled={loadingTransition === current.id}
                    >
                      <CreditCard className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {current.status === 'payment' && (
                    <Button 
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-[hsl(var(--status-available))] to-[hsl(var(--status-available))]/80 hover:from-[hsl(var(--status-available))]/80 hover:to-[hsl(var(--status-available))] text-white rounded-lg font-semibold border border-[hsl(var(--status-available))]/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'completed')}
                      disabled={loadingTransition === current.id}
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Quick complete button for any status except completed */}
                  {current.status !== 'completed' && current.status !== 'payment' && current.status !== 'dessert' && (
                    <Button
                      size="sm"
                      className="h-8 text-xs px-3 shadow-lg bg-gradient-to-r from-[hsl(var(--booking-confirmed))] to-[hsl(var(--booking-confirmed))]/80 hover:from-[hsl(var(--booking-confirmed))]/80 hover:to-[hsl(var(--booking-confirmed))] text-white rounded-lg font-semibold border border-[hsl(var(--booking-confirmed))]/40 hover:scale-105 transition-all duration-200"
                      onClick={() => handleStatusTransition(current.id, 'completed')}
                      disabled={loadingTransition === current.id}
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}

                  {/* View Details button */}
                  <Button 
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs font-medium border-border hover:bg-muted"
                    onClick={() => {
                      const { upcoming, allUpcoming, recentHistory } = getTableBookingInfo(selectedTableData)
                      if (onTableClick) onTableClick(selectedTableData, { current, upcoming, allUpcoming, recentHistory })
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Info
                  </Button>
                  
                  {/* Close button */}
                  <Button 
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 ml-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedTable(null)
                      setActiveMenuTable(null)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })()}
          
          {/* Empty state for sections */}
          {filteredTables.length === 0 && selectedSection && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Tables in This Section</h3>
                <p className="text-sm text-muted-foreground">{sections?.find(s => s.id === selectedSection)?.name || "This section"} has no tables yet
                </p>
              </div>
            </div>
          )}
          
          {/* Enhanced accessibility overlay for screen readers */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {selectedTable && (() => {
              const selectedTableData = filteredTables.find(t => t.id === selectedTable)
              const { current } = selectedTableData ? getTableBookingInfo(selectedTableData) : { current: null }
              return `Table ${selectedTableData?.table_number} selected. ${current ? `Occupied by ${current.guest_name || current.user?.full_name || 'Guest'}, status: ${titleCase(current.status)}.` : 'Available for booking.'}`
            })()}
          </div>
        </div>
        
        {/* Section Overview Overlay */}
        <SectionOverview />
      </div>
    </div>
  )
})

// Add display name for debugging
UnifiedFloorPlan.displayName = 'UnifiedFloorPlan'
