// Shared types extracted to break the circular dependency between
// TimeRangeSelector.tsx ↔ WaitlistConfirmationModal.tsx

export const TABLE_TYPES = {
  any: { label: "Any", icon: "🍽️", description: "No preference" },
  indoor: { label: "Indoor", icon: "🏠", description: "Indoor dining area" },
  outdoor: { label: "Outdoor", icon: "🌿", description: "Outdoor/patio dining" },
  bar: { label: "Bar", icon: "🍷", description: "Bar counter seating" },
  private: { label: "Private", icon: "🔒", description: "Private dining room" },
  standard: { label: "Standard", icon: "🪑", description: "Standard table" },
  booth: { label: "Booth", icon: "🛋️", description: "Cozy enclosed seating" },
  window: { label: "Window", icon: "🪟", description: "Tables with a view" },
  patio: { label: "Patio", icon: "🌿", description: "Outdoor patio" },
} as const;

export type TableType =
  | "any"
  | "indoor"
  | "outdoor"
  | "bar"
  | "private"
  | "standard"
  | "booth"
  | "window"
  | "patio";

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface TimeRangeSearchParams {
  timeRange: TimeRange;
  partySize: number;
  date: Date;
}
