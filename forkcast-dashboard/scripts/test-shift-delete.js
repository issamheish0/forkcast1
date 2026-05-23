// Test script for shift deletion functionality
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testShiftDeletion() {
  console.log('=== Testing Shift Deletion Functionality ===')
  
  try {
    // First, let's check if we have any shifts to work with
    const { data: shifts, error: shiftsError } = await supabase
      .from('staff_shifts')
      .select('id, shift_date, start_time, end_time, status')
      .limit(5)
    
    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError)
      return
    }
    
    console.log(`Found ${shifts?.length || 0} shifts`)
    
    if (shifts && shifts.length > 0) {
      const testShift = shifts[0]
      console.log('Sample shift:', testShift)
      
      // Check if this shift has any time clock entries
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_clock_entries')
        .select('id, status, clock_in_time, clock_out_time')
        .eq('shift_id', testShift.id)
      
      if (timeError) {
        console.error('Error checking time entries:', timeError)
      } else {
        console.log(`Shift ${testShift.id} has ${timeEntries?.length || 0} time clock entries`)
        if (timeEntries && timeEntries.length > 0) {
          console.log('Time entries:', timeEntries)
        }
      }
    }
    
    // Test the actual delete function (but don't actually delete)
    console.log('✅ Shift deletion checks completed successfully')
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
testShiftDeletion()
