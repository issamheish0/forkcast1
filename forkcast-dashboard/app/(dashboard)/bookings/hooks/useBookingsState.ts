import { useState, useReducer, useCallback, useMemo } from "react"
import { addDays } from "date-fns"
import type { Booking } from "@/types"

export type ViewMode = "today" | "management"
export type StatusFilter = "all" | "upcoming" | "pending" | "confirmed" | "completed" | "cancelled_by_user" | "no_show"
export type TimeFilter = "all" | "lunch" | "dinner"
export type DateRange = "today" | "tomorrow" | "week" | "all" | "custom"

interface BookingsState {
  // View and navigation
  viewMode: ViewMode
  selectedDate: Date
  selectedBooking: Booking | null

  // Filters
  searchQuery: string
  statusFilter: StatusFilter
  timeFilter: TimeFilter
  dateRange: DateRange

  // UI states
  showManualBooking: boolean
  showAnalytics: boolean
  showDatePicker: boolean
  autoRefresh: boolean
  selectedBookings: string[]

  // Table assignment
  showTableAssignment: boolean
  assignmentBookingId: string | null
  selectedTablesForAssignment: string[]

  // Other UI
  lastRefresh: Date
  showShortcuts: boolean
  draggedBooking: string | null
}

type BookingsAction =
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_SELECTED_DATE'; payload: Date }
  | { type: 'SET_SELECTED_BOOKING'; payload: Booking | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_STATUS_FILTER'; payload: StatusFilter }
  | { type: 'SET_TIME_FILTER'; payload: TimeFilter }
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'TOGGLE_MANUAL_BOOKING' }
  | { type: 'TOGGLE_ANALYTICS' }
  | { type: 'TOGGLE_DATE_PICKER' }
  | { type: 'TOGGLE_AUTO_REFRESH' }
  | { type: 'SET_SELECTED_BOOKINGS'; payload: string[] }
  | { type: 'TOGGLE_BOOKING_SELECTION'; payload: string }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'SET_TABLE_ASSIGNMENT'; payload: { show: boolean; bookingId?: string } }
  | { type: 'SET_SELECTED_TABLES'; payload: string[] }
  | { type: 'UPDATE_LAST_REFRESH' }
  | { type: 'TOGGLE_SHORTCUTS' }
  | { type: 'SET_DRAGGED_BOOKING'; payload: string | null }
  | { type: 'RESET_FILTERS' }

const initialState: BookingsState = {
  viewMode: "today",
  selectedDate: new Date(),
  selectedBooking: null,
  searchQuery: "",
  statusFilter: "upcoming",
  timeFilter: "all",
  dateRange: "today",
  showManualBooking: false,
  showAnalytics: false,
  showDatePicker: false,
  autoRefresh: true,
  selectedBookings: [],
  showTableAssignment: false,
  assignmentBookingId: null,
  selectedTablesForAssignment: [],
  lastRefresh: new Date(),
  showShortcuts: false,
  draggedBooking: null,
}

function bookingsReducer(state: BookingsState, action: BookingsAction): BookingsState {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.payload,
        // Reset filters when changing views for better UX
        statusFilter: action.payload === 'today' ? 'upcoming' : state.statusFilter,
        dateRange: action.payload === 'today' ? 'today' : state.dateRange
      }

    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.payload }

    case 'SET_SELECTED_BOOKING':
      return { ...state, selectedBooking: action.payload }

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }

    case 'SET_STATUS_FILTER':
      return { ...state, statusFilter: action.payload }

    case 'SET_TIME_FILTER':
      return { ...state, timeFilter: action.payload }

    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload }

    case 'TOGGLE_MANUAL_BOOKING':
      return { ...state, showManualBooking: !state.showManualBooking }

    case 'TOGGLE_ANALYTICS':
      return { ...state, showAnalytics: !state.showAnalytics }

    case 'TOGGLE_DATE_PICKER':
      return { ...state, showDatePicker: !state.showDatePicker }

    case 'TOGGLE_AUTO_REFRESH':
      return { ...state, autoRefresh: !state.autoRefresh }

    case 'SET_SELECTED_BOOKINGS':
      return { ...state, selectedBookings: action.payload }

    case 'TOGGLE_BOOKING_SELECTION':
      const bookingId = action.payload
      return {
        ...state,
        selectedBookings: state.selectedBookings.includes(bookingId)
          ? state.selectedBookings.filter(id => id !== bookingId)
          : [...state.selectedBookings, bookingId]
      }

    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedBookings: [],
        selectedBooking: null,
        showManualBooking: false,
        showAnalytics: false,
        showTableAssignment: false,
        assignmentBookingId: null,
      }

    case 'SET_TABLE_ASSIGNMENT':
      return {
        ...state,
        showTableAssignment: action.payload.show,
        assignmentBookingId: action.payload.bookingId || null,
        selectedTablesForAssignment: action.payload.show ? state.selectedTablesForAssignment : [],
      }

    case 'SET_SELECTED_TABLES':
      return { ...state, selectedTablesForAssignment: action.payload }

    case 'UPDATE_LAST_REFRESH':
      return { ...state, lastRefresh: new Date() }

    case 'TOGGLE_SHORTCUTS':
      return { ...state, showShortcuts: !state.showShortcuts }

    case 'SET_DRAGGED_BOOKING':
      return { ...state, draggedBooking: action.payload }

    case 'RESET_FILTERS':
      return {
        ...state,
        searchQuery: "",
        statusFilter: "upcoming",
        timeFilter: "all",
        dateRange: "today",
        selectedDate: new Date(),
      }

    default:
      return state
  }
}

