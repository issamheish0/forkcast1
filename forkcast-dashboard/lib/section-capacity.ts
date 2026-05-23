// lib/section-capacity.ts — Section capacity calculation helpers
import { createClient } from "@/lib/supabase/client"
import { startOfDay, endOfDay } from "date-fns"
import type { RestaurantSection, RestaurantTable } from "@/types"

export interface CapacityInfo {
  currentCovers: number
  seatedCovers: number
  bookedCovers: number
  maxCovers: number
  percentage: number
  isManualOverride: boolean
}

export interface CapacityImpact {
  wouldExceed: boolean
  currentCovers: number
  maxCovers: number
  percentage: number
  afterPercentage: number
  alternativeSections: AlternativeSection[]
}

export interface AlternativeSection {
  section: RestaurantSection
  availableCovers: number
  maxCovers: number
  percentage: number
}

/**
 * Compute max covers for a section: manual override or sum of table max_capacity
 */
export function getSectionMaxCovers(
  section: RestaurantSection,
  tables: RestaurantTable[]
): { maxCovers: number; isManualOverride: boolean } {
  if (section.max_covers != null) {
    return { maxCovers: section.max_covers, isManualOverride: true }
  }
  const sectionTables = tables.filter(t => t.section_id === section.id && t.is_active !== false)
  const computed = sectionTables.reduce((sum, t) => sum + (t.max_capacity || t.capacity || 0), 0)
  return { maxCovers: computed, isManualOverride: false }
}

const ACTIVE_BOOKING_STATUSES = [
  "confirmed", "arrived", "seated", "ordered",
  "appetizers", "main_course", "dessert", "payment"
]

const PHYSICALLY_PRESENT_STATUSES = [
  "arrived", "seated", "ordered",
  "appetizers", "main_course", "dessert", "payment"
]

export interface CoversSplit {
  seatedCovers: number
  bookedCovers: number
  totalCovers: number
}

/**
 * Count current covers for a section at a given date/time, split by presence.
 * - seatedCovers: guests physically present (arrived + dining statuses)
 * - bookedCovers: confirmed reservations not yet arrived
 * - totalCovers: sum of both
 * Filters by restaurant_id for multi-tenant isolation and by date at DB level.
 */
export async function getSectionCurrentCovers(
  sectionId: string,
  restaurantId: string,
  date: Date,
  timeSlot?: string
): Promise<CoversSplit> {
  const supabase = createClient()
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  // Get tables in this section
  const { data: sectionTables } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("section_id", sectionId)
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)

  if (!sectionTables || sectionTables.length === 0) return { seatedCovers: 0, bookedCovers: 0, totalCovers: 0 }
  const tableIds = sectionTables.map(t => t.id)

  // Get active bookings for this date, scoped to restaurant
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id, party_size, booking_time, turn_time_minutes, status,
      tables:booking_tables(table_id)
    `)
    .eq("restaurant_id", restaurantId)
    .gte("booking_time", dayStart.toISOString())
    .lte("booking_time", dayEnd.toISOString())
    .in("status", ACTIVE_BOOKING_STATUSES)

  if (!bookings) return { seatedCovers: 0, bookedCovers: 0, totalCovers: 0 }

  let seatedCovers = 0
  let bookedCovers = 0

  for (const booking of bookings) {
    // Check if any of the booking's tables are in this section
    const bookingTableIds = (booking.tables as any[])?.map((bt: any) => bt.table_id) || []
    const isInSection = bookingTableIds.some((tid: string) => tableIds.includes(tid))
    if (!isInSection) continue

    // If timeSlot provided, check if booking overlaps
    if (timeSlot) {
      const [h, m] = timeSlot.split(":").map(Number)
      const slotMinutes = h * 60 + m
      const bookingTime = new Date(booking.booking_time)
      const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()
      const turnTime = booking.turn_time_minutes || 90
      const bookingEndMin = bookingStartMin + turnTime

      if (slotMinutes < bookingStartMin || slotMinutes >= bookingEndMin) continue
    }

    const covers = booking.party_size
    if (PHYSICALLY_PRESENT_STATUSES.includes(booking.status)) {
      seatedCovers += covers
    } else if (booking.status === 'confirmed') {
      bookedCovers += covers
    }
  }

  return { seatedCovers, bookedCovers, totalCovers: seatedCovers + bookedCovers }
}

/**
 * Check the capacity impact of adding a booking to a section.
 * Uses Promise.all for alternative section lookups to avoid N+1 sequential queries.
 */
export async function checkCapacityImpact(
  sectionId: string,
  partySize: number,
  date: Date,
  timeSlot: string,
  restaurantId: string,
  allSections: RestaurantSection[],
  allTables: RestaurantTable[]
): Promise<CapacityImpact> {
  const section = allSections.find(s => s.id === sectionId)
  if (!section) {
    return {
      wouldExceed: false,
      currentCovers: 0,
      maxCovers: 0,
      percentage: 0,
      afterPercentage: 0,
      alternativeSections: [],
    }
  }

  const { totalCovers: currentCovers } = await getSectionCurrentCovers(sectionId, restaurantId, date, timeSlot)
  const { maxCovers } = getSectionMaxCovers(section, allTables)
  const afterCovers = currentCovers + partySize
  const percentage = maxCovers > 0 ? Math.round((currentCovers / maxCovers) * 100) : 0
  const afterPercentage = maxCovers > 0 ? Math.round((afterCovers / maxCovers) * 100) : 0
  const wouldExceed = maxCovers > 0 && afterCovers > maxCovers

  // Find alternative sections with available capacity (parallel lookups)
  let alternativeSections: AlternativeSection[] = []
  if (wouldExceed || afterPercentage > 90) {
    const otherSections = allSections.filter(s => s.id !== sectionId && s.is_active)

    const results = await Promise.all(
      otherSections.map(async (s) => {
        const { totalCovers: covers } = await getSectionCurrentCovers(s.id, restaurantId, date, timeSlot)
        const { maxCovers: sMaxCovers } = getSectionMaxCovers(s, allTables)
        return { section: s, covers, maxCovers: sMaxCovers }
      })
    )

    alternativeSections = results
      .filter(r => r.maxCovers - r.covers >= partySize)
      .map(r => ({
        section: r.section,
        availableCovers: r.maxCovers - r.covers,
        maxCovers: r.maxCovers,
        percentage: r.maxCovers > 0 ? Math.round((r.covers / r.maxCovers) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage)
  }

  return {
    wouldExceed,
    currentCovers,
    maxCovers,
    percentage,
    afterPercentage,
    alternativeSections,
  }
}

/**
 * Get capacity color based on percentage
 */
export function getCapacityColor(percentage: number): "green" | "amber" | "red" {
  if (percentage < 75) return "green"
  if (percentage <= 90) return "amber"
  return "red"
}

export function getCapacityColorClass(percentage: number): string {
  const color = getCapacityColor(percentage)
  switch (color) {
    case "green": return "text-green-600"
    case "amber": return "text-amber-600"
    case "red": return "text-red-600"
  }
}

export function getCapacityBgClass(percentage: number): string {
  const color = getCapacityColor(percentage)
  switch (color) {
    case "green": return "bg-green-100 text-green-700"
    case "amber": return "bg-amber-100 text-amber-700"
    case "red": return "bg-red-100 text-red-700"
  }
}
