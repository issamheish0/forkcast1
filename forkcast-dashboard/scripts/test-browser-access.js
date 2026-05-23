const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Use browser client to simulate real app behavior
const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testBrowserAccess() {
  console.log('=== Testing browser access with user context ===');
  
  const restaurantId = '660e8400-e29b-41d4-a716-446655440001';
  const userId = '36f61a76-7561-4ebd-b61a-4b118d8a0191';
  
  // First, simulate what happens when user logs in
  // Note: In browser, we would use supabase.auth.signInWithPassword
  
  console.log('\n1. Testing restaurant staff access...');
  const { data: staffData, error: staffError } = await anonSupabase
    .from('restaurant_staff')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', userId)
    .eq('is_active', true);
    
  console.log('Staff data:', staffData?.length || 0, 'records');
  if (staffError) console.log('Staff error:', staffError);
  
  console.log('\n2. Testing shifts access...');
  const { data: shiftsData, error: shiftsError } = await anonSupabase
    .from('staff_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId);
    
  console.log('Shifts data:', shiftsData?.length || 0, 'records');
  if (shiftsError) console.log('Shifts error:', shiftsError);
  
  console.log('\n3. Testing time clock entries (today)...');
  const today = '2025-09-01';
  const { data: todayEntries, error: todayError } = await anonSupabase
    .from('time_clock_entries')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('clock_in_time', today)
    .lte('clock_in_time', today + 'T23:59:59Z');
    
  console.log('Today entries:', todayEntries?.length || 0, 'records');
  if (todayError) console.log('Today error:', todayError);
  
  console.log('\n4. Testing time clock entries (active status)...');
  const { data: activeEntries, error: activeError } = await anonSupabase
    .from('time_clock_entries')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active');
    
  console.log('Active entries:', activeEntries?.length || 0, 'records');
  if (activeError) console.log('Active error:', activeError);
  
  if (activeEntries && activeEntries.length > 0) {
    console.log('Active entries details:');
    activeEntries.forEach(entry => {
      console.log(`- ID: ${entry.id}, Clock in: ${entry.clock_in_time}, Status: ${entry.status}`);
    });
  }
}

testBrowserAccess().catch(console.error);
