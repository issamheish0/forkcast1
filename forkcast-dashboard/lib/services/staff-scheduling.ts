// Staff Scheduling Service - Direct Supabase calls
import { createClient } from "@/lib/supabase/client"
import type { 
  StaffSchedule, 
  StaffShift, 
  TimeClockEntry, 
  StaffAvailability, 
  TimeOffRequest, 
  StaffPosition, 
  StaffPositionAssignment 
} from "@/types"

export class StaffSchedulingService {
  private supabase = createClient()

  // ===============================
  // STAFF SCHEDULES
  // ===============================

  async getStaffSchedules(restaurantId: string) {
    const { data, error } = await this.supabase
      .from('staff_schedules')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        created_by_user:profiles!staff_schedules_created_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as StaffSchedule[]
  }

  async getStaffScheduleById(scheduleId: string) {
    const { data, error } = await this.supabase
      .from('staff_schedules')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        created_by_user:profiles!staff_schedules_created_by_fkey(
          id,
          full_name,
          email
        ),
        shifts:staff_shifts(
          *,
          staff:restaurant_staff(
            user:profiles!restaurant_staff_user_id_fkey(full_name, email)
          )
        )
      `)
      .eq('id', scheduleId)
      .single()

    if (error) throw error
    return data as StaffSchedule
  }

  async createStaffSchedule(schedule: Omit<StaffSchedule, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.supabase
      .from('staff_schedules')
      .insert([schedule])
      .select()
      .single()

    if (error) throw error
    return data as StaffSchedule
  }

  async updateStaffSchedule(scheduleId: string, updates: Partial<StaffSchedule>) {
    const { data, error } = await this.supabase
      .from('staff_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .select()
      .single()

    if (error) throw error
    return data as StaffSchedule
  }

  async deleteStaffSchedule(scheduleId: string) {
    const { error } = await this.supabase
      .from('staff_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)

    if (error) throw error
    return true
  }

  // ===============================
  // STAFF SHIFTS
  // ===============================

  async getStaffShifts(restaurantId: string, filters?: {
    staffId?: string
    startDate?: string
    endDate?: string
    status?: string
  }) {
    console.log('🔍 getStaffShifts called with:', restaurantId, filters)
    
    let query = this.supabase
      .from('staff_shifts')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        schedule:staff_schedules(
          id,
          name,
          schedule_type
        ),
        created_by_user:profiles!staff_shifts_created_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)

    if (filters?.staffId) {
      query = query.eq('staff_id', filters.staffId)
    }
    if (filters?.startDate) {
      query = query.gte('shift_date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('shift_date', filters.endDate)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query.order('shift_date', { ascending: true })

    console.log('🔍 getStaffShifts result:', { data, error })
    if (error) throw error
    return data as StaffShift[]
  }

  async getStaffShiftById(shiftId: string) {
    const { data, error } = await this.supabase
      .from('staff_shifts')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        schedule:staff_schedules(
          id,
          name,
          schedule_type
        ),
        time_clock_entries(*)
      `)
      .eq('id', shiftId)
      .single()

