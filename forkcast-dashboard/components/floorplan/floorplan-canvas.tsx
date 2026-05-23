// components/floorplan/floorplan-canvas.tsx
"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Eye, EyeOff, Plus, Minus, Clock, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FloorplanTable, type ShiftBookingPill } from './floorplan-table'
import { ShiftSelector } from './shift-selector'
import type { RestaurantTable, RestaurantSection, RestaurantShift } from '@/types'
import type { TableDisplayColor, SectionCapacity } from '@/app/(dashboard)/floorplan/page'
import { getShiftWindow, parseTimeToMinutes } from '@/lib/utils/shifts'
import type { TableProgress } from '@/lib/utils/table-progress'

interface FloorplanCanvasProps {
  tables: RestaurantTable[]
  sections: RestaurantSection[]
  activeSection: string
  onSectionChange: (section: string) => void
  selectedTableId: string | null
  selectedBookingId: string | null
  highlightedTableIds: string[]
  recommendedTableId?: string | null
  showDecor: boolean
  onToggleDecor: () => void
  tableDisplayColors: Record<string, TableDisplayColor>
  tableGuestNames?: Record<string, string>
  tableUpcomingReservations: Record<string, boolean>
  tableLateArrivals?: Record<string, boolean>
  sectionCapacities?: Record<string, SectionCapacity>
  onSelectTable: (tableId: string | null) => void
  onDropBookingOnTable: (tableId: string) => void
  onDeselectBooking?: () => void
  isAssignMode?: boolean
  viewMode?: 'canvas' | 'list'
  onViewModeChange?: (mode: 'canvas' | 'list') => void
  isBookingsPanelOpen?: boolean
  selectedDate?: Date
  selectedTime?: string
  onDateChange?: (date: Date) => void
  onTimeChange?: (time: string) => void
  onNow?: () => void
  isLegendExpanded?: boolean
  zoomAdjust?: number
  panOffset?: { x: number; y: number }
  // Shift filtering
  shifts?: RestaurantShift[]
  selectedShiftId?: string | null
  onShiftChange?: (shiftId: string | null) => void
  selectedShift?: RestaurantShift | null
  tableShiftPills?: Record<string, ShiftBookingPill[]>
  tableProgress?: Record<string, TableProgress | null>
}

const TABLE_SIZE = 92
const TABLE_MARGIN = 40 // Extra margin around tables for better fit
const MIN_ZOOM = 0.15
const MAX_ZOOM = 3.5
const AUTO_FIT_WORLD_PADDING = 30 // world units padding around content for auto-fit

