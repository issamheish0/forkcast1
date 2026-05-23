// lib/booking-warnings.ts — Contextual warning system for booking operations
import { createClient } from "@/lib/supabase/client"
import { addMinutes, differenceInMinutes, format, startOfDay, endOfDay } from "date-fns"
import { getSectionMaxCovers, getSectionCurrentCovers } from "./section-capacity"
import type { Booking, RestaurantTable, RestaurantSection } from "@/types"

export type WarningLevel = "info" | "warning" | "critical"

export interface BookingWarning {
  id: string
  level: WarningLevel
  title: string
  message: string
  /** Optional suggestion displayed below the message */
  suggestion?: string
}

// ─────────────────────────────────────────────────────────────
// 1. Warnings shown when ACCEPTING a pending booking
// ─────────────────────────────────────────────────────────────
export async function getAcceptanceWarnings(
  booking: Booking,
  restaurantId: string,
  sections?: RestaurantSection[],
  tables?: RestaurantTable[]
): Promise<BookingWarning[]> {
  const supabase = createClient()
  const warnings: BookingWarning[] = []
  const bookingTime = new Date(booking.booking_time)
  const timeSlot = format(bookingTime, "HH:mm")

  // --- 1a. Section at/near capacity ---
  if (booking.preferred_section && sections && tables) {
    const section = sections.find(s => s.id === booking.preferred_section)
    if (section) {
      const { maxCovers } = getSectionMaxCovers(section, tables)
      if (maxCovers > 0) {
        const { totalCovers: currentCovers } = await getSectionCurrentCovers(
          section.id, restaurantId, bookingTime, timeSlot
        )
        const afterCovers = currentCovers + booking.party_size
        const percentage = Math.round((currentCovers / maxCovers) * 100)
        const afterPercentage = Math.round((afterCovers / maxCovers) * 100)

        if (afterCovers > maxCovers) {
          warnings.push({
            id: "section_over_capacity",
            level: "critical",
            title: "Section Over Capacity",
            message: `"${section.name}" will be at ${afterCovers}/${maxCovers} covers (${afterPercentage}%) after accepting this booking.`,
            suggestion: "Consider assigning to a different section or declining."
          })
        } else if (afterPercentage >= 90) {
          warnings.push({
            id: "section_near_capacity",
            level: "warning",
            title: "Section Nearly Full",
            message: `"${section.name}" will be at ${afterPercentage}% capacity (${afterCovers}/${maxCovers} covers) after accepting.`,
            suggestion: "Few covers remaining — avoid overbooking."
          })
        }
      }
    }
  }

  // --- 1b. Restaurant-wide capacity near full for this time slot ---
  if (sections && tables) {
    let totalMax = 0
    let totalCurrent = 0
    const activeSections = sections.filter(s => s.is_active)
    await Promise.all(
      activeSections.map(async (s) => {
        const { maxCovers } = getSectionMaxCovers(s, tables)
        const { totalCovers: current } = await getSectionCurrentCovers(s.id, restaurantId, bookingTime, timeSlot)
        totalMax += maxCovers
        totalCurrent += current
      })
    )
    if (totalMax > 0) {
      const afterTotal = totalCurrent + booking.party_size
      const afterPct = Math.round((afterTotal / totalMax) * 100)
      if (afterPct >= 90 && !warnings.some(w => w.id === "section_over_capacity")) {
        warnings.push({
          id: "restaurant_near_capacity",
          level: "warning",
          title: "Restaurant Nearly Full",
          message: `Overall capacity will be at ${afterPct}% (${afterTotal}/${totalMax} covers) for this time slot.`,
          suggestion: "Consider the impact on service quality."
        })
      }
    }
  }

  // --- 1c. Booking time is very close (within 30 minutes) ---
  const minutesUntil = differenceInMinutes(bookingTime, new Date())
  if (minutesUntil >= 0 && minutesUntil <= 30) {
    warnings.push({
      id: "booking_arriving_soon",
      level: "warning",
      title: "Guest Arriving Very Soon",
      message: `This booking is in ${minutesUntil} minute${minutesUntil === 1 ? "" : "s"}. Make sure a table is ready.`,
      suggestion: "Assign a table immediately after accepting."
    })
  }

  // --- 1d. Booking time has already passed ---
  if (minutesUntil < 0) {
    warnings.push({
      id: "booking_time_passed",
      level: "critical",
      title: "Booking Time Has Passed",
      message: `This booking was scheduled for ${format(bookingTime, "h:mm a")} (${Math.abs(minutesUntil)} min ago).`,
      suggestion: "Confirm with the guest if they are still coming."
    })
  }

  // --- 1e. Guest has recent no-shows ---
  if (booking.user_id || booking.guest_phone) {
    try {
      let noShowQuery = supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("status", "no_show")

      if (booking.user_id) {
        noShowQuery = noShowQuery.eq("user_id", booking.user_id)
      } else if (booking.guest_phone) {
        noShowQuery = noShowQuery.eq("guest_phone", booking.guest_phone)
      }

      const { count } = await noShowQuery
      if (count && count >= 2) {
        warnings.push({
          id: "guest_no_show_history",
          level: "warning",
          title: "Repeat No-Show Guest",
          message: `This guest has ${count} previous no-show${count > 1 ? "s" : ""} at your restaurant.`,
          suggestion: "Consider requiring a deposit or confirmation call."
        })
      }
    } catch { /* non-blocking */ }
  }

  // --- 1f. Large party size ---
  if (booking.party_size >= 8) {
    warnings.push({
      id: "large_party",
      level: "info",
      title: "Large Party",
      message: `Party of ${booking.party_size} guests may require extra preparation.`,
      suggestion: "Ensure kitchen and service staff are informed."
    })
  }

  // --- 1g. Request was pending for a long time ---
  if (booking.created_at) {
    const waitMinutes = differenceInMinutes(new Date(), new Date(booking.created_at))
    if (waitMinutes > 120) {
      const hours = Math.floor(waitMinutes / 60)
      warnings.push({
        id: "long_pending",
        level: "info",
        title: "Long Wait Time",
        message: `This request has been pending for ${hours}+ hour${hours > 1 ? "s" : ""}.`,
        suggestion: "Guest may have made alternative plans."
      })
    }
  }

  // --- 1h. Overlapping booking for same guest ---
  if (booking.user_id || booking.guest_phone) {
    try {
      const dayStart = startOfDay(bookingTime)
      const dayEnd = endOfDay(bookingTime)
      let overlapQuery = supabase
        .from("bookings")
        .select("id, booking_time, status")
        .eq("restaurant_id", restaurantId)
        .neq("id", booking.id)
        .gte("booking_time", dayStart.toISOString())
        .lte("booking_time", dayEnd.toISOString())
        .in("status", ["confirmed", "pending", "arrived", "seated"])

      if (booking.user_id) {
        overlapQuery = overlapQuery.eq("user_id", booking.user_id)
      } else if (booking.guest_phone) {
        overlapQuery = overlapQuery.eq("guest_phone", booking.guest_phone)
      }

      const { data: overlapping } = await overlapQuery
      if (overlapping && overlapping.length > 0) {
        warnings.push({
          id: "duplicate_guest_booking",
          level: "warning",
          title: "Duplicate Guest Booking",
          message: `This guest already has ${overlapping.length} other booking${overlapping.length > 1 ? "s" : ""} today.`,
          suggestion: "Check if this is a duplicate or intentional."
        })
      }
    } catch { /* non-blocking */ }
  }

  return warnings
}

