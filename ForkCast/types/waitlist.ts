// Database enum types - exact match with PostgreSQL enums

// table_type enum from database: {any,indoor,outdoor,bar,private}
export type TableType =
  | "any"
  | "indoor"
  | "outdoor"
  | "bar"
  | "private"
  | "booth"
  | "window"
  | "patio"
  | "standard";

// waiting_status enum from database: {active,notified,booked,expired,cancelled}
export type WaitingStatus =
  | "active"
  | "notified"
  | "booked"
  | "expired"
  | "cancelled";

// Table type display information
export const TABLE_TYPE_INFO = {
  any: { label: "Any", icon: "🍽️", description: "No preference" },
  indoor: { label: "Indoor", icon: "🏠", description: "Indoor seating area" },
  outdoor: {
    label: "Outdoor",
    icon: "🌿",
    description: "Outdoor dining/patio",
  },
  bar: { label: "Bar", icon: "🍷", description: "Bar counter seating" },
  private: { label: "Private", icon: "🔒", description: "Private dining room" },
  booth: { label: "Booth", icon: "🛋️", description: "Booth seating" },
  window: { label: "Window", icon: "🪟", description: "Table by the window" },
  patio: { label: "Patio", icon: "🌴", description: "Patio seating" },
  standard: { label: "Standard", icon: "🪑", description: "Standard table" },
} as const;

// Array of all valid table types for iteration
export const TABLE_TYPES_ARRAY: readonly TableType[] = [
  "any",
  "indoor",
  "outdoor",
  "bar",
  "private",
  "booth",
  "window",
  "patio",
  "standard",
] as const;

// Array of all valid waiting statuses
export const WAITING_STATUSES_ARRAY: readonly WaitingStatus[] = [
  "active",
  "notified",
  "booked",
  "expired",
  "cancelled",
] as const;
