// lib/AvailabilityService.ts — No-op stub for mock/frontend-only mode

export interface TimeSlot {
  time: string;
  available: boolean;
  tables?: any[];
  requiresCombination?: boolean;
  totalCapacity?: number;
}

export interface TimeSlotBasic {
  time: string;
  available: boolean;
  isWaitlistTime?: boolean;
}

export interface AvailabilityError {
  type: "closure" | "general";
  message: string;
  closureReason?: string;
}

export interface TableOptionTable {
  id: string;
  table_number: string;
  capacity: number;
  table_type: string;
}

export interface TableOption {
  id: string;
  experienceTitle: string;
  experienceDescription: string;
  tableTypes: string[];
  requiresCombination: boolean;
  totalCapacity: number;
  isPerfectFit: boolean;
  tables: TableOptionTable[];
  combinedCapacity?: number;
}

export interface SlotTableOptions {
  time: string;
  options: TableOption[];
  primaryOption: TableOption;
}

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  table_type: string;
}

export class AvailabilityService {
  private static instance: AvailabilityService;

  static getInstance(): AvailabilityService {
    if (!AvailabilityService.instance) {
      AvailabilityService.instance = new AvailabilityService();
    }
    return AvailabilityService.instance;
  }

  async getAvailableTimeSlots(_params: any): Promise<TimeSlotBasic[]> {
    return [];
  }

  async getSlotTableOptions(_params: any): Promise<SlotTableOptions | null> {
    return null;
  }

  async searchTimeRange(_params: any): Promise<any[]> {
    return [];
  }

  async preloadPopularSlots(_restaurantId: string, _partySizes: number[]): Promise<void> {}

  async checkAvailability(_params: any): Promise<boolean> {
    return false;
  }

  clearCache(_restaurantId?: string): void {}
}