export function FloorplanCanvas({
  tables,
  sections,
  activeSection,
  onSectionChange,
  selectedTableId,
  selectedBookingId,
  highlightedTableIds,
  recommendedTableId,
  showDecor,
  onToggleDecor,
  tableDisplayColors,
  tableGuestNames,
  tableUpcomingReservations,
  tableLateArrivals = {},
  sectionCapacities = {},
  onSelectTable,
  onDropBookingOnTable,
  onDeselectBooking,
  isAssignMode = false,
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
  isBookingsPanelOpen: _isBookingsPanelOpen = false,
  selectedDate: _selectedDate,
  selectedTime,
  onDateChange: _onDateChange,
  onTimeChange,
  onNow,
  isLegendExpanded = false,
  zoomAdjust = 1,
  panOffset = { x: 0, y: 0 },
  shifts,
  selectedShiftId = null,
  onShiftChange,
  selectedShift = null,
  tableShiftPills,
  tableProgress,
}: FloorplanCanvasProps) {
  // Shift window (in minutes) for clamping the time picker
  const shiftWindow = useMemo(() => getShiftWindow(selectedShift), [selectedShift])
  const [zoom, setZoom] = useState(0.7)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isTimePopoverOpen, setIsTimePopoverOpen] = useState(false)
  const isTimePopoverOpenRef = useRef(false)
  const [tempHour, setTempHour] = useState(12)
  const [tempMinutes, setTempMinutes] = useState(0)
  const [tempAmPm, setTempAmPm] = useState<'AM' | 'PM'>('PM')
  const tempHourRef = useRef(tempHour)
  const tempMinutesRef = useRef(tempMinutes)
  const tempAmPmRef = useRef(tempAmPm)
  tempHourRef.current = tempHour
  tempMinutesRef.current = tempMinutes
  tempAmPmRef.current = tempAmPm
  
  // Convert 24-hour to 12-hour format
  const get12HourTime = useCallback((time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const ampm = hours < 12 ? 'AM' : 'PM'
    return { hour12, minutes, ampm }
  }, [])
  
  // Convert 12-hour to 24-hour format
  const to24Hour = useCallback((hour12: number, minutes: number, ampm: string) => {
    let hour24 = hour12
    if (ampm === 'AM' && hour12 === 12) hour24 = 0
    if (ampm === 'PM' && hour12 !== 12) hour24 = hour12 + 12
    return `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }, [])
  
  // Update temp values when selectedTime changes or popover opens
  useEffect(() => {
    if (selectedTime && isTimePopoverOpen) {
      const { hour12, minutes, ampm } = get12HourTime(selectedTime)
      setTempHour(hour12)
      setTempMinutes(minutes)
      setTempAmPm(ampm as 'AM' | 'PM')
    }
  }, [selectedTime, isTimePopoverOpen, get12HourTime])
  const canvasRef = useRef<HTMLDivElement>(null)
  const hasAutoFit = useRef(false)
  const viewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  // Calculate bounding box of tables with margin
  // Use generous sizing per shape to ensure all table visuals are captured
  const contentBounds = useMemo(() => {
    if (tables.length === 0) {
      return { minX: 0, minY: 0, maxX: 600, maxY: 400 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const t of tables) {
      const x = t.x_position || 0
      const y = t.y_position || 0
      // Estimate rendered size from shape + capacity (mirrors FloorplanTable)
      const cap = t.max_capacity || (t as any).capacity || 4
      const shape = t.shape || 'square'
      let width = t.width || TABLE_SIZE
      let height = t.height || TABLE_SIZE
      if (!t.width || !t.height) {
        if (shape === 'rectangle') {
          width = cap <= 6 ? 130 : 156
          height = cap <= 6 ? 78 : 86
        } else if (shape === 'banquet') {
          width = 200; height = 78
        } else {
          width = cap <= 2 ? 76 : 92
          height = cap <= 2 ? 76 : 92
        }
      }

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    }
    return { 
      minX: minX - TABLE_MARGIN, 
      minY: minY - TABLE_MARGIN, 
      maxX: maxX + TABLE_MARGIN, 
      maxY: maxY + TABLE_MARGIN 
    }
  }, [tables])

  const contentWidth = contentBounds.maxX - contentBounds.minX
  const contentHeight = contentBounds.maxY - contentBounds.minY
  const contentCenterX = contentBounds.minX + contentWidth / 2
  const contentCenterY = contentBounds.minY + contentHeight / 2

  // Room bounds – slightly larger than content, so the "walls" feel like
  // the outer contour of the room, not hugging a single table.
  const roomBounds = useMemo(() => {
    const MIN_ROOM_WIDTH = 800
    const MIN_ROOM_HEIGHT = 600

    const currentWidth = contentWidth
    const currentHeight = contentHeight

    let minX = contentBounds.minX
    let minY = contentBounds.minY
    let maxX = contentBounds.maxX
    let maxY = contentBounds.maxY

    const centerX = contentCenterX
    const centerY = contentCenterY

    if (currentWidth < MIN_ROOM_WIDTH) {
      minX = centerX - MIN_ROOM_WIDTH / 2
      maxX = centerX + MIN_ROOM_WIDTH / 2
    }

    if (currentHeight < MIN_ROOM_HEIGHT) {
      minY = centerY - MIN_ROOM_HEIGHT / 2
      maxY = centerY + MIN_ROOM_HEIGHT / 2
    }

    return { minX, minY, maxX, maxY }
  }, [contentBounds, contentWidth, contentHeight, contentCenterX, contentCenterY])

  const roomWidth = roomBounds.maxX - roomBounds.minX
  const roomHeight = roomBounds.maxY - roomBounds.minY

  // Get decor color based on type, using CSS custom properties from globals.css
  const getDecorColor = (type: string): string => {
    const varName = {
      'plant': '--decor-plant',
      'wall': '--decor-wall',
      'pillar': '--decor-pillar',
      'entrance': '--decor-entrance',
      'host-stand': '--decor-host-stand',
      'restroom': '--decor-restroom',
      'window': '--decor-window',
      'bar-counter': '--decor-bar-counter',
    }[type] || '--decor-default'

    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    return raw ? `hsl(${raw})` : 'hsl(220 14% 96%)'
  }

  // Get decor label (shows in /floorplan/tables view)
  const getDecorLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'plant': 'Plant',
      'wall': 'Wall',
      'pillar': 'Pillar',
      'entrance': 'Entrance',
      'host-stand': 'Host Stand',
      'restroom': 'Restroom',
      'window': 'Window',
      'bar-counter': 'Bar',
    }
    return labels[type] || 'Decor'
  }

  // Auto-fit: compute zoom & offset to fit all tables perfectly in viewport
  const autoFit = useCallback(() => {
    const el = canvasRef.current
    if (!el || tables.length === 0) return
    
    const rect = el.getBoundingClientRect()
    const vw = rect.width
    const vh = rect.height
    
    if (vw === 0 || vh === 0) return // Wait for valid dimensions

    viewportRef.current = { width: vw, height: vh }
    
    // Get safe area insets - account for Android action bar
    let safeAreaTop = 0
    let safeAreaBottom = 0
    
    if (typeof window !== 'undefined') {
      // Try to get safe area from CSS env variables
      const rootStyle = getComputedStyle(document.documentElement)
      // Read CSS custom properties set from env() via a hidden element technique
      // env(safe-area-inset-*) cannot be read via getComputedStyle directly;
      // instead, use the element's actual position to infer insets.
      const topValue = rootStyle.getPropertyValue('--safe-area-inset-top')?.trim() || '0'
      const bottomValue = rootStyle.getPropertyValue('--safe-area-inset-bottom')?.trim() || '0'
      safeAreaTop = Math.max(0, parseInt(topValue, 10) || 0)
      safeAreaBottom = Math.max(0, parseInt(bottomValue, 10) || 0)
      
      // Primary approach: use the element's actual position in the viewport
      // This accounts for headers, nav bars, and system chrome
      if (rect.top > 0) {
        safeAreaTop = Math.max(safeAreaTop, rect.top)
      }
      
      // Fallback for Android: estimate action bar height if no other inset detected
      if (safeAreaTop === 0 && /Android/i.test(navigator.userAgent)) {
        // Use screen height vs window height difference as a proxy
        const chromeHeight = screen.height - window.innerHeight
        safeAreaTop = chromeHeight > 0 ? Math.min(chromeHeight, 56) : 0
      }
    }
    
    // Calculate the scale needed to fit content with world padding
    const paddedWidth = Math.max(contentWidth + AUTO_FIT_WORLD_PADDING * 2, 1)
    const paddedHeight = Math.max(contentHeight + AUTO_FIT_WORLD_PADDING * 2, 1)

    const availableWidth = Math.max(vw, 1)
    const availableHeight = Math.max(vh - safeAreaTop - safeAreaBottom, 1)
    
    const zoomX = availableWidth / paddedWidth
    const zoomY = availableHeight / paddedHeight
    
    // Use the smaller scale so everything fits, with a slight margin
    const fitZoom = Math.min(zoomX, zoomY) * 0.98
    
    // Clamp zoom for tablet
    const finalZoom = Math.min(Math.max(fitZoom, MIN_ZOOM), MAX_ZOOM)
    
    // Center the content in the usable area (below action bar)
    // Offset Y should account for safe area top so content starts below action bar
    const ox = vw / 2 - contentCenterX * finalZoom
    const oy = safeAreaTop + (vh - safeAreaTop - safeAreaBottom) / 2 - contentCenterY * finalZoom
    
    setZoom(finalZoom)
    setOffset({ x: ox, y: oy })
  }, [contentCenterX, contentCenterY, contentWidth, contentHeight, tables.length])

  const zoomRef = useRef(zoom)
  const offsetRef = useRef(offset)
  const panRafIdRef = useRef<number | null>(null)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  // Clamp panning so the floorplan can't be completely lost off-screen,
  // while still allowing a small overscroll margin (~10% of world size).
  const clampOffset = useCallback(
    (candidate: { x: number; y: number }, currentZoom: number) => {
      const { width: vw, height: vh } = viewportRef.current
      if (!vw || !vh) return candidate

      const worldMinX = contentBounds.minX
      const worldMaxX = contentBounds.maxX
      const worldMinY = contentBounds.minY
      const worldMaxY = contentBounds.maxY

      const worldWidth = worldMaxX - worldMinX
      const worldHeight = worldMaxY - worldMinY

      const marginX = 0.1 * worldWidth * currentZoom
      const marginY = 0.1 * worldHeight * currentZoom

      let { x, y } = candidate

      const worldLeftScreen = worldMinX * currentZoom + x
      const worldRightScreen = worldMaxX * currentZoom + x
      const worldTopScreen = worldMinY * currentZoom + y
      const worldBottomScreen = worldMaxY * currentZoom + y

      // Horizontal constraints
      if (worldRightScreen < -marginX) {
        const delta = -marginX - worldRightScreen
        x += delta
      }
      if (worldLeftScreen > vw + marginX) {
        const delta = worldLeftScreen - (vw + marginX)
        x -= delta
      }

      // Vertical constraints
      if (worldBottomScreen < -marginY) {
        const delta = -marginY - worldBottomScreen
        y += delta
      }
      if (worldTopScreen > vh + marginY) {
        const delta = worldTopScreen - (vh + marginY)
        y -= delta
      }

      return { x, y }
    },
    [contentBounds]
  )

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const panStateRef = useRef<{
    pointerId: number | null
    isPanning: boolean
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
  }>({
    pointerId: null,
    isPanning: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  })

  const pinchStateRef = useRef<{
    isPinching: boolean
    pointerIds: number[]
    initialDistance: number
    initialZoom: number
    initialOffsetX: number
    initialOffsetY: number
    initialMidpoint: { x: number; y: number }
    worldCenter: { x: number; y: number }
  }>({
    isPinching: false,
    pointerIds: [],
    initialDistance: 0,
    initialZoom: 1,
    initialOffsetX: 0,
    initialOffsetY: 0,
    initialMidpoint: { x: 0, y: 0 },
    worldCenter: { x: 0, y: 0 },
  })

  // Zoom helper for +/- buttons: zooms around viewport center while keeping
  // the same world point under the center.
  const zoomByFactor = useCallback(
    (factor: number) => {
      const { width: vwInitial, height: vhInitial } = viewportRef.current
      let vw = vwInitial
      let vh = vhInitial

      if ((!vw || !vh) && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        vw = rect.width
        vh = rect.height
        viewportRef.current = { width: vw, height: vh }
      }

      if (!vw || !vh) return

      const currentZoom = zoomRef.current
      let nextZoom = currentZoom * factor
      nextZoom = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
      if (Math.abs(nextZoom - currentZoom) < 0.001) return

      const currentOffset = offsetRef.current
      const worldCenterX = (vw / 2 - currentOffset.x) / currentZoom
      const worldCenterY = (vh / 2 - currentOffset.y) / currentZoom

      const nextOffsetX = vw / 2 - worldCenterX * nextZoom
      const nextOffsetY = vh / 2 - worldCenterY * nextZoom
      const clamped = clampOffset({ x: nextOffsetX, y: nextOffsetY }, nextZoom)

      setZoom(nextZoom)
      setOffset(clamped)
    },
    [clampOffset]
  )

  // Zoom the camera so a single table is nicely framed and centered
  const zoomToTable = useCallback(
    (table: RestaurantTable) => {
      const { width: vw, height: vh } = viewportRef.current
      if (!vw || !vh) return

      const baseX = table.x_position || 0
      const baseY = table.y_position || 0
      const worldMinX = baseX
      const worldMinY = baseY
      const worldMaxX = baseX + (table.width || TABLE_SIZE)
      const worldMaxY = baseY + (table.height || TABLE_SIZE)

      const worldWidth = worldMaxX - worldMinX
      const worldHeight = worldMaxY - worldMinY

      const paddedWidth = Math.max(worldWidth + AUTO_FIT_WORLD_PADDING * 2, 1)
      const paddedHeight = Math.max(worldHeight + AUTO_FIT_WORLD_PADDING * 2, 1)

      const zoomX = vw / paddedWidth
      const zoomY = vh / paddedHeight

      const fitZoom = Math.min(zoomX, zoomY) * 0.92
      const nextZoom = Math.min(Math.max(fitZoom, MIN_ZOOM), MAX_ZOOM)

      const centerX = worldMinX + worldWidth / 2
      const centerY = worldMinY + worldHeight / 2

      const offsetX = vw / 2 - centerX * nextZoom
      const offsetY = vh / 2 - centerY * nextZoom

      const clamped = clampOffset({ x: offsetX, y: offsetY }, nextZoom)
      setZoom(nextZoom)
      setOffset(clamped)
    },
    [clampOffset]
  )

  // Auto-fit whenever tables or section changes
  useEffect(() => {
    hasAutoFit.current = false
  }, [activeSection, tables])

  useEffect(() => {
    if (!hasAutoFit.current) {
      // Run auto-fit immediately and again after a short delay to handle late layout
      requestAnimationFrame(() => {
        autoFit()
        hasAutoFit.current = true
      })
      // Retry after layout stabilizes (covers slow renders / SSR hydration)
      const timer = setTimeout(() => {
        autoFit()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [autoFit, activeSection, tables])

  // Auto-fit on resize
  useEffect(() => {
    const handler = () => autoFit()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [autoFit])

  // Mouse wheel zoom — zooms toward cursor position
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Ignore wheel events on UI overlays (sections bar, legend, zoom controls)
      if ((e.target as HTMLElement).closest('[data-ui]')) return
      e.preventDefault()

      const currentZoom = zoomRef.current
      const currentOffset = offsetRef.current
      const rect = el.getBoundingClientRect()

      // Determine zoom factor from scroll delta
      const delta = -e.deltaY
      const factor = delta > 0 ? 1.12 : 1 / 1.12
      let nextZoom = currentZoom * factor
      nextZoom = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
      if (Math.abs(nextZoom - currentZoom) < 0.001) return

      // Zoom toward cursor position
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const worldX = (cursorX - currentOffset.x) / currentZoom
      const worldY = (cursorY - currentOffset.y) / currentZoom

      const nextOffsetX = cursorX - worldX * nextZoom
      const nextOffsetY = cursorY - worldY * nextZoom
      const clamped = clampOffset({ x: nextOffsetX, y: nextOffsetY }, nextZoom)

      setZoom(nextZoom)
      setOffset(clamped)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [clampOffset])

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Touch-first camera controls: pan (1-finger), pinch-zoom (2-finger)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Skip canvas interactions while time popover is open
      if (isTimePopoverOpenRef.current) return

      const isInteractiveTarget = (e.target as HTMLElement).closest('[data-table], [data-ui]')
      if (isInteractiveTarget) {
        // Let tables and UI handle their own interactions
        return
      }

      if (e.pointerType === 'touch') {
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const pointers = activePointersRef.current

        if (pointers.size === 1) {
          const { x, y } = pointers.get(e.pointerId)!
          panStateRef.current = {
            pointerId: e.pointerId,
            isPanning: true,
            startX: x,
            startY: y,
            startOffsetX: offsetRef.current.x,
            startOffsetY: offsetRef.current.y,
          }
        } else if (pointers.size === 2) {
          const [id1, id2] = Array.from(pointers.keys())
          const p1 = pointers.get(id1)!
          const p2 = pointers.get(id2)!
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)

          const initialZoom = zoomRef.current
          const initialOffset = offsetRef.current
          const worldCenterX = (midX - initialOffset.x) / initialZoom
          const worldCenterY = (midY - initialOffset.y) / initialZoom

          pinchStateRef.current = {
            isPinching: true,
            pointerIds: [id1, id2],
            initialDistance: dist,
            initialZoom,
            initialOffsetX: initialOffset.x,
            initialOffsetY: initialOffset.y,
            initialMidpoint: { x: midX, y: midY },
            worldCenter: { x: worldCenterX, y: worldCenterY },
          }

          // Cancel pan while pinching
          panStateRef.current.isPanning = false
          panStateRef.current.pointerId = null
        }

        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } else if (e.pointerType === 'mouse' && e.buttons === 1) {
        // Support mouse drag panning for desktop use
        panStateRef.current = {
          pointerId: e.pointerId,
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY,
          startOffsetX: offsetRef.current.x,
          startOffsetY: offsetRef.current.y,
        }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Update active touch positions
      if (e.pointerType === 'touch') {
        if (activePointersRef.current.has(e.pointerId)) {
          activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        }

        const pinchState = pinchStateRef.current
        const pointers = activePointersRef.current

        if (pinchState.isPinching && pinchState.pointerIds.every((id) => pointers.has(id))) {
          e.preventDefault()
          const p1 = pointers.get(pinchState.pointerIds[0])!
          const p2 = pointers.get(pinchState.pointerIds[1])!
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)

          if (pinchState.initialDistance <= 0) return

          let nextZoom = (pinchState.initialZoom * dist) / pinchState.initialDistance
          nextZoom = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)

          const worldCenter = pinchState.worldCenter
          const nextOffsetX = midX - worldCenter.x * nextZoom
          const nextOffsetY = midY - worldCenter.y * nextZoom
          const clamped = clampOffset({ x: nextOffsetX, y: nextOffsetY }, nextZoom)

          setZoom(nextZoom)
          setOffset(clamped)
          return
        }
      }

      // Handle panning
      const panState = panStateRef.current
      if (panState.isPanning && panState.pointerId === e.pointerId) {
        e.preventDefault()
        const dx = e.clientX - panState.startX
        const dy = e.clientY - panState.startY
        const zoomNow = zoomRef.current
        const candidate = {
          x: panState.startOffsetX + dx,
          y: panState.startOffsetY + dy,
        }

        // Use requestAnimationFrame to batch updates for smoother touch panning
        if (panRafIdRef.current !== null) {
          cancelAnimationFrame(panRafIdRef.current)
        }
        panRafIdRef.current = requestAnimationFrame(() => {
          const clamped = clampOffset(candidate, zoomNow)
          offsetRef.current = clamped
          setOffset(clamped)
          panRafIdRef.current = null
        })
      }
    },
    [clampOffset]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Skip canvas interactions while time popover is open
      if (isTimePopoverOpenRef.current) return

      const isInteractiveTarget = (e.target as HTMLElement).closest('[data-table], [data-ui]')

      // Tap on empty space: clear selection
      if (!isInteractiveTarget) {
        if (e.detail === 2) {
          // Double-tap on empty space: zoom in one step toward tap point
          const clientX = e.clientX
          const clientY = e.clientY
          const currentZoom = zoomRef.current
          let nextZoom = Math.min(currentZoom * 1.3, MAX_ZOOM)
          nextZoom = Math.max(nextZoom, MIN_ZOOM)

          const currentOffset = offsetRef.current
          const worldX = (clientX - currentOffset.x) / currentZoom
          const worldY = (clientY - currentOffset.y) / currentZoom

          const nextOffsetX = clientX - worldX * nextZoom
          const nextOffsetY = clientY - worldY * nextZoom
          const clamped = clampOffset({ x: nextOffsetX, y: nextOffsetY }, nextZoom)

          setZoom(nextZoom)
          setOffset(clamped)
        } else {
          if (onDeselectBooking) {
            onDeselectBooking()
          }
          onSelectTable(null)
        }
      }

      if (e.pointerType === 'touch') {
        activePointersRef.current.delete(e.pointerId)

        // Reset pinch state when fewer than two touches remain
        if (activePointersRef.current.size < 2 && pinchStateRef.current.isPinching) {
          pinchStateRef.current = {
            isPinching: false,
            pointerIds: [],
            initialDistance: 0,
            initialZoom: 1,
            initialOffsetX: 0,
            initialOffsetY: 0,
            initialMidpoint: { x: 0, y: 0 },
            worldCenter: { x: 0, y: 0 },
          }
        }
      }

      const panState = panStateRef.current
      if (panState.pointerId === e.pointerId) {
        panStateRef.current = {
          pointerId: null,
          isPanning: false,
          startX: 0,
          startY: 0,
          startOffsetX: 0,
          startOffsetY: 0,
        }
      }
    },
    [clampOffset, onDeselectBooking, onSelectTable]
  )

  return (
    <div
      ref={canvasRef}
      className={cn(
        'flex-1 relative overflow-hidden bg-muted/30 flex flex-col',
        selectedBookingId && 'cursor-copy'
      )}
      style={{
        touchAction: 'none',
        WebkitUserDrag: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      } as React.CSSProperties}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Sections Row - With time on the right */}
      <div className="px-4 py-2 flex-shrink-0 border-b" data-ui>
        <div className="flex items-center gap-2 h-10 w-full">
          {/* Section Selector - Scrollable text with underline for selected */}
          <div className="flex-1 min-w-0 h-10 relative">
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-hide touch-action-pan-x">
              <div className="flex items-center gap-4 h-10" style={{ width: 'max-content', minWidth: '100%' }}>
                {/* Section items */}
                {sections.map((section) => {
                  const cap = sectionCapacities[section.id]
                  const hasCapacity = cap && cap.max > 0
                  const totalCommitted = cap ? cap.seated + cap.booked : 0
                  const committedPct = hasCapacity ? Math.round((totalCommitted / cap.max) * 100) : null
                  const seatedPct = hasCapacity ? (cap.seated / cap.max) * 100 : 0
                  const bookedPct = hasCapacity ? (cap.booked / cap.max) * 100 : 0
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => onSectionChange(section.id)}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`${section.name} section${committedPct !== null ? `, ${committedPct}% committed (${cap?.seated ?? 0} seated, ${cap?.booked ?? 0} booked)` : ''}`}
                      className={cn(
                        "text-sm font-medium whitespace-nowrap flex-shrink-0 h-10 flex flex-col items-center justify-center px-2 touch-target transition-colors",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className={isActive ? 'underline decoration-2 underline-offset-4' : ''}>{section.name}</span>
                      {/* Segmented micro-bar: solid = seated, lighter = booked */}
                      {committedPct !== null && (
                        <span
                          className={cn(
                            'w-full h-[3px] rounded-full overflow-hidden flex mt-0.5',
                            committedPct < 70 ? 'bg-[hsl(var(--status-available)/.12)]' :
                            committedPct < 90 ? 'bg-[hsl(var(--status-overstay)/.12)]' :
                            'bg-[hsl(var(--status-taken)/.12)]'
                          )}
                        >
                          {seatedPct > 0 && (
                            <span
                              className={cn(
                                'h-full rounded-l-full',
                                committedPct < 70 ? 'bg-[hsl(var(--status-available))]' :
                                committedPct < 90 ? 'bg-[hsl(var(--status-overstay))]' :
                                'bg-[hsl(var(--status-taken))]'
                              )}
                              style={{ width: `${Math.min(seatedPct, 100)}%` }}
                            />
                          )}
                          {bookedPct > 0 && (
                            <span
                              className={cn(
                                'h-full',
                                seatedPct === 0 && 'rounded-l-full',
                                committedPct < 70 ? 'bg-[hsl(var(--status-available)/.45)]' :
                                committedPct < 90 ? 'bg-[hsl(var(--status-overstay)/.45)]' :
                                'bg-[hsl(var(--status-taken)/.45)]'
                              )}
                              style={{ width: `${Math.min(bookedPct, 100 - Math.min(seatedPct, 100))}%` }}
                            />
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          
          {/* Separator line before shift + time selectors */}
          {(selectedTime || (shifts && shifts.length > 0)) && (
            <div className="h-10 w-px bg-border flex-shrink-0" />
          )}

          {/* Shift Selector — compact popover, next to time picker */}
          {onShiftChange && shifts && (
            <ShiftSelector
              shifts={shifts}
              selectedShiftId={selectedShiftId ?? null}
              selectedDate={_selectedDate ?? new Date()}
              onShiftChange={onShiftChange}
            />
          )}

          {/* Time Selector - Right side, styled like date but clickable */}
          {selectedTime && onTimeChange && (() => {
            const { hour12, minutes, ampm } = get12HourTime(selectedTime)
            
            return (
              <Popover open={isTimePopoverOpen} onOpenChange={(open) => { setIsTimePopoverOpen(open); isTimePopoverOpenRef.current = open }}>
                <PopoverTrigger asChild>
                  <button className="flex-shrink-0 h-10 flex items-center gap-1.5 px-2 hover:bg-muted/50 rounded transition-colors cursor-pointer" aria-label={`Selected time: ${String(hour12)}:${String(minutes).padStart(2, '0')} ${ampm}. Click to change.`}>
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                      {String(hour12)}:{String(minutes).padStart(2, '0')} {ampm}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-3 pointer-events-auto z-[60] max-h-[calc(100vh-120px-env(safe-area-inset-bottom,0px))] overflow-y-auto" 
                  align="end"
                  sideOffset={8}
                  avoidCollisions={true}
                  collisionPadding={{ bottom: 20 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                >
                  <div className="space-y-3">
                    {shiftWindow && selectedShift && (
                      <div className="px-1 -mt-1 text-xs text-muted-foreground">
                        Clamped to <span className="font-semibold text-foreground">{selectedShift.name}</span> window
                      </div>
                    )}
                    <p className="text-xs font-medium text-muted-foreground">Hour</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 1
                        // Determine if this hour is disabled by the shift window
                        let hourDisabled = false
                        if (shiftWindow) {
                          const candidate = to24Hour(hour, tempMinutesRef.current, tempAmPmRef.current)
                          const candidateMin = parseTimeToMinutes(candidate)
                          hourDisabled = candidateMin < shiftWindow.start || candidateMin >= shiftWindow.end
                        }
                        return (
                          <button
                            key={hour}
                            type="button"
                            disabled={hourDisabled}
                            onClick={() => {
                              if (hourDisabled) return
                              const newHour = hour
                              setTempHour(newHour)
                              const newTime = to24Hour(newHour, tempMinutesRef.current, tempAmPmRef.current)
                              onTimeChange(newTime)
                            }}
                            className={cn(
                              "h-10 w-10 rounded-md text-sm font-medium transition-colors",
                              tempHour === hour ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                              hourDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                            )}
                            aria-disabled={hourDisabled}
                          >
                            {hour}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Minute</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 15, 30, 45].map((m) => {
                        let minuteDisabled = false
                        if (shiftWindow) {
                          const candidate = to24Hour(tempHourRef.current, m, tempAmPmRef.current)
                          const candidateMin = parseTimeToMinutes(candidate)
                          minuteDisabled = candidateMin < shiftWindow.start || candidateMin >= shiftWindow.end
                        }
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={minuteDisabled}
                            onClick={() => {
                              if (minuteDisabled) return
                              const newMinutes = m
                              setTempMinutes(newMinutes)
                              const newTime = to24Hour(tempHourRef.current, newMinutes, tempAmPmRef.current)
                              onTimeChange(newTime)
                            }}
                            className={cn(
                              "h-10 rounded-md text-sm font-medium transition-colors",
                              tempMinutes === m ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                              minuteDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                            )}
                            aria-disabled={minuteDisabled}
                          >
                            :{String(m).padStart(2, '0')}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">AM/PM</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['AM', 'PM'].map((period) => {
                        let ampmDisabled = false
                        if (shiftWindow) {
                          const candidate = to24Hour(tempHourRef.current, tempMinutesRef.current, period)
                          const candidateMin = parseTimeToMinutes(candidate)
                          ampmDisabled = candidateMin < shiftWindow.start || candidateMin >= shiftWindow.end
                        }
                        return (
                          <button
                            key={period}
                            type="button"
                            disabled={ampmDisabled}
                            onClick={() => {
                              if (ampmDisabled) return
                              const newAmPm = period as 'AM' | 'PM'
                              setTempAmPm(newAmPm)
                              const newTime = to24Hour(tempHourRef.current, tempMinutesRef.current, newAmPm)
                              onTimeChange(newTime)
                            }}
                            className={cn(
                              "h-10 rounded-md text-sm font-medium transition-colors",
                              tempAmPm === period ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                              ampmDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                            )}
                            aria-disabled={ampmDisabled}
                          >
                            {period}
                          </button>
                        )
                      })}
                    </div>
                    {/* Now button — always jumps to the live current time.
                        When a shift is active, the parent's onNow clears the
                        shift filter so the time isn't immediately re-clamped. */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onNow) {
                          onNow()
                        } else {
                          onTimeChange(format(new Date(), 'HH:mm'))
                        }
                        setIsTimePopoverOpen(false)
                      }}
                      className="w-full h-10 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
                    >
                      Now
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )
          })()}
        </div>
      </div>

      {/* Section capacity detail strip — shown for active section */}
      {(() => {
        const activeCap = sectionCapacities[activeSection]
        if (!activeCap) return null

        // Show hint when no capacity is configured for this section
        if (activeCap.max <= 0) {
          return (
            <div className="px-4 py-1.5 flex-shrink-0 border-b bg-muted/20" data-ui>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-muted-foreground/30" />
                <span>No capacity configured — set table capacities in section settings</span>
              </div>
            </div>
          )
        }

        const total = activeCap.seated + activeCap.booked
        const available = Math.max(0, activeCap.max - total)
        const committedPct = Math.round((total / activeCap.max) * 100)
        const colorClass = committedPct < 70
          ? 'bg-[hsl(var(--status-available))]'
          : committedPct < 90
            ? 'bg-[hsl(var(--status-overstay))]'
            : 'bg-[hsl(var(--status-taken))]'
        const lightColorClass = committedPct < 70
          ? 'bg-[hsl(var(--status-available)/.45)]'
          : committedPct < 90
            ? 'bg-[hsl(var(--status-overstay)/.45)]'
            : 'bg-[hsl(var(--status-taken)/.45)]'
        return (
          <div className="px-4 py-1.5 flex-shrink-0 border-b bg-muted/20" data-ui>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colorClass)} />
                <strong className="text-foreground">{activeCap.seated}</strong> seated
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', lightColorClass)} />
                <strong className="text-foreground">{activeCap.booked}</strong> booked
              </span>
              <span className="text-border">|</span>
              <span><strong className="text-foreground">{available}</strong> available</span>
              <span className="text-border">|</span>
              <span>Max: <strong className="text-foreground">{activeCap.max}</strong></span>
            </div>
          </div>
        )
      })()}

      {/* Legend - Expandable */}
      {isLegendExpanded && (
        <div className="px-4 py-2 flex-shrink-0 border-b bg-muted/30" data-ui>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-status-available flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-status-taken flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--status-highlight))] flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Ending Soon</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-status-taken motion-safe:animate-pulse flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Past Expected End</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-status-overstay flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Upcoming / Overstay</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-status-reserved flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Reserved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-status-blocked flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Blocked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive motion-safe:animate-pulse flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Late</span>
            </div>
          </div>
        </div>
      )}

      {/* Canvas container - needs to be relative for absolute positioned content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Empty section message */}
        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center px-6 py-8 rounded-2xl bg-card/80 border shadow-card max-w-xs">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Eye className="w-6 h-6 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm font-semibold text-foreground">No tables in this section</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add tables from the editor or select a different section.
              </p>
            </div>
          </div>
        )}
        {/* Decor toggle */}
        {activeSection !== 'all' && (
          <div className="absolute left-3 bottom-4 z-20" data-ui>
            <button
              type="button"
              onClick={onToggleDecor}
              className="flex items-center gap-1.5 rounded-2xl bg-background/90 backdrop-blur-sm border border-border/60 shadow-lg px-3 py-2 hover:bg-muted active:bg-muted/80 transition-colors"
              aria-label="Toggle decor"
              title={showDecor ? 'Hide decor' : 'Show decor'}
            >
              {showDecor ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="text-xs font-medium">Décor</span>
            </button>
          </div>
        )}

        {/* Side Zoom & Fit controls — positioned above the FAB (fixed bottom-6 right-6 = ~80px) */}
        {tables.length > 0 && (
          <div
            className="absolute right-3 bottom-24 z-20"
            data-ui
          >
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-background/90 backdrop-blur-sm border border-border/60 shadow-lg px-1 py-1.5">
              <button
                type="button"
                onClick={() => zoomByFactor(1.3)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                aria-label="Zoom in"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => autoFit()}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                aria-label="Fit all tables to screen"
                title="Fit all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => zoomByFactor(1 / 1.3)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                aria-label="Zoom out"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-1 text-center">
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        )}
        {/* Transformed content layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x + panOffset.x}px, ${offset.y + panOffset.y}px) scale(${zoom * zoomAdjust})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
        {/* Grid background */}
        <div
          className="absolute opacity-20"
          style={{
            left: contentBounds.minX - 200,
            top: contentBounds.minY - 200,
            width: contentWidth + 400,
            height: contentHeight + 400,
            backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Room contour / walls outline – represent overall room, not just a single table */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: roomBounds.minX,
            top: roomBounds.minY,
            width: roomWidth,
            height: roomHeight,
            borderRadius: 12,
            border: '2px solid rgba(15,23,42,0.35)',
            boxShadow: '0 0 0 1px rgba(148,163,184,0.35)',
            background: 'radial-gradient(circle at top left, rgba(148,163,184,0.06), transparent)',
          }}
        />

        {/* Tables */}
        {tables.map((table) => (
          <FloorplanTable
            key={table.id}
            table={table}
            isSelected={selectedTableId === table.id}
            isHighlighted={highlightedTableIds.includes(table.id)}
            isRecommended={recommendedTableId === table.id}
            isDimmed={!isAssignMode && highlightedTableIds.length > 0 && !highlightedTableIds.includes(table.id)}
            isAssignMode={isAssignMode}
            displayColor={tableDisplayColors[table.id] || 'green'}
            hasUpcomingReservation={tableUpcomingReservations[table.id] || false}
            isLateArrival={tableLateArrivals[table.id] || false}
            guestName={tableGuestNames?.[table.id]}
            shiftPills={selectedShift ? tableShiftPills?.[table.id] : undefined}
            progress={tableProgress?.[table.id] ?? null}
            onSelect={() => onSelectTable(table.id)}
            onDrop={() => onDropBookingOnTable(table.id)}
            onDoubleTap={() => zoomToTable(table)}
          />
        ))}

        {/* Decor Layer */}
        {showDecor && activeSection !== 'all' && sections.map((section) => {
          if (section.id !== activeSection) return null
          const decorItems = section.decor_items as any[] || []
          return decorItems.map((item: any) => {
            const label: string = item.label || getDecorLabel(item.type)
            return (
              <div
                key={item.id}
                className="absolute flex items-center justify-center pointer-events-none"
                style={{
                  left: item.x || 0,
                  top: item.y || 0,
                  width: item.width || 60,
                  height: item.height || 60,
                  borderRadius: item.radius || 8,
                  backgroundColor: getDecorColor(item.type),
                  opacity: 0.8,
                  border: '1px solid rgba(0,0,0,0.16)',
                }}
                title={label}
              >
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase text-foreground bg-card/80 border border-border/60 shadow-sm max-w-full truncate">
                  {label}
                </span>
              </div>
            )
          })
        })}
        </div>
      </div>
    </div>
  )
}
