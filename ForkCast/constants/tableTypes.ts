// Table type definitions matching the database enum exactly
export const TABLE_TYPE_OPTIONS = {
  any: { label: "Any", icon: "🍽️", description: "No preference" },
  booth: { label: "Booth", icon: "🛋️", description: "Cozy enclosed seating" },
  window: { label: "Window", icon: "🪟", description: "Tables with a view" },
  patio: { label: "Patio", icon: "🌿", description: "Outdoor dining" },
  standard: {
    label: "Standard",
    icon: "🪑",
    description: "Regular table seating",
  },
  bar: { label: "Bar", icon: "🍷", description: "Bar counter seating" },
  private: { label: "Private", icon: "🔒", description: "Private dining room" },
} as const;

// Database enum values - exact match with database table_type enum
export type TableType =
  | "any"
  | "booth"
  | "window"
  | "patio"
  | "standard"
  | "bar"
  | "private";

// Array of all valid table types for iteration
export const TABLE_TYPES_ARRAY: readonly TableType[] = [
  "any",
  "booth",
  "window",
  "patio",
  "standard",
  "bar",
  "private",
] as const;
