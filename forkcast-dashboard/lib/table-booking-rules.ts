// lib/table-booking-rules.ts — Table booking rules evaluation engine
import type {
  TableBookingRule,
  TableBookingCondition,
  PartySizeCondition,
  DayOfWeekCondition,
  TimeRangeCondition,
  DateRangeCondition,
} from "@/types"

export interface BookingContext {
  partySize: number
  date: string   // "YYYY-MM-DD"
  time: string   // "HH:mm"
  dayOfWeek: number // 0=Sun, 1=Mon, ..., 6=Sat
}

/**
 * Evaluate all rules for a table and determine the booking type.
 * Rules are evaluated by priority (highest first), first match wins.
 * Falls back to the table's `default_booking_type` if no rule matches.
 */
export function evaluateTableBookingType(
  rules: TableBookingRule[],
  context: BookingContext,
  tableDefaultBookingType: "instant" | "request" = "request"
): { bookingType: "instant" | "request"; matchedRule: TableBookingRule | null } {
  // Sort by priority descending (highest priority first)
  const activeRules = rules
    .filter(r => r.is_active)
    .sort((a, b) => b.priority - a.priority)

  for (const rule of activeRules) {
    if (evaluateAllConditions(rule.conditions, context)) {
      return { bookingType: rule.booking_type, matchedRule: rule }
    }
  }

  // No rule matched — fall back to the table's own default_booking_type
  return { bookingType: tableDefaultBookingType, matchedRule: null }
}

/**
 * Evaluate ALL conditions (AND logic) — all must pass for the rule to match
 */
function evaluateAllConditions(
  conditions: TableBookingCondition[],
  context: BookingContext
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(condition => evaluateCondition(condition, context))
}

/**
 * Evaluate a single condition against the booking context
 */
export function evaluateCondition(
  condition: TableBookingCondition,
  context: BookingContext
): boolean {
  switch (condition.type) {
    case "party_size":
      return evaluatePartySizeCondition(condition, context.partySize)
    case "day_of_week":
      return evaluateDayOfWeekCondition(condition, context.dayOfWeek)
    case "time_range":
      return evaluateTimeRangeCondition(condition, context.time)
    case "date_range":
      return evaluateDateRangeCondition(condition, context.date)
    default:
      return true // Unknown condition types are permissive
  }
}

function evaluatePartySizeCondition(
  condition: PartySizeCondition,
  partySize: number
): boolean {
  switch (condition.operator) {
    case "gte": return partySize >= condition.value
    case "lte": return partySize <= condition.value
    case "eq": return partySize === condition.value
    default: return true
  }
}

function evaluateDayOfWeekCondition(
  condition: DayOfWeekCondition,
  dayOfWeek: number
): boolean {
  return condition.days.includes(dayOfWeek)
}

function evaluateTimeRangeCondition(
  condition: TimeRangeCondition,
  time: string
): boolean {
  const timeMinutes = timeToMinutes(time)
  const startMinutes = timeToMinutes(condition.start)
  const endMinutes = timeToMinutes(condition.end)

  // Handle overnight ranges (e.g., 22:00-02:00)
  if (endMinutes <= startMinutes) {
    return timeMinutes >= startMinutes || timeMinutes < endMinutes
  }
  return timeMinutes >= startMinutes && timeMinutes < endMinutes
}

function evaluateDateRangeCondition(
  condition: DateRangeCondition,
  date: string
): boolean {
  return date >= condition.start && date <= condition.end
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m || 0)
}

/**
 * For multi-table bookings, use the most restrictive rule.
 * If ANY table requires 'request', the whole booking is 'request'.
 * tableDefaultsMap provides each table's default_booking_type for fallback.
 */
export function evaluateMultiTableBookingType(
  tableRulesMap: Map<string, TableBookingRule[]>,
  context: BookingContext,
  tableDefaultsMap: Map<string, "instant" | "request">
): "instant" | "request" {
  let isRequest = false

  for (const [tableId, rules] of tableRulesMap) {
    const tableDefault = tableDefaultsMap.get(tableId) || "request"
    const { bookingType } = evaluateTableBookingType(rules, context, tableDefault)
    if (bookingType === "request") {
      isRequest = true
      break
    }
  }

  return isRequest ? "request" : "instant"
}

/**
 * Determine booking type for a set of tables.
 * Checks rules first, then falls back to each table's default_booking_type.
 * If ANY table in the section resolves to 'instant', booking is instant.
 * Otherwise defaults to 'request'.
 */
export function evaluateSectionBookingType(
  tables: Array<{ id: string; default_booking_type: "instant" | "request" }>,
  rulesMap: Map<string, TableBookingRule[]>,
  context: BookingContext
): "instant" | "request" {
  for (const table of tables) {
    const rules = rulesMap.get(table.id) || []
    const { bookingType } = evaluateTableBookingType(rules, context, table.default_booking_type)
    if (bookingType === "instant") {
      return "instant"
    }
  }
  return "request"
}

/**
 * Get a human-readable summary of a condition
 */
export function getConditionSummary(condition: TableBookingCondition): string {
  switch (condition.type) {
    case "party_size": {
      const ops = { gte: ">=", lte: "<=", eq: "=" } as const
      return `Party ${ops[condition.operator] || "="} ${condition.value}`
    }
    case "day_of_week": {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const days = condition.days.map(d => dayNames[d] || "?").join(", ")
      return days
    }
    case "time_range":
      return `${condition.start}-${condition.end}`
    case "date_range":
      return `${condition.start} to ${condition.end}`
    default:
      return "Unknown"
  }
}
