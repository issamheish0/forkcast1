// app/(dashboard)/floorsections/[id]/edit/page.tsx - Floor Plan Editor
"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Trash2,
  Copy,
  Undo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Loader2,
  Save,
  Leaf,
  Square,
  Circle,
  DoorOpen,
  UtensilsCrossed,
  Wine,
  LogOut,
  Eye,
  ChevronLeft,
  ChevronRight,
  Menu,
  Pencil,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { getSectionMaxCovers } from '@/lib/section-capacity'
import { getConditionSummary } from '@/lib/table-booking-rules'
import { useTableBookingRules, useCreateBookingRule, useUpdateBookingRule, useDeleteBookingRule } from '@/hooks/use-table-booking-rules'
import { RuleFormDialog } from '@/components/floorplan/rule-form-dialog'
import { SectionClosuresManager } from '@/components/basic/section-closures-manager'
import { SectionCombinationsManager } from '@/components/floorplan/section-combinations-manager'
import type { RestaurantTable, RestaurantSection, RestaurantTableCombination, TableBookingRule, TableBookingCondition } from '@/types'

// ── Touch-optimized drag constants and helpers ──
const TOUCH_DRAG_THRESHOLD = 8 // px before confirming drag on touch
const TOUCH_TAP_MAX_DURATION = 200 // ms - taps shorter than this aren't drags

const getEventCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
  if ('touches' in e && e.touches.length > 0) {
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
  } else if ('changedTouches' in e && e.changedTouches.length > 0) {
    return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
  } else if ('clientX' in e) {
    return { clientX: (e as any).clientX, clientY: (e as any).clientY }
  }
  return { clientX: 0, clientY: 0 }
}

const getTouchById = (touches: TouchList, touchId: number): Touch | null => {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === touchId) return touches[i]
  }
  return null
}

type TableShape = 'circle' | 'square' | 'rectangle'
type TableType = 'standard' | 'booth' | 'window' | 'patio' | 'bar' | 'private' | 'shared'

interface EditorTable {
  id: string
  table_number: string
  table_type: TableType
  shape: TableShape
  min_capacity: number
  max_capacity: number
  x_position: number
  y_position: number
  width: number
  height: number
  default_booking_type: 'instant' | 'request'
  is_active: boolean
  isNew?: boolean
  isModified?: boolean
}

interface DecorItem {
  id: string
  type: 'plant' | 'wall' | 'pillar' | 'entrance' | 'host-stand' | 'restroom' | 'window' | 'bar-counter'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  label?: string
}

interface EditorDragState {
  itemId: string | null
  itemType: 'table' | 'decor' | null
  element: HTMLElement | null
  startX: number
  startY: number
  initialLeft: number
  initialTop: number
  animationId: number | null
  touchId: number | null
  isDragConfirmed: boolean
  startTime: number
  resizeHandle: 'se' | 'sw' | 'ne' | 'nw' | null
  initialWidth: number
  initialHeight: number
  aspectRatio: number
}

const INITIAL_DRAG_STATE: EditorDragState = {
  itemId: null,
  itemType: null,
  element: null,
  startX: 0,
  startY: 0,
  initialLeft: 0,
  initialTop: 0,
  animationId: null,
  touchId: null,
  isDragConfirmed: false,
  startTime: 0,
  resizeHandle: null,
  initialWidth: 0,
  initialHeight: 0,
  aspectRatio: 1,
}

const TABLE_SHAPES: { value: TableShape; label: string }[] = [
  { value: 'circle', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'rectangle', label: 'Rectangle' },
]

const TABLE_TYPES: { value: TableType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'booth', label: 'Booth' },
  { value: 'window', label: 'Window' },
  { value: 'patio', label: 'Patio' },
  { value: 'bar', label: 'Bar' },
  { value: 'private', label: 'Private' },
  { value: 'shared', label: 'Shared' },
]

const DECOR_TYPES = [
  { value: 'plant', label: 'Plant' },
  { value: 'wall', label: 'Wall' },
  { value: 'pillar', label: 'Pillar' },
  { value: 'entrance', label: 'Entrance' },
  { value: 'host-stand', label: 'Host Stand' },
  { value: 'restroom', label: 'Restroom' },
  { value: 'window', label: 'Window' },
  { value: 'bar-counter', label: 'Bar Counter' },
]

