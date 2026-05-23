import { createClient } from '@supabase/supabase-js';

// Service role client for testing
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testFullFlow() {
  console.log('=== Testing full scheduling system ===');
  
  const restaurantId = '660e8400-e29b-41d4-a716-446655440001';
  const staffId = '36f61a76-7561-4ebd-b61a-4b118d8a0191';
  
  // 1. Check current time clock entries
  console.log('\n1. Current time clock entries:');
  const { data: currentEntries, error: currentError } = await supabaseAdmin
    .from('time_clock_entries')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('clock_in_time', { ascending: false });
    
  console.log('Current entries:', currentEntries?.length || 0);
  if (currentError) console.log('Error:', currentError);
  
  if (currentEntries && currentEntries.length > 0) {
    currentEntries.forEach(entry => {
      console.log(`- ID: ${entry.id}, Clock in: ${entry.clock_in_time}, Status: ${entry.status}`);
    });
  }
  
  // 2. Create a test active clock entry for today
  console.log('\n2. Creating test active clock entry...');
  const now = new Date();
  const clockInTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  
  const { data: newEntry, error: createError } = await supabaseAdmin
    .from('time_clock_entries')
    .insert({
      restaurant_id: restaurantId,
      staff_id: staffId,
      clock_in_time: clockInTime.toISOString(),
      status: 'active'
    })
    .select()
    .single();
    
  if (createError) {
    console.log('Create error:', createError);
  } else {
    console.log('Created entry:', newEntry);
  }
  
  // 3. Test the actual service functions
  console.log('\n3. Testing service functions...');
  
  // Import and test the service
  const { getTimeClockEntries } = await import('../lib/services/staff-scheduling.js');
  
  try {
    const serviceEntries = await getTimeClockEntries(restaurantId);
    console.log('Service returned:', serviceEntries?.length || 0, 'entries');
    
    if (serviceEntries && serviceEntries.length > 0) {
      serviceEntries.forEach(entry => {
        console.log(`- Service entry: ${entry.id}, Status: ${entry.status}, Clock in: ${entry.clock_in_time}`);
      });
    }
  } catch (error) {
    console.log('Service error:', error);
  }
}

// Run with proper environment
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  testFullFlow().catch(console.error);
} else {
  console.log('Missing environment variables');
}