export function useBookingsState() {
  const [state, dispatch] = useReducer(bookingsReducer, initialState)

  // Memoized actions to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    setViewMode: (mode: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', payload: mode }),
    setSelectedDate: (date: Date) => dispatch({ type: 'SET_SELECTED_DATE', payload: date }),
    setSelectedBooking: (booking: Booking | null) => dispatch({ type: 'SET_SELECTED_BOOKING', payload: booking }),
    setSearchQuery: (query: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: query }),
    setStatusFilter: (filter: StatusFilter) => dispatch({ type: 'SET_STATUS_FILTER', payload: filter }),
    setTimeFilter: (filter: TimeFilter) => dispatch({ type: 'SET_TIME_FILTER', payload: filter }),
    setDateRange: (range: DateRange) => dispatch({ type: 'SET_DATE_RANGE', payload: range }),
    toggleManualBooking: () => dispatch({ type: 'TOGGLE_MANUAL_BOOKING' }),
    toggleAnalytics: () => dispatch({ type: 'TOGGLE_ANALYTICS' }),
    toggleDatePicker: () => dispatch({ type: 'TOGGLE_DATE_PICKER' }),
    toggleAutoRefresh: () => dispatch({ type: 'TOGGLE_AUTO_REFRESH' }),
    setSelectedBookings: (ids: string[]) => dispatch({ type: 'SET_SELECTED_BOOKINGS', payload: ids }),
    toggleBookingSelection: (id: string) => dispatch({ type: 'TOGGLE_BOOKING_SELECTION', payload: id }),
    clearSelections: () => dispatch({ type: 'CLEAR_SELECTIONS' }),
    setTableAssignment: (show: boolean, bookingId?: string) =>
      dispatch({ type: 'SET_TABLE_ASSIGNMENT', payload: { show, bookingId } }),
    setSelectedTables: (tables: string[]) => dispatch({ type: 'SET_SELECTED_TABLES', payload: tables }),
    updateLastRefresh: () => dispatch({ type: 'UPDATE_LAST_REFRESH' }),
    toggleShortcuts: () => dispatch({ type: 'TOGGLE_SHORTCUTS' }),
    setDraggedBooking: (id: string | null) => dispatch({ type: 'SET_DRAGGED_BOOKING', payload: id }),
    resetFilters: () => dispatch({ type: 'RESET_FILTERS' }),
  }), [])

  // Quick date helpers
  const dateHelpers = useMemo(() => ({
    goToToday: () => {
      actions.setSelectedDate(new Date())
      actions.setDateRange("today")
    },
    goToTomorrow: () => {
      actions.setSelectedDate(addDays(new Date(), 1))
      actions.setDateRange("tomorrow")
    },
    goToDate: (date: Date) => {
      actions.setSelectedDate(date)
      actions.setDateRange("custom")
    }
  }), [actions])

  return {
    state,
    actions,
    dateHelpers,
    // Computed values
    hasFiltersApplied: state.searchQuery || state.statusFilter !== 'upcoming' || state.timeFilter !== 'all',
    hasSelections: state.selectedBookings.length > 0,
  }
}