export default function FloorPlanEditorPage() {
  const router = useRouter()
  const params = useParams()
  const sectionId = params.id as string
  const isNew = sectionId === 'new'
  
  const { currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const canvasRef = useRef<HTMLDivElement>(null)
  const leftSidebarRef = useRef<HTMLDivElement | null>(null)
  const editPanelRef = useRef<HTMLDivElement | null>(null)

  const [restaurantId, setRestaurantId] = useState<string>('')
  const [floorPlanName, setFloorPlanName] = useState('New Floor Plan')
  const [tables, setTables] = useState<EditorTable[]>([])
  const [decor, setDecor] = useState<DecorItem[]>([])
  const [combinations, setCombinations] = useState<RestaurantTableCombination[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'tables' | 'combinations' | 'closures'>('tables')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [undoStack, setUndoStack] = useState<EditorTable[][]>([])
  const [isSaving, setIsSaving] = useState(false)
  
  // Dialogs
  const [showAddTable, setShowAddTable] = useState(false)
  const [showAddDecor, setShowAddDecor] = useState(false)
  const [editingTable, setEditingTable] = useState<EditorTable | null>(null)
  const [editingDecor, setEditingDecor] = useState<DecorItem | null>(null)
  
  // New table form state
  const [newTableNumber, setNewTableNumber] = useState('')
  const [newTableType, setNewTableType] = useState<TableType>('standard')
  const [newTableShape, setNewTableShape] = useState<TableShape>('square')
  const [newTableMinCapacity, setNewTableMinCapacity] = useState(1)
  const [newTableMaxCapacity, setNewTableMaxCapacity] = useState(4)
  const [newTableBookingType, setNewTableBookingType] = useState<'instant' | 'request'>('request')
  
  // New decor form state
  const [selectedDecorType, setSelectedDecorType] = useState<DecorItem['type'] | null>(null)
  const [isPlacingDecor, setIsPlacingDecor] = useState(false)
  
  // Max covers state
  const [maxCoversOverride, setMaxCoversOverride] = useState<number | null>(null)
  const [isAutoCovers, setIsAutoCovers] = useState(true)

  // Booking rules state
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<TableBookingRule | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  // Rename section state
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Responsive UI state
  const [showTableList, setShowTableList] = useState(true)
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true)
  
  // Decor editing state
  const [resizingDecor, setResizingDecor] = useState<{ id: string; initialWidth: number; initialHeight: number } | null>(null)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [lockAspectRatio, setLockAspectRatio] = useState(false)
  const [showDimensions, setShowDimensions] = useState(false)
  
  // Drag state - ref-based to avoid re-renders during drag (direct DOM manipulation)
  const dragStateRef = useRef<EditorDragState>({ ...INITIAL_DRAG_STATE })
  const panStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })

  // Track unsaved changes — warn before navigating away
  const hasUnsavedChanges = useRef(false)
  useEffect(() => {
    // Any table modification marks state as dirty
    if (tables.some(t => t.isNew || t.isModified)) {
      hasUnsavedChanges.current = true
    }
  }, [tables])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Set restaurant ID
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    }
  }, [currentRestaurant])

  // Get the selected table for rules panel
  const selectedTableForRules = selectedIds.length === 1 ? tables.find(t => t.id === selectedIds[0]) : null

  // Ensure UI shows table list/properties on selection
  useEffect(() => {
    if (selectedIds.length === 1) {
      // ensure UI shows table list/properties on selection
      setShowTableList(true)
      setActiveTab('tables')

      // Scroll left sidebar so the edit panel becomes visible (if it's below the fold)
      setTimeout(() => {
        try {
          if (editPanelRef.current) {
            editPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          } else if (leftSidebarRef.current) {
            leftSidebarRef.current.scrollTo({ top: leftSidebarRef.current.scrollHeight, behavior: 'smooth' })
          }
        } catch (err) {
          // ignore
        }
      }, 60)
    }
  }, [selectedIds, tables])

  // Fetch booking rules for selected table (only for existing tables)
  const { data: tableRules = [] } = useTableBookingRules(
    selectedTableForRules && !selectedTableForRules.isNew ? selectedTableForRules.id : undefined
  )
  const createRule = useCreateBookingRule()
  const updateRule = useUpdateBookingRule()
  const deleteRule = useDeleteBookingRule()

  // Computed capacity
  const computedMaxCovers = useMemo(() => {
    return tables.reduce((sum, t) => sum + t.max_capacity, 0)
  }, [tables])

  const effectiveMaxCovers = isAutoCovers ? computedMaxCovers : (maxCoversOverride ?? computedMaxCovers)

  // Fetch all sections for dropdown
  const { data: allSections } = useQuery({
    queryKey: ['all-sections', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_sections')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId
  })

  // Fetch existing section and tables
  const { data: sectionData, isLoading } = useQuery({
    queryKey: ['floor-plan-editor', sectionId],
    queryFn: async () => {
      if (isNew || !restaurantId) return null

      const { data: section, error: sectionError } = await supabase
        .from('restaurant_sections')
        .select('*')
        .eq('id', sectionId)
        .single()

      if (sectionError) throw sectionError

      const { data: sectionTables, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('section_id', sectionId)
        .order('table_number')

      if (tablesError) throw tablesError

      return { section, tables: sectionTables }
    },
    enabled: !isNew && !!restaurantId
  })

  // Load data into state
  useEffect(() => {
    if (sectionData) {
      setFloorPlanName(sectionData.section.name)
      // Load max_covers
      if (sectionData.section.max_covers != null) {
        setMaxCoversOverride(sectionData.section.max_covers)
        setIsAutoCovers(false)
      } else {
        setIsAutoCovers(true)
      }
      setTables(sectionData.tables.map(t => ({
        id: t.id,
        table_number: t.table_number,
        table_type: t.table_type as TableType,
        shape: t.shape as TableShape,
        min_capacity: t.min_capacity,
        max_capacity: t.max_capacity,
        x_position: t.x_position || 100,
        y_position: t.y_position || 100,
        width: t.width || 80,
        height: t.height || 80,
        default_booking_type: (t as any).default_booking_type || 'request',
        is_active: t.is_active !== false,
      })))
      
      // Load decor items
      if (sectionData.section.decor_items && Array.isArray(sectionData.section.decor_items)) {
        setDecor(sectionData.section.decor_items)
      }
    }
  }, [sectionData])

  // Calculate canvas bounds
  const canvasBounds = useMemo(() => {
    if (tables.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const t of tables) {
      minX = Math.min(minX, t.x_position)
      minY = Math.min(minY, t.y_position)
      maxX = Math.max(maxX, t.x_position + t.width)
      maxY = Math.max(maxY, t.y_position + t.height)
    }
    return { minX: minX - 100, minY: minY - 100, maxX: maxX + 100, maxY: maxY + 100 }
  }, [tables])

  // Add table
  const handleAddTable = () => {
    if (!newTableNumber.trim()) {
      toast.error('Please enter a table number')
      return
    }

    // Check for duplicate (case-insensitive to prevent DB conflicts)
    if (tables.some(t => t.table_number.toLowerCase() === newTableNumber.toLowerCase())) {
      toast.error('Table number already exists in this section')
      return
    }

    // Validate min <= max
    if (newTableMinCapacity > newTableMaxCapacity) {
      toast.error('Min capacity cannot be greater than max capacity')
      return
    }

    const newTable: EditorTable = {
      id: `new_${Date.now()}`,
      table_number: newTableNumber,
      table_type: newTableType,
      shape: newTableShape,
      min_capacity: newTableMinCapacity,
      max_capacity: newTableMaxCapacity,
      x_position: 200 + Math.random() * 200,
      y_position: 200 + Math.random() * 200,
      width: newTableShape === 'rectangle' ? 120 : 80,
      height: 80,
      default_booking_type: newTableBookingType,
      is_active: true,
      isNew: true,
    }

    saveUndo()
    setTables(prev => [...prev, newTable])
    setShowAddTable(false)
    setNewTableNumber('')
    setNewTableMinCapacity(1)
    setNewTableMaxCapacity(4)
    toast.success(`Table ${newTableNumber} added`)
  }

  // Delete selected
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return
    saveUndo()
    const tableIds = selectedIds.filter(id => tables.some(t => t.id === id))
    const decorIds = selectedIds.filter(id => decor.some(d => d.id === id))
    
    setTables(prev => prev.filter(t => !tableIds.includes(t.id)))
    setDecor(prev => prev.filter(d => !decorIds.includes(d.id)))
    setSelectedIds([])
    toast.success(`${selectedIds.length} item(s) deleted`)
  }

  // Add decor
  const handleAddDecorType = (type: DecorItem['type']) => {
    setSelectedDecorType(type)
    setIsPlacingDecor(true)
    setShowAddDecor(false)
    toast('Click on canvas to place ' + type)
  }

  // Handle canvas click for decor placement
  const handleCanvasClickForDecor = (e: React.MouseEvent) => {
    if (!isPlacingDecor || !selectedDecorType) return
    e.stopPropagation()
    
    // Use canvasRef for consistent coordinates, not e.target which may be a child element
    const rect = canvasRef.current?.getBoundingClientRect() || (e.target as HTMLElement).getBoundingClientRect()
    const x = (e.clientX - rect.left - offset.x) / zoom
    const y = (e.clientY - rect.top - offset.y) / zoom

    const newDecor: DecorItem = {
      id: `decor_${Date.now()}`,
      type: selectedDecorType,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: 60,
      height: 60,
    }

    saveUndo()
    setDecor(prev => [...prev, newDecor])
    setIsPlacingDecor(false)
    setSelectedDecorType(null)
    toast.success(`${selectedDecorType} added - drag to reposition`)
  }

  // Duplicate selected
  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return
    saveUndo()

    // Compute the highest existing table number to assign unique sequential numbers
    const maxNum = Math.max(
      ...tables.map(t => parseInt(t.table_number) || 0),
      0
    )
    const tablesToDupe = tables.filter(t => selectedIds.includes(t.id))

    // Helper: find a position that doesn't overlap any table in `existing`
    const GAP = 20
    const findFreePos = (
      source: EditorTable,
      existing: EditorTable[]
    ): { x: number; y: number } => {
      const w = source.width
      const h = source.height
      const colStep = w + GAP
      const rowStep = h + GAP
      const overlaps = (cx: number, cy: number) =>
        existing.some(t =>
          cx < t.x_position + t.width + GAP &&
          cx + w + GAP > t.x_position &&
          cy < t.y_position + t.height + GAP &&
          cy + h + GAP > t.y_position
        )
      for (let row = 0; row <= 20; row++) {
        for (let col = row === 0 ? 1 : 0; col <= 20; col++) {
          const cx = source.x_position + col * colStep
          const cy = source.y_position + row * rowStep
          if (cx > 0 && cy > 0 && !overlaps(cx, cy)) return { x: cx, y: cy }
        }
      }
      return { x: source.x_position + colStep, y: source.y_position + rowStep }
    }

    // Build duplicates one by one, adding each to the pool so they don't stack on each other either
    const pool: EditorTable[] = [...tables]
    const duplicates: EditorTable[] = []
    tablesToDupe.forEach((t, i) => {
      const { x, y } = findFreePos(t, pool)
      const dup: EditorTable = {
        ...t,
        id: `new_${Date.now()}_${i}`,
        table_number: String(maxNum + 1 + i),
        x_position: x,
        y_position: y,
        isNew: true,
      }
      pool.push(dup)
      duplicates.push(dup)
    })

    setTables(prev => [...prev, ...duplicates])
    setSelectedIds(duplicates.map(d => d.id))
    toast.success(`${duplicates.length === 1 ? `Table duplicated as T${duplicates[0].table_number}` : `${duplicates.length} tables duplicated`}`)
  }

  // Undo
  const saveUndo = () => {
    setUndoStack(prev => [...prev.slice(-9), [...tables]])
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const previousState = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setTables(previousState)
    toast.success('Undone')
  }

  // Snap to grid helper
  const snapToGridValue = (value: number, gridSize: number = 8) => {
    return snapToGrid ? Math.round(value / gridSize) * gridSize : value
  }

  // Update decor with synced editing state
  const updateDecor = (decorId: string, updates: Partial<DecorItem>) => {
    setDecor(prev => prev.map(d => d.id === decorId ? { ...d, ...updates } : d))
    if (editingDecor?.id === decorId) {
      setEditingDecor(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  // Zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 2.5))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.3))
  const handleZoomReset = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  // Table selection
  const handleTableClick = (tableId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      // Multi-select
      setSelectedIds(prev =>
        prev.includes(tableId)
          ? prev.filter(id => id !== tableId)
          : [...prev, tableId]
      )
    } else {
      setSelectedIds([tableId])
      setShowTableList(true)
      setShowPropertiesPanel(true)
    }
  }

  // Decor selection
  const handleDecorClick = (decorId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      setSelectedIds(prev => 
        prev.includes(decorId) 
          ? prev.filter(id => id !== decorId)
          : [...prev, decorId]
      )
    } else {
      setSelectedIds([decorId])
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPlacingDecor) {
      handleCanvasClickForDecor(e)
      return
    }
    setSelectedIds([])
  }

  // ── Touch-optimized drag system ──
  // Uses direct DOM manipulation during drag for 60fps performance,
  // only syncing back to React state on drag end.

  const handleItemDragStart = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    itemId: string,
    itemType: 'table' | 'decor'
  ) => {
    // Don't start drag from resize handles
    const target = e.target as HTMLElement
    if (target.hasAttribute('data-resize-handle') || target.closest('[data-resize-handle]')) return

    e.stopPropagation()
    const element = e.currentTarget as HTMLElement
    const coords = getEventCoordinates(e as any)

    let touchId: number | null = null
    let isTouch = false
    if ('touches' in e && e.touches.length > 0) {
      touchId = e.touches[0].identifier
      isTouch = true
    } else {
      (e as React.MouseEvent).preventDefault()
    }

    // Get initial position from current state
    let initialLeft = 0, initialTop = 0
    if (itemType === 'table') {
      const table = tables.find(t => t.id === itemId)
      if (!table) return
      initialLeft = table.x_position
      initialTop = table.y_position
    } else {
      const decorItem = decor.find(d => d.id === itemId)
      if (!decorItem) return
      initialLeft = decorItem.x
      initialTop = decorItem.y
    }

    dragStateRef.current = {
      itemId,
      itemType,
      element,
      startX: coords.clientX,
      startY: coords.clientY,
      initialLeft,
      initialTop,
      animationId: null,
      touchId,
      isDragConfirmed: !isTouch, // Mouse drags confirmed immediately
      startTime: Date.now(),
      resizeHandle: null,
      initialWidth: 0,
      initialHeight: 0,
      aspectRatio: 1,
    }

    // GPU acceleration hints for smooth dragging
    element.style.willChange = 'left, top'
    element.style.zIndex = '100'
    element.style.transition = 'none'
    element.style.touchAction = 'none'

    // Haptic feedback on touch devices
    if (isTouch && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }, [tables, decor])

  // Resize start — works for both tables and decor
  const handleResizeStart = useCallback((
    itemId: string,
    itemType: 'table' | 'decor',
    handle: 'se' | 'sw' | 'ne' | 'nw',
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.stopPropagation()

    let initialLeft = 0, initialTop = 0, w = 60, h = 60

    if (itemType === 'table') {
      const table = tables.find(t => t.id === itemId)
      if (!table) return
      initialLeft = table.x_position
      initialTop = table.y_position
      w = table.width || 80
      h = table.height || 80
    } else {
      const decorItem = decor.find(d => d.id === itemId)
      if (!decorItem) return
      initialLeft = decorItem.x
      initialTop = decorItem.y
      w = decorItem.width || 60
      h = decorItem.height || 60
    }

    const selector = itemType === 'table' ? '[data-table]' : '[data-decor]'
    const parentElement = (e.currentTarget as HTMLElement).closest(selector) as HTMLElement
    if (!parentElement) return

    const coords = getEventCoordinates(e as any)
    let touchId: number | null = null
    let isTouch = false

    if ('touches' in e && e.touches.length > 0) {
      touchId = e.touches[0].identifier
      isTouch = true
    } else {
      (e as React.MouseEvent).preventDefault()
    }

    dragStateRef.current = {
      itemId,
      itemType,
      element: parentElement,
      startX: coords.clientX,
      startY: coords.clientY,
      initialLeft,
      initialTop,
      animationId: null,
      touchId,
      isDragConfirmed: true, // Resize always confirmed immediately
      startTime: Date.now(),
      resizeHandle: handle,
      initialWidth: w,
      initialHeight: h,
      aspectRatio: w / h,
    }

    parentElement.style.willChange = 'left, top, width, height'
    parentElement.style.zIndex = '100'
    parentElement.style.transition = 'none'
    parentElement.style.touchAction = 'none'

    setResizingDecor({ id: itemId, initialWidth: w, initialHeight: h })

    // Stronger haptic for resize
    if (isTouch && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
  }, [tables, decor])

  // Document-level move handler — direct DOM manipulation + RAF for 60fps
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    const state = dragStateRef.current
    if (!state.itemId || !state.element) return

    // Validate touch identity (prevents multi-touch interference)
    if ('touches' in e && state.touchId !== null) {
      const touch = getTouchById(e.touches, state.touchId)
      if (!touch) return
    }

    const coords = getEventCoordinates(e)
    const rawDeltaX = coords.clientX - state.startX
    const rawDeltaY = coords.clientY - state.startY

    // Touch drag threshold — prevents accidental drags on taps
    if (!state.isDragConfirmed) {
      const distance = Math.sqrt(rawDeltaX * rawDeltaX + rawDeltaY * rawDeltaY)
      if (distance > TOUCH_DRAG_THRESHOLD || (Date.now() - state.startTime) > TOUCH_TAP_MAX_DURATION) {
        state.isDragConfirmed = true
      } else {
        return // Allow natural scrolling/tap behavior
      }
    }

    e.preventDefault()

    // Cancel previous frame to avoid stacking
    if (state.animationId) cancelAnimationFrame(state.animationId)

    state.animationId = requestAnimationFrame(() => {
      if (!state.element) return

      const deltaX = rawDeltaX / zoom
      const deltaY = rawDeltaY / zoom

      if (state.resizeHandle) {
        // ── Resize logic ──
        const minSize = state.itemType === 'table' ? 40 : 20
        let newWidth = state.initialWidth
        let newHeight = state.initialHeight
        let newX = state.initialLeft
        let newY = state.initialTop

        const handle = state.resizeHandle
        if (handle === 'se') {
          newWidth = Math.max(minSize, state.initialWidth + deltaX)
          newHeight = Math.max(minSize, state.initialHeight + deltaY)
        } else if (handle === 'sw') {
          newWidth = Math.max(minSize, state.initialWidth - deltaX)
          newHeight = Math.max(minSize, state.initialHeight + deltaY)
          newX = state.initialLeft + (state.initialWidth - newWidth)
        } else if (handle === 'ne') {
          newWidth = Math.max(minSize, state.initialWidth + deltaX)
          newHeight = Math.max(minSize, state.initialHeight - deltaY)
          newY = state.initialTop + (state.initialHeight - newHeight)
        } else if (handle === 'nw') {
          newWidth = Math.max(minSize, state.initialWidth - deltaX)
          newHeight = Math.max(minSize, state.initialHeight - deltaY)
          newX = state.initialLeft + (state.initialWidth - newWidth)
          newY = state.initialTop + (state.initialHeight - newHeight)
        }

        if (lockAspectRatio) {
          const currentAspect = newWidth / newHeight
          if (currentAspect > state.aspectRatio) {
            newWidth = newHeight * state.aspectRatio
          } else {
            newHeight = newWidth / state.aspectRatio
          }
        }

        if (snapToGrid) {
          newWidth = snapToGridValue(newWidth)
          newHeight = snapToGridValue(newHeight)
          newX = snapToGridValue(newX)
          newY = snapToGridValue(newY)
        }

        // Direct DOM update — no React re-render
        state.element.style.left = `${Math.max(0, newX)}px`
        state.element.style.top = `${Math.max(0, newY)}px`
        state.element.style.width = `${newWidth}px`
        state.element.style.height = `${newHeight}px`

        // Update dimension label if visible
        const dimLabel = state.element.querySelector('[data-dim-label]') as HTMLElement
        if (dimLabel) {
          dimLabel.textContent = `${Math.round(newWidth)} × ${Math.round(newHeight)}`
          dimLabel.style.display = 'block'
        }
      } else {
        // ── Move logic ──
        const newLeft = Math.max(0, state.initialLeft + deltaX)
        const newTop = Math.max(0, state.initialTop + deltaY)

        // Direct DOM update — no React re-render
        state.element.style.left = `${newLeft}px`
        state.element.style.top = `${newTop}px`
      }
    })
  }, [zoom, snapToGrid, lockAspectRatio, snapToGridValue])

  // Document-level end handler — syncs DOM positions back to React state
  const handleDragEnd = useCallback((_e: MouseEvent | TouchEvent) => {
    const state = dragStateRef.current
    if (!state.itemId || !state.element) {
      dragStateRef.current = { ...INITIAL_DRAG_STATE }
      return
    }

    // Cancel pending animation frame
    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
    }

    // Only sync to state if drag was actually confirmed (not a tap)
    if (state.isDragConfirmed) {
      const finalLeft = parseFloat(state.element.style.left) || 0
      const finalTop = parseFloat(state.element.style.top) || 0

      saveUndo()

      if (state.resizeHandle) {
        const finalWidth = parseFloat(state.element.style.width) || 60
        const finalHeight = parseFloat(state.element.style.height) || 60

        if (state.itemType === 'table') {
          setTables(prev => prev.map(t =>
            t.id === state.itemId
              ? { ...t, x_position: finalLeft, y_position: finalTop, width: finalWidth, height: finalHeight, isModified: true }
              : t
          ))
          // Update editing table if open
          setEditingTable(prev =>
            prev?.id === state.itemId
              ? { ...prev, x_position: finalLeft, y_position: finalTop, width: finalWidth, height: finalHeight }
              : prev
          )
        } else {
          setDecor(prev => prev.map(d =>
            d.id === state.itemId
              ? { ...d, x: finalLeft, y: finalTop, width: finalWidth, height: finalHeight }
              : d
          ))
          setEditingDecor(prev =>
            prev?.id === state.itemId
              ? { ...prev, x: finalLeft, y: finalTop, width: finalWidth, height: finalHeight }
              : prev
          )
        }
      } else if (state.itemType === 'table') {
        setTables(prev => prev.map(t =>
          t.id === state.itemId
            ? { ...t, x_position: finalLeft, y_position: finalTop, isModified: true }
            : t
        ))
      } else if (state.itemType === 'decor') {
        setDecor(prev => prev.map(d =>
          d.id === state.itemId
            ? { ...d, x: finalLeft, y: finalTop }
            : d
        ))
      }
    }

    // Reset element styles
    state.element.style.willChange = ''
    state.element.style.zIndex = ''
    state.element.style.transition = ''
    state.element.style.touchAction = ''

    dragStateRef.current = { ...INITIAL_DRAG_STATE }
    setResizingDecor(null)
  }, [saveUndo])

  // Global move/end handler that covers both dragging and panning
  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (dragStateRef.current.itemId) {
      handleDragMove(e)
      return
    }
    // Panning
    if (isPanning) {
      const coords = getEventCoordinates(e)
      const dx = coords.clientX - panStart.current.x
      const dy = coords.clientY - panStart.current.y
      setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy })
    }
  }, [isPanning, handleDragMove])

  const handleGlobalEnd = useCallback((e: MouseEvent | TouchEvent) => {
    if (dragStateRef.current.itemId) {
      handleDragEnd(e)
    }
    setIsPanning(false)
  }, [handleDragEnd])

  // Register document-level listeners with { passive: false } for touch
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => handleGlobalMove(e)
    const onMouseMove = (e: MouseEvent) => handleGlobalMove(e)

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('mouseup', handleGlobalEnd)
    document.addEventListener('touchend', handleGlobalEnd)
    document.addEventListener('touchcancel', handleGlobalEnd)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('mouseup', handleGlobalEnd)
      document.removeEventListener('touchend', handleGlobalEnd)
      document.removeEventListener('touchcancel', handleGlobalEnd)
      // Cancel any pending RAF to prevent stale updates on unmount
      if (dragStateRef.current.animationId) {
        cancelAnimationFrame(dragStateRef.current.animationId)
      }
    }
  }, [handleGlobalMove, handleGlobalEnd])

  // Keyboard shortcuts: Ctrl+Z (undo), Delete/Backspace (delete selected), Ctrl+D (duplicate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          handleDuplicateSelected()
        }
      } else if (e.key === 'Escape') {
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, handleUndo, handleDeleteSelected, handleDuplicateSelected])

  // Canvas panning start
  const handleCanvasPanStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-table]') || (e.target as HTMLElement).closest('[data-decor]')) return
    const coords = getEventCoordinates(e as any)
    setIsPanning(true)
    panStart.current = { x: coords.clientX, y: coords.clientY }
    offsetStart.current = { ...offset }
  }

  // Save floor plan
  const handleRenameSection = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed) { toast.error('Name cannot be empty'); return }
    setIsRenaming(true)
    try {
      if (!isNew) {
        const { error } = await supabase
          .from('restaurant_sections')
          .update({ name: trimmed })
          .eq('id', sectionId)
        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ['all-sections', restaurantId] })
        queryClient.invalidateQueries({ queryKey: ['floor-plan-editor', sectionId] })
      }
      setFloorPlanName(trimmed)
      setShowRenameDialog(false)
      toast.success('Section renamed')
    } catch (e) {
      toast.error('Failed to rename section')
      console.error(e)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleSave = async () => {    if (!floorPlanName.trim()) {
      toast.error('Please enter a floor plan name')
      return
    }

    setIsSaving(true)
    try {
      let currentSectionId = sectionId

      if (isNew) {
        // Create new section
        const { data: newSection, error: sectionError } = await supabase
          .from('restaurant_sections')
          .insert({
            restaurant_id: restaurantId,
            name: floorPlanName,
            display_order: 1,
            is_active: true,
            color: '#22c55e',
            icon: 'grid',
            decor_items: decor,
            max_covers: isAutoCovers ? null : (maxCoversOverride ?? null),
          })
          .select()
          .single()

        if (sectionError) throw sectionError
        currentSectionId = newSection.id
      } else {
        // Update section name, decor, and max covers
        const { error: updateError } = await supabase
          .from('restaurant_sections')
          .update({
            name: floorPlanName,
            decor_items: decor,
            max_covers: isAutoCovers ? null : (maxCoversOverride ?? null),
          })
          .eq('id', sectionId)

        if (updateError) throw updateError
      }

      // Handle tables
      const existingTables = tables.filter(t => !t.isNew)
      const newTables = tables.filter(t => t.isNew)

      // Update existing tables
      for (const table of existingTables) {
        const { error: tableUpdateError } = await supabase
          .from('restaurant_tables')
          .update({
            table_number: table.table_number,
            table_type: table.table_type,
            shape: table.shape,
            capacity: table.max_capacity,
            min_capacity: table.min_capacity,
            max_capacity: table.max_capacity,
            x_position: Math.round(table.x_position),
            y_position: Math.round(table.y_position),
            width: table.width,
            height: table.height,
            default_booking_type: table.default_booking_type,
            is_active: table.is_active,
          })
          .eq('id', table.id)

        if (tableUpdateError) {
          console.error('Failed updating table', table.id, tableUpdateError)
          throw tableUpdateError
        }
      }

      // Create new tables
      if (newTables.length > 0) {
        const tablesToInsert = newTables.map(t => ({
          restaurant_id: restaurantId,
          section_id: currentSectionId,
          table_number: t.table_number,
          table_type: t.table_type,
          shape: t.shape,
          min_capacity: t.min_capacity,
          max_capacity: t.max_capacity,
          x_position: Math.round(t.x_position),
          y_position: Math.round(t.y_position),
          width: t.width,
          height: t.height,
          is_active: true,
          is_combinable: false,
          combinable_with: [],
          priority_score: 0,
          default_booking_type: t.default_booking_type,
        }))

        const { error: insertError } = await supabase
          .from('restaurant_tables')
          .insert(tablesToInsert)

        if (insertError) throw insertError
      }

      // Find deleted tables (tables in DB but not in current state)
      if (!isNew && sectionData?.tables) {
        const currentIds = tables.map(t => t.id)
        const deletedIds = sectionData.tables
          .map(t => t.id)
          .filter(id => !currentIds.includes(id))

        if (deletedIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('restaurant_tables')
            .delete()
            .in('id', deletedIds)

          if (deleteError) {
            console.error('Failed deleting tables', deletedIds, deleteError)
            throw deleteError
          }
        }
      }

      // Invalidate all related caches so every page shows fresh data
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      queryClient.invalidateQueries({ queryKey: ['floorplan-sections'] })
      queryClient.invalidateQueries({ queryKey: ['floorplan-tables'] })
      queryClient.invalidateQueries({ queryKey: ['restaurant-sections-active'] })
      // Remove editor cache entirely so re-entering shows fresh data (not stale sizes)
      queryClient.removeQueries({ queryKey: ['floor-plan-editor', sectionId] })
      hasUnsavedChanges.current = false
      toast.success('Floor plan saved successfully')
      router.push('/floorsections')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save floor plan')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges.current) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) return
    }
    router.push('/floorsections')
  }

  // Get table dimensions based on shape
  const getTableStyle = (table: EditorTable) => {
    const baseStyle = {
      left: table.x_position,
      top: table.y_position,
      width: table.width,
      height: table.height,
    }

    switch (table.shape) {
      case 'circle':
        return { ...baseStyle, borderRadius: '50%' }
      case 'rectangle':
        return { ...baseStyle, borderRadius: '14px', width: table.width || 140 }
      default:
        return { ...baseStyle, borderRadius: '14px' }
    }
  }

  // Get decor icon based on type
  const getDecorIcon = (type: DecorItem['type']) => {
    const iconProps = { className: 'w-6 h-6 text-amber-700' }
    switch (type) {
      case 'plant':
        return <Leaf {...iconProps} />
      case 'wall':
        return <Square {...iconProps} />
      case 'pillar':
        return <Circle {...iconProps} />
      case 'entrance':
        return <DoorOpen {...iconProps} />
      case 'host-stand':
        return <UtensilsCrossed {...iconProps} />
      case 'restroom':
        return <LogOut {...iconProps} />
      case 'window':
        return <Eye {...iconProps} />
      case 'bar-counter':
        return <Wine {...iconProps} />
      default:
        return <Square {...iconProps} />
    }
  }

  // Get realistic styling for decor types
  const getDecorStyle = (item: DecorItem) => {
    const baseClasses = 'absolute flex items-center justify-center cursor-move transition-all'
    const selectedClasses = selectedIds.includes(item.id) ? 'ring-2 ring-primary ring-offset-2' : ''
    
    const typeStyles: Record<DecorItem['type'], string> = {
      'plant': 'bg-green-100 border-2 border-green-400 hover:shadow-md',
      'wall': 'bg-gray-300 border border-gray-500 hover:shadow-lg',
      'pillar': 'bg-yellow-900 border-2 border-yellow-950 hover:shadow-lg rounded-full',
      'entrance': 'bg-red-100 border-2 border-red-400 hover:shadow-md',
      'host-stand': 'bg-amber-200 border-2 border-amber-600 hover:shadow-lg',
      'restroom': 'bg-blue-100 border-2 border-blue-400 hover:shadow-md',
      'window': 'bg-cyan-200 border-2 border-cyan-500 hover:shadow-md',
      'bar-counter': 'bg-orange-200 border-2 border-orange-600 hover:shadow-lg',
    }

    return cn(baseClasses, typeStyles[item.type], selectedClasses)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top Toolbar - Match Hostess Hub design */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-card">
        <Button 
          size="xs"
          onClick={() => setShowAddTable(true)} 
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus />
          Add Table
        </Button>
        
        <Button 
          size="xs"
          variant="outline" 
          onClick={() => setShowAddDecor(true)}
          className="bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <Plus />
          Add Decor
        </Button>
        
        <Button 
          size="xs"
          variant="outline"
          disabled={selectedIds.length === 0}
          onClick={handleDuplicateSelected}
          className="text-muted-foreground"
        >
          <Copy />
          Duplicate
        </Button>

        <Button 
          size="xs"
          variant="outline"
          disabled={selectedIds.length === 0}
          onClick={handleDeleteSelected}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
          Delete
        </Button>
        
        <div className="flex-1 flex justify-center min-w-0 px-1">
          <div className="flex items-center gap-1">
            <Select value={sectionId} onValueChange={(v) => {
              if (hasUnsavedChanges.current) {
                if (!window.confirm('You have unsaved changes. Are you sure you want to switch sections?')) return
              }
              router.push(`/floorsections/${v}/edit`)
            }}>
              <SelectTrigger className="w-[160px] h-6 text-xs">
                <SelectValue>{floorPlanName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allSections?.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="xs"
              variant="outline"
              className="w-6 px-0 text-muted-foreground hover:text-foreground"
              title="Rename section"
              onClick={() => { setRenameValue(floorPlanName); setShowRenameDialog(true) }}
            >
              <Pencil />
            </Button>
          </div>
        </div>
        
        <Button 
          size="xs"
          variant="ghost" 
          onClick={handleUndo} 
          disabled={undoStack.length === 0}
          className="w-6 px-0 text-muted-foreground"
        >
          <Undo />
        </Button>
      </div>

      <div className="flex-1 flex min-h-0 gap-0">
        {/* Left Sidebar - collapsible on all screens */}
        <div ref={leftSidebarRef} className={cn(
          "flex flex-col border-r bg-card transition-all duration-200 min-h-0 overflow-hidden flex-shrink-0",
          showTableList ? "w-56" : "w-8",
          "max-[700px]:absolute max-[700px]:h-full max-[700px]:z-40",
          !showTableList && "max-[700px]:w-0"
        )}>
          {/* Toggle strip — always visible when collapsed */}
          {!showTableList && (
            <button
              type="button"
              className="flex items-center justify-center h-full w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setShowTableList(true)}
              title="Open panel"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Full panel content */}
          {showTableList && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {selectedTableForRules ? (
            /* ── Edit Table Panel ── full sidebar height when a table is selected */
            <div ref={editPanelRef} className="flex flex-col flex-1 min-h-0">
              <div className="px-2.5 pt-2 pb-1.5 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                    onClick={() => setSelectedIds([])}
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Back
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
                    onClick={() => setShowTableList(false)}
                    title="Collapse panel"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h2 className="text-xs font-semibold mt-0.5">Edit Table {selectedTableForRules.table_number}</h2>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-2.5 py-2 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Table ID</Label>
                    <Input
                      value={selectedTableForRules.table_number}
                      onChange={(e) => {
                        const value = e.target.value
                        setTables(prev =>
                          prev.map(t =>
                            t.id === selectedTableForRules.id
                              ? { ...t, table_number: value, isModified: true }
                              : t
                          )
                        )
                      }}
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Table Type</Label>
                    <Select
                      value={selectedTableForRules.table_type}
                      onValueChange={(v) => {
                        const value = v as TableType
                        setTables(prev =>
                          prev.map(t =>
                            t.id === selectedTableForRules.id
                              ? { ...t, table_type: value, isModified: true }
                              : t
                          )
                        )
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Min</Label>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 p-0"
                          onClick={() => {
                            const next = Math.max(1, selectedTableForRules.min_capacity - 1)
                            setTables(prev =>
                              prev.map(t =>
                                t.id === selectedTableForRules.id
                                  ? { ...t, min_capacity: next, isModified: true }
                                  : t
                              )
                            )
                          }}
                        >
                          <span className="text-[10px]">-</span>
                        </Button>
                        <span className="flex-1 text-center text-xs font-semibold">
                          {selectedTableForRules.min_capacity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 p-0"
                          onClick={() => {
                            const next = Math.min(selectedTableForRules.max_capacity, selectedTableForRules.min_capacity + 1)
                            setTables(prev =>
                              prev.map(t =>
                                t.id === selectedTableForRules.id
                                  ? { ...t, min_capacity: next, isModified: true }
                                  : t
                              )
                            )
                          }}
                        >
                          <span className="text-[10px]">+</span>
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Max</Label>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 p-0"
                          onClick={() => {
                            const next = Math.max(selectedTableForRules.min_capacity, selectedTableForRules.max_capacity - 1)
                            setTables(prev =>
                              prev.map(t =>
                                t.id === selectedTableForRules.id
                                  ? { ...t, max_capacity: next, isModified: true }
                                  : t
                              )
                            )
                          }}
                        >
                          <span className="text-[10px]">-</span>
                        </Button>
                        <span className="flex-1 text-center text-xs font-semibold">
                          {selectedTableForRules.max_capacity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 p-0"
                          onClick={() => {
                            const next = selectedTableForRules.max_capacity + 1
                            setTables(prev =>
                              prev.map(t =>
                                t.id === selectedTableForRules.id
                                  ? { ...t, max_capacity: next, isModified: true }
                                  : t
                              )
                            )
                          }}
                        >
                          <span className="text-[10px]">+</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Shape</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {TABLE_SHAPES.map(shape => (
                        <Button
                          key={shape.value}
                          type="button"
                          variant={selectedTableForRules.shape === shape.value ? 'default' : 'outline'}
                          className="h-7 px-1 flex items-center justify-center gap-0.5 text-[10px]"
                          onClick={() => {
                            setTables(prev =>
                              prev.map(t =>
                                t.id === selectedTableForRules.id
                                  ? { ...t, shape: shape.value, isModified: true }
                                  : t
                              )
                            )
                          }}
                        >
                          {shape.value === 'circle' && <Circle className="h-3 w-3" />}
                          {shape.value === 'square' && <Square className="h-3 w-3" />}
                          {shape.value === 'rectangle' && <Square className="h-3 w-4" />}
                          <span>{shape.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t">
                    <Label className="text-[11px]">Booking Type</Label>
                    <Select
                      value={selectedTableForRules.default_booking_type}
                      onValueChange={(v) => {
                        const val = v as 'instant' | 'request'
                        setTables(prev => prev.map(t =>
                          t.id === selectedTableForRules.id
                            ? { ...t, default_booking_type: val, isModified: true }
                            : t
                        ))
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="request">Request</SelectItem>
                        <SelectItem value="instant">Instant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Booking Rules Panel */}
                  {!selectedTableForRules.isNew && (
                    <div className="pt-1.5 border-t">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold">Booking Rules</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1 text-[10px]"
                          onClick={() => { setEditingRule(null); setShowRuleDialog(true) }}
                        >
                          <Plus className="h-2.5 w-2.5 mr-0.5" />
                          Add
                        </Button>
                      </div>
                      {tableRules.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground py-0.5">
                          No rules — uses default ({selectedTableForRules?.default_booking_type})
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {tableRules.map(rule => (
                            <div
                              key={rule.id}
                              className="flex items-center gap-1 p-1 rounded border hover:bg-muted/50 transition-colors"
                            >
                              <button
                                className="flex-1 text-left min-w-0"
                                onClick={() => { setEditingRule(rule); setShowRuleDialog(true) }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-medium truncate">{rule.name}</span>
                                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 flex-shrink-0">
                                    {rule.booking_type}
                                  </Badge>
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5 truncate">
                                  P{rule.priority} · {rule.conditions.length === 0
                                    ? 'All bookings'
                                    : rule.conditions.map(c => getConditionSummary(c)).join(' & ')}
                                </div>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeletingRuleId(rule.id) }}
                                className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Delete rule"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active toggle */}
                  <div className="flex items-center justify-between pt-1.5 border-t">
                    <Label className="text-[11px]">Table Active</Label>
                    <Switch
                      checked={selectedTableForRules.is_active}
                      onCheckedChange={(checked) => {
                        setTables(prev => prev.map(t =>
                          t.id === selectedTableForRules.id
                            ? { ...t, is_active: checked, isModified: true }
                            : t
                        ))
                      }}
                    />
                  </div>

                  {/* Duplicate + Delete table buttons */}
                  <div className="pt-1.5 border-t space-y-1">
                    <Button
                      variant="outline"
                      size="xs"
                      className="w-full border-purple-400 text-purple-600 hover:bg-purple-50"
                      onClick={handleDuplicateSelected}
                    >
                      <Copy />
                      Duplicate Table
                    </Button>
                    <Button
                      variant="destructive"
                      size="xs"
                      className="w-full"
                      onClick={() => {
                        handleDeleteSelected()
                      }}
                    >
                      <Trash2 />
                      Delete Table
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Table List View ── shown when no table is selected */
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tables' | 'combinations' | 'closures')} className="flex-1 flex flex-col min-h-0">
              {/* Tab bar row with collapse button */}
              <div className="mx-2 mt-2 flex-shrink-0 flex items-center gap-1">
                <div className="flex-1 overflow-x-auto scrollbar-hide rounded-lg bg-muted/50 p-0.5 flex gap-0.5">
                {(['tables', 'combinations', 'closures'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-shrink-0 whitespace-nowrap text-[11px] font-medium px-2 py-1 rounded transition-all capitalize",
                      activeTab === tab
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => setShowTableList(false)}
                  title="Collapse panel"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Capacity Settings */}
              <div className="mx-2 mt-2 p-2 border rounded-lg bg-muted/30 space-y-1.5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Max Covers</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAutoCovers
                      setIsAutoCovers(next)
                      if (next) setMaxCoversOverride(null)
                      else setMaxCoversOverride(computedMaxCovers)
                    }}
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors leading-none",
                      isAutoCovers
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-transparent text-muted-foreground border-border"
                    )}
                  >
                    Auto
                  </button>
                </div>
                {isAutoCovers ? (
                  <div className="text-sm font-semibold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {computedMaxCovers} covers
                  </div>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    value={maxCoversOverride ?? 0}
                    onChange={(e) => setMaxCoversOverride(parseInt(e.target.value) || 0)}
                    className="h-7 text-sm"
                  />
                )}
              </div>

              <TabsContent value="tables" className="flex-1 mt-0 px-2 min-h-0">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
                  <span className="w-3"></span>
                  <span>TABLE</span>
                  <span>TYPE</span>
                  <span>SEATS</span>
                </div>
                <ScrollArea className="h-[calc(100vh-290px)]">
                  {tables.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Add table
                    </p>
                  ) : (
                    <div className="space-y-0 py-1">
                      {tables.map((table) => {
                        const isSelected = selectedIds.includes(table.id)
                        const seatRange = table.min_capacity === table.max_capacity
                          ? `${table.max_capacity}`
                          : `${table.min_capacity}-${table.max_capacity}`
                        return (
                          <button
                            key={table.id}
                            onClick={(e) => handleTableClick(table.id, e)}
                            className={cn(
                              'w-full grid grid-cols-[auto_1fr_1fr_1fr] gap-2 py-2 px-2 rounded text-xs cursor-pointer transition-colors items-center',
                              isSelected
                                ? 'bg-primary/10'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              isSelected ? 'bg-primary' : 'bg-muted-foreground/30'
                            )} />
                            <span className="font-medium truncate text-left">{table.table_number}</span>
                            <span className="text-muted-foreground truncate capitalize">{table.table_type}</span>
                            <span className="text-muted-foreground">{seatRange}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="combinations" className="flex-1 mt-0 px-2 min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-290px)]">
                  {!isNew && restaurantId ? (
                    <SectionCombinationsManager
                      restaurantId={restaurantId}
                      tables={tables.map(t => ({
                        id: t.id,
                        table_number: t.table_number,
                        max_capacity: t.max_capacity,
                        isNew: t.isNew,
                      }))}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Save the section first to manage table combinations.
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="closures" className="flex-1 mt-0 px-2 min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-290px)]">
                  {!isNew && restaurantId ? (
                    <SectionClosuresManager
                      restaurantId={restaurantId}
                      compact
                      sections={allSections?.map(s => ({
                        ...s,
                        restaurant_id: restaurantId,
                        display_order: 0,
                        is_active: true,
                        created_at: '',
                        updated_at: '',
                      })) as any[] || []}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Save the floor plan first to manage closures.
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
            </div>
          )}
        </div>

        {/* Canvas */}
          <div 
            ref={canvasRef}
            className={cn(
              'flex-1 relative overflow-hidden bg-muted/20',
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            )}
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`,
          }}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasPanStart}
          onTouchStart={handleCanvasPanStart}
        >
          {/* Tables Layer */}
          <div
            className="absolute"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {tables.map((table) => {
              const isSelected = selectedIds.includes(table.id)
              const seatRange = table.min_capacity === table.max_capacity 
                ? `${table.max_capacity}` 
                : `${table.min_capacity}-${table.max_capacity}`
              return (
                <div
                  key={table.id}
                  data-table
                  className={cn(
                    'absolute flex flex-col items-center justify-center cursor-move rounded-xl p-3',
                    isSelected
                      ? 'bg-orange-500 text-gray-900'
                      : table.is_active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-400 text-white opacity-50',
                    'hover:shadow-2xl transition-shadow'
                  )}
                  style={{
                    ...getTableStyle(table),
                    touchAction: 'manipulation',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onClick={(e) => handleTableClick(table.id, e)}
                  onMouseDown={(e) => handleItemDragStart(e, table.id, 'table')}
                  onTouchStart={(e) => handleItemDragStart(e, table.id, 'table')}
                  onDoubleClick={() => setEditingTable(table)}
                >
                  <span className={cn(
                    "text-sm font-bold",
                    isSelected ? "text-gray-900" : "text-white"
                  )}>{table.table_number}</span>
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs",
                    isSelected ? "text-gray-700" : "text-white/90"
                  )}>
                    <Users className="w-3 h-3" />
                    <span>{seatRange}</span>
                  </div>

                  {/* Resize handles — 44px touch targets, visible when selected */}
                  {isSelected && (
                    <>
                      {(['se', 'sw', 'ne', 'nw'] as const).map((handle) => (
                        <div
                          key={handle}
                          data-resize-handle
                          className={cn(
                            'absolute flex items-center justify-center',
                            handle === 'se' ? 'cursor-se-resize' : handle === 'sw' ? 'cursor-sw-resize' : handle === 'ne' ? 'cursor-ne-resize' : 'cursor-nw-resize'
                          )}
                          style={{
                            width: 44,
                            height: 44,
                            ...(handle.includes('s') ? { bottom: -22 } : { top: -22 }),
                            ...(handle.includes('e') ? { right: -22 } : { left: -22 }),
                            touchAction: 'none',
                            zIndex: 10,
                          }}
                          onMouseDown={(e) => handleResizeStart(table.id, 'table', handle, e)}
                          onTouchStart={(e) => handleResizeStart(table.id, 'table', handle, e)}
                        >
                          <div className="w-3.5 h-3.5 bg-white rounded-full shadow-md border-2 border-primary" />
                        </div>
                      ))}
                    </>
                  )}

                  {/* Dimension label during resize */}
                  <div
                    data-dim-label
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
                    style={{ display: resizingDecor?.id === table.id ? 'block' : 'none' }}
                  >
                    {table.width} × {table.height}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Decor Layer */}
          <div
            className="absolute"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {decor.map((item) => (
              <div
                key={item.id}
                data-decor
                className={getDecorStyle(item)}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width || 60,
                  height: item.height || 60,
                  borderRadius: item.radius || 8,
                  touchAction: 'manipulation',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                }}
                onClick={(e) => {
                  handleDecorClick(item.id, e)
                  setEditingDecor(item)
                }}
                onMouseDown={(e) => handleItemDragStart(e, item.id, 'decor')}
                onTouchStart={(e) => handleItemDragStart(e, item.id, 'decor')}
              >
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  {getDecorIcon(item.type)}
                  <span className="text-xs font-semibold capitalize text-center" style={{textShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>
                    {item.type.replace('-', ' ')}
                  </span>
                </div>

                {/* Resize Handles — 44px touch targets with small visual dots */}
                {selectedIds.includes(item.id) && (
                  <>
                    {(['se', 'sw', 'ne', 'nw'] as const).map((handle) => (
                      <div
                        key={handle}
                        data-resize-handle
                        className={cn(
                          'absolute flex items-center justify-center',
                          handle === 'se' ? 'cursor-se-resize' : handle === 'sw' ? 'cursor-sw-resize' : handle === 'ne' ? 'cursor-ne-resize' : 'cursor-nw-resize'
                        )}
                        style={{
                          width: 44,
                          height: 44,
                          ...(handle.includes('s') ? { bottom: -22 } : { top: -22 }),
                          ...(handle.includes('e') ? { right: -22 } : { left: -22 }),
                          touchAction: 'none',
                          zIndex: 10,
                        }}
                        onMouseDown={(e) => handleResizeStart(item.id, 'decor', handle, e)}
                        onTouchStart={(e) => handleResizeStart(item.id, 'decor', handle, e)}
                      >
                        <div className="w-3.5 h-3.5 bg-primary rounded-full shadow-md border-2 border-white" />
                      </div>
                    ))}
                  </>
                )}

                {/* Dimension Display — data-dim-label allows RAF to update directly */}
                <div
                  data-dim-label
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
                  style={{ display: showDimensions || resizingDecor?.id === item.id ? 'block' : 'none' }}
                >
                  {Math.round(item.width || 60)} × {Math.round(item.height || 60)}
                </div>
              </div>
            ))}
          </div>

          {/* Placement Cursor */}
          {isPlacingDecor && (
            <div className="absolute inset-0 z-10 cursor-crosshair"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
            />
          )}

          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col items-center gap-1 z-40">
            <div className="bg-card rounded-lg border flex flex-col overflow-hidden shadow-sm">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={handleZoomIn}>
                <ZoomIn className="h-3 w-3" />
              </Button>
              <div className="px-1.5 py-0.5 text-[10px] text-center text-muted-foreground">
                {Math.round(zoom * 100)}%
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={handleZoomOut}>
                <ZoomOut className="h-3 w-3" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg border shadow-sm" onClick={handleZoomReset}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Bottom Info Bar */}
          <div className="absolute bottom-4 left-4 bg-muted/50 px-3 py-1.5 rounded-md">
            <span className="text-sm text-muted-foreground">
              {tables.length} tables · Shift+click to multi-select
            </span>
          </div>
        </div>

        {/* Right Sidebar - Decor Properties - Desktop OR Floating Bottom Sheet on Tablets */}
        {editingDecor && (
          <>
            {/* Desktop side panel (hidden on tablets) */}
            <div className="w-72 border-l bg-card flex-col p-4 overflow-hidden hidden min-[701px]:flex">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h3 className="font-semibold text-sm capitalize truncate">{editingDecor.type.replace('-', ' ')}</h3>
                <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => setEditingDecor(null)}>
                  ✕
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  {/* Width */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Width</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { width: Math.max(20, (editingDecor.width || 60) - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{editingDecor.width || 60}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { width: Math.min(300, (editingDecor.width || 60) + 5) })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Height */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Height</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { height: Math.max(20, (editingDecor.height || 60) - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{editingDecor.height || 60}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { height: Math.min(300, (editingDecor.height || 60) + 5) })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Corner Radius */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Radius</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { radius: Math.max(0, (editingDecor.radius || 8) - 2) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{editingDecor.radius || 8}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { radius: Math.min(50, (editingDecor.radius || 8) + 2) })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* X Position */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">X Position</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { x: Math.max(0, editingDecor.x - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{Math.round(editingDecor.x)}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { x: editingDecor.x + 5 })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Y Position */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Y Position</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { y: Math.max(0, editingDecor.y - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{Math.round(editingDecor.y)}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { y: editingDecor.y + 5 })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="snap-to-grid"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="snap-to-grid" className="text-xs cursor-pointer font-medium">Snap to Grid</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="lock-aspect"
                        checked={lockAspectRatio}
                        onChange={(e) => setLockAspectRatio(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="lock-aspect" className="text-xs cursor-pointer font-medium">Lock Aspect Ratio</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="show-dims"
                        checked={showDimensions}
                        onChange={(e) => setShowDimensions(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="show-dims" className="text-xs cursor-pointer font-medium">Show Dimensions</Label>
                    </div>
                  </div>

                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => {
                      setDecor(prev => prev.filter(d => d.id !== editingDecor.id))
                      setEditingDecor(null)
                      toast.success('Decor removed')
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </ScrollArea>
            </div>

            {/* Mobile floating bottom sheet (shown on tablets) */}
            <div className="fixed bottom-0 left-0 right-0 max-[700px]:flex hidden flex-col bg-card border-t rounded-t-2xl shadow-2xl z-50 max-h-[60vh] animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-card rounded-t-2xl">
                <h3 className="font-semibold text-sm capitalize">{editingDecor.type.replace('-', ' ')}</h3>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingDecor(null)}>
                  ✕
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="px-4 py-4 space-y-4 pb-20">
                  {/* Width */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Width</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { width: Math.max(20, (editingDecor.width || 60) - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{editingDecor.width || 60}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { width: Math.min(300, (editingDecor.width || 60) + 5) })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Height */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Height</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { height: Math.max(20, (editingDecor.height || 60) - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{editingDecor.height || 60}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { height: Math.min(300, (editingDecor.height || 60) + 5) })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Corner Radius */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Radius</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { radius: Math.max(0, (editingDecor.radius || 8) - 2) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{editingDecor.radius || 8}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { radius: Math.min(50, (editingDecor.radius || 8) + 2) })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* X Position */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">X Position</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { x: Math.max(0, editingDecor.x - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{Math.round(editingDecor.x)}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { x: editingDecor.x + 5 })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Y Position */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Y Position</Label>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { y: Math.max(0, editingDecor.y - 5) })}
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-xs font-semibold">{Math.round(editingDecor.y)}px</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 flex-shrink-0 p-0"
                        onClick={() => updateDecor(editingDecor.id, { y: editingDecor.y + 5 })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="snap-to-grid-mobile"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="snap-to-grid-mobile" className="text-xs cursor-pointer font-medium">Snap to Grid</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="lock-aspect-mobile"
                        checked={lockAspectRatio}
                        onChange={(e) => setLockAspectRatio(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="lock-aspect-mobile" className="text-xs cursor-pointer font-medium">Lock Aspect Ratio</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="show-dims-mobile"
                        checked={showDimensions}
                        onChange={(e) => setShowDimensions(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="show-dims-mobile" className="text-xs cursor-pointer font-medium">Show Dimensions</Label>
                    </div>
                  </div>

                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => {
                      setDecor(prev => prev.filter(d => d.id !== editingDecor.id))
                      setEditingDecor(null)
                      toast.success('Decor removed')
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t bg-card">
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8">
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8">
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 motion-safe:animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Add Table Dialog */}
      <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Table Number</Label>
              <Input
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="e.g., T1, A1, 101"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shape</Label>
                <Select value={newTableShape} onValueChange={(v) => setNewTableShape(v as TableShape)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_SHAPES.map((shape) => (
                      <SelectItem key={shape.value} value={shape.value}>
                        {shape.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newTableType} onValueChange={(v) => setNewTableType(v as TableType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Min</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newTableMinCapacity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      setNewTableMinCapacity(val)
                      if (val > newTableMaxCapacity) setNewTableMaxCapacity(val)
                    }}
                    className="w-20"
                  />
                </div>
                <span className="text-sm text-muted-foreground mt-5">to</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newTableMaxCapacity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      setNewTableMaxCapacity(val)
                      if (val < newTableMinCapacity) setNewTableMinCapacity(val)
                    }}
                    className="w-20"
                  />
                </div>
                <span className="text-sm text-muted-foreground mt-5">guests</span>
              </div>
              <p className="text-xs text-muted-foreground">Party sizes outside this range won't be assigned to this table</p>
            </div>
            <div className="space-y-2">
              <Label>Booking Type</Label>
              <Select value={newTableBookingType} onValueChange={(v) => setNewTableBookingType(v as 'instant' | 'request')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="request">Request (Staff Approves)</SelectItem>
                  <SelectItem value="instant">Instant (Auto-Confirmed)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Rules can override this default for specific conditions
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTable(false)}>Cancel</Button>
            <Button onClick={handleAddTable}>Add Table</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Decor Dialog */}
      <Dialog open={showAddDecor} onOpenChange={setShowAddDecor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Decor Element</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {DECOR_TYPES.map((decorType) => (
              <Button
                key={decorType.value}
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={() => handleAddDecorType(decorType.value as DecorItem['type'])}
              >
                <span className="text-sm font-medium">{decorType.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Section Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Section</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input" className="text-sm mb-2 block">Section name</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSection() }}
              autoFocus
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRenameSection} disabled={isRenaming}>
              {isRenaming && <Loader2 className="h-3.5 w-3.5 mr-1.5 motion-safe:animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Rule Form Dialog */}
      <RuleFormDialog
        open={showRuleDialog}
        onOpenChange={setShowRuleDialog}
        rule={editingRule}
        onDelete={editingRule ? () => {
          if (!selectedTableForRules || !restaurantId) return
          deleteRule.mutate({ id: editingRule.id, tableId: selectedTableForRules.id, restaurantId })
          setEditingRule(null)
        } : undefined}
        onSave={(ruleData) => {
          if (!selectedTableForRules || !restaurantId) return
          if (editingRule) {
            updateRule.mutate({
              id: editingRule.id,
              ...ruleData,
              conditions: ruleData.conditions,
            })
          } else {
            createRule.mutate({
              table_id: selectedTableForRules.id,
              restaurant_id: restaurantId,
              ...ruleData,
            })
          }
        }}
      />

      {/* Delete Rule Confirmation */}
      <AlertDialog open={!!deletingRuleId} onOpenChange={(open) => { if (!open) setDeletingRuleId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the rule from this table. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingRuleId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingRuleId || !selectedTableForRules || !restaurantId) return
                deleteRule.mutate({
                  id: deletingRuleId,
                  tableId: selectedTableForRules.id,
                  restaurantId,
                })
                setDeletingRuleId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
