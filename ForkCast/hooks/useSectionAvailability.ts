// hooks/useSectionAvailability.ts — Mock stub
export interface SectionAvailabilityInfo {
  section_id: string;
  section_name: string;
  total_tables: number;
  available_tables: number;
  has_matching_tables: boolean;
}

export function useSectionAvailability(
  _restaurantId: string | undefined,
  _selectedDate: Date | undefined,
  _selectedTime: string | undefined,
  _partySize: number,
  _turnTime: number = 120,
) {
  return {
    sectionAvailability: new Map<string, SectionAvailabilityInfo>(),
    loading: false,
    error: null as string | null,
    refresh: async () => {},
    allSectionsFull: false,
  };
}