// ─────────────────────────────────────────────────────────────
// 2. Warnings shown when ASSIGNING a table to a booking
// ─────────────────────────────────────────────────────────────
export async function getTableAssignmentWarnings(
  booking: Booking,
  tableIds: string[],
  restaurantId: string,
  allTables?: RestaurantTable[]
): Promise<BookingWarning[]> {
  const supabase = createClient()
  const warnings: BookingWarning[] = []
  const bookingTime = new Date(booking.booking_time)
  const turnTime = booking.turn_time_minutes || 120
  const bookingEnd = addMinutes(bookingTime, turnTime)

  // Fetch the selected tables if not provided
  let selectedTables: RestaurantTable[] = []
  if (allTables) {
    selectedTables = allTables.filter(t => tableIds.includes(t.id))
  } else {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("*")
      .in("id", tableIds)
      .eq("restaurant_id", restaurantId)
    selectedTables = (data as RestaurantTable[]) || []
  }

  // --- 2a. Soon-upcoming booking on the table ---
  try {
    const { data: upcomingBookings } = await supabase
      .from("bookings")
      .select(`
        id, booking_time, party_size, turn_time_minutes, guest_name, status,
        tables:booking_tables(table_id)
      `)
      .eq("restaurant_id", restaurantId)
      .neq("id", booking.id)
      .in("status", ["confirmed", "arrived", "pending"])
      .gte("booking_time", new Date().toISOString())
      .order("booking_time", { ascending: true })

    if (upcomingBookings) {
      for (const upcoming of upcomingBookings) {
        const upcomingTime = new Date(upcoming.booking_time)
        const upcomingTableIds = (upcoming.tables as any[])?.map((bt: any) => bt.table_id) || []
        const overlappingTableIds = tableIds.filter(id => upcomingTableIds.includes(id))

        if (overlappingTableIds.length === 0) continue

        const minutesUntilUpcoming = differenceInMinutes(upcomingTime, bookingEnd)
        const overlappingTables = selectedTables.filter(t => overlappingTableIds.includes(t.id))
        const tableLabels = overlappingTables.map(t => `T${t.table_number}`).join(", ")

        if (minutesUntilUpcoming < 0 && upcomingTime > bookingTime) {
          // Booking would overlap with upcoming
          warnings.push({
            id: `table_overlap_${upcoming.id}`,
            level: "critical",
            title: "Table Time Conflict",
            message: `${tableLabels} ha${overlappingTables.length > 1 ? "ve" : "s"} a booking at ${format(upcomingTime, "h:mm a")} (${upcoming.guest_name || "Guest"}, ${upcoming.party_size} pax) which overlaps with this booking's end time.`,
            suggestion: "Reduce turn time or choose a different table."
          })
        } else if (minutesUntilUpcoming >= 0 && minutesUntilUpcoming <= 30) {
          // Next booking is soon after this one ends
          warnings.push({
            id: `table_tight_turnaround_${upcoming.id}`,
            level: "warning",
            title: "Tight Table Turnaround",
            message: `${tableLabels} ha${overlappingTables.length > 1 ? "ve" : "s"} another booking at ${format(upcomingTime, "h:mm a")} — only ${minutesUntilUpcoming} minutes after this booking's expected end.`,
            suggestion: "May not have enough time for table cleanup."
          })
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- 2b. Table capacity vs party size ---
  if (selectedTables.length > 0) {
    const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0)
    const totalMaxCapacity = selectedTables.reduce((sum, t) => sum + (t.max_capacity || t.capacity), 0)
    const totalMinCapacity = selectedTables.reduce((sum, t) => sum + (t.min_capacity || 1), 0)

    if (booking.party_size > totalMaxCapacity) {
      warnings.push({
        id: "exceeds_max_capacity",
        level: "critical",
        title: "Exceeds Table Capacity",
        message: `Party of ${booking.party_size} exceeds total max capacity of ${totalMaxCapacity} for the selected table${selectedTables.length > 1 ? "s" : ""}.`,
        suggestion: "Add more tables or reassign to a larger table."
      })
    } else if (booking.party_size > totalCapacity) {
      warnings.push({
        id: "above_standard_capacity",
        level: "warning",
        title: "Above Standard Capacity",
        message: `Party of ${booking.party_size} exceeds the standard capacity (${totalCapacity}) but fits within max capacity (${totalMaxCapacity}).`,
        suggestion: "Guests may be slightly cramped."
      })
    }

    if (booking.party_size < totalMinCapacity) {
      warnings.push({
        id: "below_min_capacity",
        level: "warning",
        title: "Below Minimum Capacity",
        message: `Party of ${booking.party_size} is below the minimum capacity of ${totalMinCapacity} for the selected table${selectedTables.length > 1 ? "s" : ""}.`,
        suggestion: "Consider assigning a smaller table to optimize seating."
      })
    }

    // Significantly under-utilizing tables (e.g., party of 2 at an 8-top)
    if (totalCapacity > 0 && booking.party_size <= totalCapacity * 0.4 && totalCapacity >= 6) {
      warnings.push({
        id: "table_underutilized",
        level: "info",
        title: "Table Underutilized",
        message: `Party of ${booking.party_size} will only use ${Math.round((booking.party_size / totalCapacity) * 100)}% of the table capacity (${totalCapacity} seats).`,
        suggestion: "A smaller table might be more efficient during busy periods."
      })
    }
  }

  // --- 2c. Table in a different section than preferred ---
  if (booking.preferred_section && selectedTables.length > 0) {
    const wrongSectionTables = selectedTables.filter(
      t => t.section_id && t.section_id !== booking.preferred_section
    )
    if (wrongSectionTables.length > 0) {
      const tableLabels = wrongSectionTables.map(t => `T${t.table_number}`).join(", ")
      warnings.push({
        id: "wrong_section",
        level: "info",
        title: "Different Section",
        message: `${tableLabels} ${wrongSectionTables.length > 1 ? "are" : "is"} not in the guest's preferred section.`,
        suggestion: "Guest requested a specific section — confirm the change is acceptable."
      })
    }
  }

  // --- 2d. Table is currently occupied (for walk-ins / immediate seating) ---
  try {
    const now = new Date()
    // Only check if booking is for today and roughly now
    if (Math.abs(differenceInMinutes(bookingTime, now)) <= 30) {
      const { data: activeBookings } = await supabase
        .from("bookings")
        .select(`
          id, booking_time, party_size, guest_name, status, turn_time_minutes,
          tables:booking_tables(table_id)
        `)
        .eq("restaurant_id", restaurantId)
        .neq("id", booking.id)
        .in("status", ["seated", "ordered", "appetizers", "main_course", "dessert", "payment"])

      if (activeBookings) {
        for (const active of activeBookings) {
          const activeTableIds = (active.tables as any[])?.map((bt: any) => bt.table_id) || []
          const occupiedTableIds = tableIds.filter(id => activeTableIds.includes(id))

          if (occupiedTableIds.length > 0) {
            const occupiedTables = selectedTables.filter(t => occupiedTableIds.includes(t.id))
            const tableLabels = occupiedTables.map(t => `T${t.table_number}`).join(", ")
            warnings.push({
              id: `table_currently_occupied_${active.id}`,
              level: "critical",
              title: "Table Currently Occupied",
              message: `${tableLabels} ${occupiedTables.length > 1 ? "are" : "is"} currently occupied (${active.guest_name || "Guest"} — ${active.status.replace(/_/g, " ")}).`,
              suggestion: "Wait for the current party to finish or choose another table."
            })
          }
        }
      }
    }
  } catch { /* non-blocking */ }

  return warnings
}

// ─────────────────────────────────────────────────────────────
// 3. Warnings for STATUS CHANGES (check-in, seating, etc.)
// ─────────────────────────────────────────────────────────────
export async function getStatusChangeWarnings(
  booking: Booking,
  newStatus: string,
  restaurantId: string
): Promise<BookingWarning[]> {
  const warnings: BookingWarning[] = []
  const bookingTime = new Date(booking.booking_time)

  // --- 3a. Seating without assigned table ---
  if (newStatus === "seated" && (!booking.tables || booking.tables.length === 0)) {
    warnings.push({
      id: "seating_no_table",
      level: "critical",
      title: "No Table Assigned",
      message: "You're seating this guest without an assigned table.",
      suggestion: "Assign a table before or immediately after seating."
    })
  }

  // --- 3b. Check-in too early ---
  const minutesUntil = differenceInMinutes(bookingTime, new Date())
  if (newStatus === "arrived" && minutesUntil > 60) {
    warnings.push({
      id: "early_checkin",
      level: "info",
      title: "Early Check-In",
      message: `Guest arrived ${minutesUntil} minutes early (booking at ${format(bookingTime, "h:mm a")}).`,
      suggestion: "Table may not be ready yet. Consider having them wait."
    })
  }

  // --- 3c. No-show — guest had a deposit/guarantee ---
  if (newStatus === "no_show" && booking.booking_guarantee) {
    warnings.push({
      id: "no_show_has_guarantee",
      level: "warning",
      title: "Guest Has Deposit/Guarantee",
      message: "This booking has a deposit or guarantee on file.",
      suggestion: "Review your charge/refund policy before marking as no-show."
    })
  }

  // --- 3d. Completing service very quickly ---
  if (newStatus === "completed" && booking.seated_at) {
    const seatedMinutes = differenceInMinutes(new Date(), new Date(booking.seated_at))
    if (seatedMinutes < 30) {
      warnings.push({
        id: "quick_completion",
        level: "info",
        title: "Very Short Dining Time",
        message: `Guest has only been seated for ${seatedMinutes} minutes.`,
        suggestion: "Confirm service is actually complete."
      })
    }
  }

  return warnings
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Sort warnings by severity: critical → warning → info */
export function sortWarnings(warnings: BookingWarning[]): BookingWarning[] {
  const order: Record<WarningLevel, number> = { critical: 0, warning: 1, info: 2 }
  return [...warnings].sort((a, b) => order[a.level] - order[b.level])
}

/** Check if the warnings contain any critical-level warning */
export function hasCriticalWarning(warnings: BookingWarning[]): boolean {
  return warnings.some(w => w.level === "critical")
}

/** Filter only actionable warnings (warning + critical) */
export function getActionableWarnings(warnings: BookingWarning[]): BookingWarning[] {
  return warnings.filter(w => w.level !== "info")
}
