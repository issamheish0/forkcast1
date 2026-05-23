// lib/booking-modification-helpers.ts
// Shared helpers for booking modification notifications.
// Used by both BookingDetails (full dashboard) and BookingModificationDialog (basic dashboard).

// ── Lebanon timezone formatting ─────────────────────────────────────────────

export const formatLebanonTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: 'Asia/Beirut',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export const formatLebanonDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: 'Asia/Beirut',
    month: 'short',
    day: 'numeric',
  })
}

// ── Natural-language notification message builder ────────────────────────────

interface EditedBookingData {
  party_size: number
  turn_time_minutes: number
  special_requests: string
  booking_time?: string // present only when booking time is editable
}

interface OriginalBookingData {
  party_size: number
  turn_time_minutes: number
  special_requests: string | null
  booking_time?: string
}

export const buildModificationMessage = (
  restaurantName: string,
  originalBookingTime: string,
  editedData: EditedBookingData,
  originalBooking: OriginalBookingData,
  tablesChanged: boolean
): { body: string; changeLabels: string[] } => {
  // Use the NEW booking time for display if it changed, otherwise original
  const displayTime = editedData.booking_time || originalBookingTime
  const timeStr = formatLebanonTime(displayTime)
  const dateStr = formatLebanonDate(displayTime)
  const dateTimeStr = `${dateStr} at ${timeStr}`

  // Compare booking times (rounded to the minute to avoid sub-second drift)
  const bookingTimeChanged = Boolean(
    editedData.booking_time &&
      originalBooking.booking_time &&
      Math.floor(new Date(editedData.booking_time).getTime() / 60000) !==
        Math.floor(new Date(originalBooking.booking_time).getTime() / 60000)
  )
  const partySizeChanged = editedData.party_size !== originalBooking.party_size
  const turnTimeChanged = editedData.turn_time_minutes !== originalBooking.turn_time_minutes
  const specialRequestsChanged =
    editedData.special_requests !== (originalBooking.special_requests || '')

  const changeLabels: string[] = []
  if (bookingTimeChanged) changeLabels.push('date/time')
  if (partySizeChanged) changeLabels.push('party size')
  if (turnTimeChanged) changeLabels.push('duration')
  if (tablesChanged) changeLabels.push('table assignment')
  if (specialRequestsChanged) changeLabels.push('special requests')

  if (changeLabels.length === 0) {
    return { body: '', changeLabels: [] }
  }

  const peopleSuffix = editedData.party_size === 1 ? 'person' : 'people'

  // ── Single change → specific, natural message ──

  if (changeLabels.length === 1) {
    if (bookingTimeChanged) {
      return {
        body: `Your booking at ${restaurantName} is now on ${dateTimeStr}`,
        changeLabels,
      }
    }
    if (partySizeChanged) {
      return {
        body: `Your booking at ${restaurantName} on ${dateTimeStr} is now for ${editedData.party_size} ${peopleSuffix}`,
        changeLabels,
      }
    }
    if (turnTimeChanged) {
      const hours = editedData.turn_time_minutes / 60
      return {
        body: `Your booking duration at ${restaurantName} on ${dateTimeStr} has been updated to ${hours} hours`,
        changeLabels,
      }
    }
    if (tablesChanged) {
      return {
        body: `Your table assignment at ${restaurantName} has been updated for your ${dateTimeStr} booking`,
        changeLabels,
      }
    }
    if (specialRequestsChanged) {
      return {
        body: `Special requests for your booking at ${restaurantName} on ${dateTimeStr} have been updated`,
        changeLabels,
      }
    }
  }

  // ── Multiple changes → combined message, lead with the most important ──

  if (bookingTimeChanged && partySizeChanged) {
    return {
      body: `Your booking at ${restaurantName} has been updated — now on ${dateTimeStr} for ${editedData.party_size} ${peopleSuffix}`,
      changeLabels,
    }
  }
  if (bookingTimeChanged) {
    return {
      body: `Your booking at ${restaurantName} has been updated — now on ${dateTimeStr}`,
      changeLabels,
    }
  }
  if (partySizeChanged) {
    return {
      body: `Your booking at ${restaurantName} on ${dateTimeStr} has been updated — now for ${editedData.party_size} ${peopleSuffix}`,
      changeLabels,
    }
  }

  return {
    body: `Your booking at ${restaurantName} on ${dateTimeStr} has been updated (${changeLabels.join(', ')})`,
    changeLabels,
  }
}