    if (error) throw error
    return data as StaffShift
  }

  async createStaffShift(shift: Omit<StaffShift, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.supabase
      .from('staff_shifts')
      .insert([shift])
      .select()
      .single()

    if (error) throw error
    return data as StaffShift
  }

  async updateStaffShift(shiftId: string, updates: Partial<StaffShift>) {
    const { data, error } = await this.supabase
      .from('staff_shifts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', shiftId)
      .select()
      .single()

    if (error) throw error
    return data as StaffShift
  }

  async deleteStaffShift(shiftId: string) {
    const { error } = await this.supabase
      .from('staff_shifts')
      .delete()
      .eq('id', shiftId)

    if (error) throw error
    return true
  }

  async bulkCreateStaffShifts(shifts: Omit<StaffShift, 'id' | 'created_at' | 'updated_at'>[]) {
    const { data, error } = await this.supabase
      .from('staff_shifts')
      .insert(shifts)
      .select()

    if (error) throw error
    return data as StaffShift[]
  }

  // ===============================
  // TIME CLOCK ENTRIES
  // ===============================

  async getCurrentTimeClockEntry(staffId: string) {
    const { data, error } = await this.supabase
      .from('time_clock_entries')
      .select(`
        *,
        staff:restaurant_staff(
          user:profiles!restaurant_staff_user_id_fkey(full_name, email)
        ),
        shift:staff_shifts(
          shift_date,
          start_time,
          end_time,
          role,
          station
        )
      `)
      .eq('staff_id', staffId)
      .eq('status', 'active')
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)

    if (error) throw error
    return data?.[0] as TimeClockEntry | null
  }

  async getTimeClockEntries(restaurantId: string, filters?: {
    staffId?: string
    startDate?: string
    endDate?: string
    status?: string
  }) {
    console.log('🔍 getTimeClockEntries called with:', restaurantId, filters)
    
    let query = this.supabase
      .from('time_clock_entries')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        shift:staff_shifts(
          id,
          shift_date,
          start_time,
          end_time,
          role,
          station
        ),
        approved_by_user:profiles!time_clock_entries_approved_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)

    if (filters?.staffId) {
      query = query.eq('staff_id', filters.staffId)
    }
    if (filters?.startDate) {
      query = query.gte('clock_in_time', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('clock_in_time', filters.endDate)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query.order('clock_in_time', { ascending: false })

    console.log('🔍 getTimeClockEntries result:', { data, error })
    if (error) throw error
    return data as TimeClockEntry[]
  }

  async clockIn(entry: Omit<TimeClockEntry, 'id' | 'created_at' | 'updated_at' | 'clock_out_time' | 'total_hours' | 'gross_pay'>) {
    const { data, error } = await this.supabase
      .from('time_clock_entries')
      .insert([{
        ...entry,
        status: 'active'
      }])
      .select()
      .single()

    if (error) throw error
    return data as TimeClockEntry
  }

  async clockOut(entryId: string, notes?: string) {
    const clockOutTime = new Date().toISOString()
    
    // Get the entry to calculate hours
    const { data: entry, error: fetchError } = await this.supabase
      .from('time_clock_entries')
      .select('clock_in_time, total_break_minutes, shift:staff_shifts(hourly_rate)')
      .eq('id', entryId)
      .single()

    if (fetchError) throw fetchError

    const clockInTime = new Date(entry.clock_in_time)
    const clockOutTimeDate = new Date(clockOutTime)
    const totalMinutes = Math.floor((clockOutTimeDate.getTime() - clockInTime.getTime()) / (1000 * 60))
    const workMinutes = totalMinutes - (entry.total_break_minutes || 0)
    const totalHours = Number((workMinutes / 60).toFixed(2))

    // Calculate overtime (assuming 8 hours is regular time)
    const regularHours = Math.min(totalHours, 8)
    const overtimeHours = Math.max(0, totalHours - 8)

    // Calculate gross pay if hourly rate is available
    let grossPay = null
    const shiftInfo: any = Array.isArray(entry.shift) ? entry.shift[0] : entry.shift
    if (shiftInfo?.hourly_rate) {
      grossPay = Number((regularHours * shiftInfo.hourly_rate + overtimeHours * shiftInfo.hourly_rate * 1.5).toFixed(2))
    }

    const { data, error } = await this.supabase
      .from('time_clock_entries')
      .update({
        clock_out_time: clockOutTime,
        total_hours: totalHours,
        overtime_hours: overtimeHours,
        gross_pay: grossPay,
        notes,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select()
      .single()

    if (error) throw error
    return data as TimeClockEntry
  }

  async startBreak(entryId: string) {
    const { data, error } = await this.supabase
      .from('time_clock_entries')
      .update({
        break_start_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select()
      .single()

    if (error) throw error
    return data as TimeClockEntry
  }

  async endBreak(entryId: string) {
    // Get current break start time
    const { data: entry, error: fetchError } = await this.supabase
      .from('time_clock_entries')
      .select('break_start_time, total_break_minutes')
      .eq('id', entryId)
      .single()

    if (fetchError) throw fetchError

    const breakEndTime = new Date()
    const breakStartTime = new Date(entry.break_start_time!)
    const breakDuration = Math.floor((breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60))
    const totalBreakMinutes = (entry.total_break_minutes || 0) + breakDuration

    const { data, error } = await this.supabase
      .from('time_clock_entries')
      .update({
        break_end_time: breakEndTime.toISOString(),
        total_break_minutes: totalBreakMinutes,
        break_start_time: null, // Clear break start time
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select()
      .single()

    if (error) throw error
    return data as TimeClockEntry
  }

  async approveTimeClockEntry(entryId: string, approvedBy: string) {
    const { data, error } = await this.supabase
      .from('time_clock_entries')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select()
      .single()

    if (error) throw error
    return data as TimeClockEntry
  }

  // ===============================
  // STAFF AVAILABILITY
  // ===============================

  async getStaffAvailability(restaurantId: string, staffId?: string) {
    let query = this.supabase
      .from('staff_availability')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        )
      `)
      .eq('restaurant_id', restaurantId)

    if (staffId) {
      query = query.eq('staff_id', staffId)
    }

    const { data, error } = await query.order('day_of_week', { ascending: true })

    if (error) throw error
    return data as StaffAvailability[]
  }

  async createStaffAvailability(availability: Omit<StaffAvailability, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.supabase
      .from('staff_availability')
      .insert([availability])
      .select()
      .single()

    if (error) throw error
    return data as StaffAvailability
  }

  async updateStaffAvailability(availabilityId: string, updates: Partial<StaffAvailability>) {
    const { data, error } = await this.supabase
      .from('staff_availability')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', availabilityId)
      .select()
      .single()

    if (error) throw error
    return data as StaffAvailability
  }

  async deleteStaffAvailability(availabilityId: string) {
    const { error } = await this.supabase
      .from('staff_availability')
      .delete()
      .eq('id', availabilityId)

    if (error) throw error
    return true
  }

  async bulkUpdateStaffAvailability(staffId: string, availability: Omit<StaffAvailability, 'id' | 'created_at' | 'updated_at'>[]) {
    // Delete existing availability for this staff member
    await this.supabase
      .from('staff_availability')
      .delete()
      .eq('staff_id', staffId)
      .eq('recurring', true)

    // Insert new availability
    const { data, error } = await this.supabase
      .from('staff_availability')
      .insert(availability)
      .select()

    if (error) throw error
    return data as StaffAvailability[]
  }

  // ===============================
  // TIME OFF REQUESTS
  // ===============================

  async getTimeOffRequests(restaurantId: string, filters?: {
    staffId?: string
    status?: string
    startDate?: string
    endDate?: string
  }) {
    let query = this.supabase
      .from('time_off_requests')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        approved_by_user:profiles!time_off_requests_approved_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)

    if (filters?.staffId) {
      query = query.eq('staff_id', filters.staffId)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.startDate) {
      query = query.gte('start_date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('end_date', filters.endDate)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data as TimeOffRequest[]
  }

  async createTimeOffRequest(request: Omit<TimeOffRequest, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.supabase
      .from('time_off_requests')
      .insert([{ ...request, status: 'pending' }])
      .select()
      .single()

    if (error) throw error
    return data as TimeOffRequest
  }

  async updateTimeOffRequest(requestId: string, updates: Partial<TimeOffRequest>) {
    const { data, error } = await this.supabase
      .from('time_off_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw error
    return data as TimeOffRequest
  }

  async approveTimeOffRequest(requestId: string, approvedBy: string) {
    const { data, error } = await this.supabase
      .from('time_off_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw error
    return data as TimeOffRequest
  }

  async denyTimeOffRequest(requestId: string, approvedBy: string, denialReason: string) {
    const { data, error } = await this.supabase
      .from('time_off_requests')
      .update({
        status: 'denied',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        denial_reason: denialReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw error
    return data as TimeOffRequest
  }

  // ===============================
  // STAFF POSITIONS
  // ===============================

  async getStaffPositions(restaurantId: string) {
    const { data, error } = await this.supabase
      .from('staff_positions')
      .select(`
        *,
        assignments:staff_position_assignments(
          staff:restaurant_staff(
            user:profiles!restaurant_staff_user_id_fkey(full_name)
          )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    
    // Add staff count to each position
    return data.map(position => ({
      ...position,
      staff_count: position.assignments?.length || 0
    })) as StaffPosition[]
  }

  async createStaffPosition(position: Omit<StaffPosition, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.supabase
      .from('staff_positions')
      .insert([position])
      .select()
      .single()

    if (error) throw error
    return data as StaffPosition
  }

  async updateStaffPosition(positionId: string, updates: Partial<StaffPosition>) {
    const { data, error } = await this.supabase
      .from('staff_positions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', positionId)
      .select()
      .single()

    if (error) throw error
    return data as StaffPosition
  }

  async deleteStaffPosition(positionId: string) {
    const { error } = await this.supabase
      .from('staff_positions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', positionId)

    if (error) throw error
    return true
  }

  // ===============================
  // STAFF POSITION ASSIGNMENTS
  // ===============================

  async getStaffPositionAssignments(staffId: string) {
    const { data, error } = await this.supabase
      .from('staff_position_assignments')
      .select(`
        *,
        position:staff_positions(*)
      `)
      .eq('staff_id', staffId)

    if (error) throw error
    return data as StaffPositionAssignment[]
  }

  async assignStaffToPosition(assignment: Omit<StaffPositionAssignment, 'id' | 'created_at'>) {
    const { data, error } = await this.supabase
      .from('staff_position_assignments')
      .insert([assignment])
      .select()
      .single()

    if (error) throw error
    return data as StaffPositionAssignment
  }

  async updateStaffPositionAssignment(assignmentId: string, updates: Partial<StaffPositionAssignment>) {
    const { data, error } = await this.supabase
      .from('staff_position_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) throw error
    return data as StaffPositionAssignment
  }

  async removeStaffFromPosition(assignmentId: string) {
    const { error } = await this.supabase
      .from('staff_position_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) throw error
    return true
  }

  // ===============================
  // HELPER METHODS
  // ===============================

  async getRestaurantStaff(restaurantId: string) {
    console.log('🔍 getRestaurantStaff called with:', restaurantId)
    
    const { data, error } = await this.supabase
      .from('restaurant_staff')
      .select(`
        id,
        restaurant_id,
        user_id,
        role,
        permissions,
        is_active,
        created_at,
        user:profiles!restaurant_staff_user_id_fkey(
          id,
          full_name,
          email,
          phone_number,
          avatar_url
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    console.log('🔍 getRestaurantStaff result:', { data, error })

    if (error) throw error
    // Normalize: ensure 'user' is a single object (not array)
    return (data || []).map((row: any) => ({
      ...row,
      user: Array.isArray(row.user) ? row.user[0] : row.user
    }))
  }

  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    if (error) throw error
    return user
  }

  async getCurrentStaffMember(restaurantId: string) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await this.supabase
      .from('restaurant_staff')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return data
  }
}

// Export singleton instance
export const staffSchedulingService = new StaffSchedulingService()
