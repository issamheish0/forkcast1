#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createSampleStaffData() {
  console.log('🚀 Creating sample staff and schedule data...')

  try {
    // First, let's check if we have any restaurants
    const { data: restaurants, error: restError } = await supabase
      .from('restaurants')
      .select('id, name')
      .limit(1)

    if (restError) {
      console.error('Error fetching restaurants:', restError)
      return
    }

    if (!restaurants || restaurants.length === 0) {
      console.log('❌ No restaurants found. Please create a restaurant first.')
      return
    }

    const restaurant = restaurants[0]
    console.log(`📍 Using restaurant: ${restaurant.name} (${restaurant.id})`)

    // Check if we have any profiles/users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .limit(5)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return
    }

    if (!profiles || profiles.length === 0) {
      console.log('❌ No user profiles found. Please create user accounts first.')
      return
    }

    console.log(`👥 Found ${profiles.length} user profiles`)

    // Create restaurant staff entries
    const staffData = profiles.map((profile, index) => ({
      restaurant_id: restaurant.id,
      user_id: profile.id,
      role: index === 0 ? 'manager' : 'staff',
      permissions: index === 0 
        ? ['schedules.view', 'schedules.manage', 'staff.view', 'staff.manage']
        : ['schedules.view'],
      is_active: true,
      hired_at: new Date().toISOString(),
      created_by: profile.id
    }))

    console.log('👷 Creating restaurant staff entries...')
    const { data: staffMembers, error: staffError } = await supabase
      .from('restaurant_staff')
      .upsert(staffData, { onConflict: 'user_id,restaurant_id' })
      .select('id, user_id, role')

    if (staffError) {
      console.error('Error creating staff:', staffError)
      return
    }

    console.log(`✅ Created ${staffMembers?.length || 0} staff members`)

    // Create some sample shifts for this week
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)

    const shifts = []
    for (let day = 0; day < 7; day++) {
      const shiftDate = new Date(weekStart)
      shiftDate.setDate(weekStart.getDate() + day)
      
      // Create 2-3 shifts per day
      for (let i = 0; i < Math.min(staffMembers?.length || 0, 3); i++) {
        const staff = staffMembers![i]
        const startHour = 8 + (i * 3) // 8am, 11am, 2pm
        const endHour = Math.min(startHour + 6, 22) // 6-hour shifts, max until 10pm
        
        shifts.push({
          restaurant_id: restaurant.id,
          staff_id: staff.id,
          shift_date: shiftDate.toISOString().split('T')[0],
          start_time: `${startHour.toString().padStart(2, '0')}:00:00`,
          end_time: `${endHour.toString().padStart(2, '0')}:00:00`,
          role: staff.role === 'manager' ? 'Manager' : ['Server', 'Cook', 'Host'][i % 3],
          station: ['Front', 'Kitchen', 'Bar'][i % 3],
          status: 'scheduled',
          hourly_rate: staff.role === 'manager' ? 25.00 : 15.00,
          created_by: staff.user_id
        })
      }
    }

    console.log('📅 Creating sample shifts...')
    const { data: createdShifts, error: shiftsError } = await supabase
      .from('staff_shifts')
      .insert(shifts)
      .select('id, staff_id, shift_date, start_time')

    if (shiftsError) {
      console.error('Error creating shifts:', shiftsError)
      return
    }

    console.log(`✅ Created ${createdShifts?.length || 0} shifts`)

    // Create some sample time clock entries (some active, some completed)
    const timeClockEntries = []
    
    // Create 1-2 active clock-ins for today
    const todayShifts = createdShifts?.filter(shift => 
      shift.shift_date === today.toISOString().split('T')[0]
    ) || []

    for (let i = 0; i < Math.min(2, todayShifts.length); i++) {
      const shift = todayShifts[i]
      const clockInTime = new Date()
      clockInTime.setHours(9 + (i * 4), 0, 0, 0) // 9am, 1pm
      
      timeClockEntries.push({
        restaurant_id: restaurant.id,
        staff_id: shift.staff_id,
        shift_id: shift.id,
        clock_in_time: clockInTime.toISOString(),
        status: 'active',
        total_break_minutes: 0,
        overtime_hours: 0
      })
    }

    // Create some completed entries from yesterday
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    
    const yesterdayShifts = createdShifts?.filter(shift => 
      shift.shift_date === yesterday.toISOString().split('T')[0]
    ) || []

    for (const shift of yesterdayShifts) {
      const clockInTime = new Date(yesterday)
      clockInTime.setHours(9, 0, 0, 0)
      
      const clockOutTime = new Date(yesterday)
      clockOutTime.setHours(17, 0, 0, 0)
      
      const totalHours = 8
      const grossPay = totalHours * 15 // $15/hour
      
      timeClockEntries.push({
        restaurant_id: restaurant.id,
        staff_id: shift.staff_id,
        shift_id: shift.id,
        clock_in_time: clockInTime.toISOString(),
        clock_out_time: clockOutTime.toISOString(),
        total_hours: totalHours,
        total_break_minutes: 30,
        overtime_hours: 0,
        gross_pay: grossPay,
        status: 'completed'
      })
    }

    if (timeClockEntries.length > 0) {
      console.log('⏰ Creating sample time clock entries...')
      const { data: clockEntries, error: clockError } = await supabase
        .from('time_clock_entries')
        .insert(timeClockEntries)
        .select('id, status')

      if (clockError) {
        console.error('Error creating time clock entries:', clockError)
        return
      }

      const activeEntries = clockEntries?.filter(e => e.status === 'active').length || 0
      const completedEntries = clockEntries?.filter(e => e.status === 'completed').length || 0
      
      console.log(`✅ Created ${clockEntries?.length || 0} time clock entries`)
      console.log(`   - ${activeEntries} active clock-ins`)
      console.log(`   - ${completedEntries} completed entries`)
    }

    console.log('\n🎉 Sample staff data created successfully!')
    console.log('📊 Summary:')
    console.log(`   - Restaurant: ${restaurant.name}`)
    console.log(`   - Staff members: ${staffMembers?.length || 0}`)
    console.log(`   - Shifts created: ${createdShifts?.length || 0}`)
    console.log(`   - Time clock entries: ${timeClockEntries.length}`)

  } catch (error) {
    console.error('❌ Error creating sample data:', error)
  }
}

// Run the script
createSampleStaffData().then(() => {
  console.log('\n✨ Done!')
  process.exit(0)
}).catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})
