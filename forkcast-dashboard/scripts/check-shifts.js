const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkShifts() {
  console.log('=== Checking shifts in database ===');
  
  // Check all shifts
  const { data: allShifts, error: allError } = await supabase
    .from('staff_shifts')
    .select('*')
    .order('shift_date', { ascending: false });
  
  console.log('All shifts count:', allShifts?.length || 0);
  if (allError) console.log('All shifts error:', allError);
  
  if (allShifts && allShifts.length > 0) {
    console.log('Sample shift:', allShifts[0]);
    console.log('All shift dates:', allShifts.map(s => s.shift_date));
  }
  
  // Check current week shifts  
  const weekStart = '2025-08-31';
  const weekEnd = '2025-09-06';
  
  const { data: weekShifts, error: weekError } = await supabase
    .from('staff_shifts')
    .select('*')
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log(`Week shifts (${weekStart} to ${weekEnd}):`, weekShifts?.length || 0);
  if (weekError) console.log('Week shifts error:', weekError);
  
  // Check restaurant filter
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005';
  const { data: restaurantShifts, error: restError } = await supabase
    .from('staff_shifts')
    .select('*, restaurant_staff_user_id_fkey!inner(*)')
    .eq('restaurant_staff_user_id_fkey.restaurant_id', restaurantId);
    
  console.log('Restaurant shifts:', restaurantShifts?.length || 0);
  if (restError) console.log('Restaurant shifts error:', restError);
  
  // Test the exact query from the service
  console.log('\n=== Testing exact service query ===');
  const { data: serviceQuery, error: serviceError } = await supabase
    .from('staff_shifts')
    .select(`
      *,
      restaurant_staff_user_id_fkey!inner(
        id,
        restaurant_id,
        user_id,
        position,
        hourly_wage,
        is_active,
        profiles!inner(
          id,
          first_name,
          last_name,
          avatar_url
        )
      )
    `)
    .eq('restaurant_staff_user_id_fkey.restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd)
    .order('shift_date', { ascending: true });
    
  console.log('Service query result:', serviceQuery?.length || 0);
  if (serviceError) console.log('Service query error:', serviceError);
}

checkShifts().catch(console.error);
