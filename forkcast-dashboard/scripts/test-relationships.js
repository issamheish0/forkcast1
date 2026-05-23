const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRelationships() {
  console.log('=== Testing different relationship names ===');
  
  const weekStart = '2025-08-31';
  const weekEnd = '2025-09-06';
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005';
  
  // Test 1: Using 'restaurant_staff' as relationship name
  console.log('\n1. Testing with "restaurant_staff" relationship...');
  const { data: test1, error: error1 } = await supabase
    .from('staff_shifts')
    .select(`
      *,
      restaurant_staff!inner(
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
    .eq('restaurant_staff.restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log('Result 1:', test1?.length || 0, 'shifts');
  if (error1) console.log('Error 1:', error1);
  
  // Test 2: Using staff_id to join
  console.log('\n2. Testing with staff_id join...');
  const { data: test2, error: error2 } = await supabase
    .from('staff_shifts')
    .select(`
      *,
      restaurant_staff!staff_shifts_staff_id_fkey(
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
    .eq('restaurant_staff.restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log('Result 2:', test2?.length || 0, 'shifts');
  if (error2) console.log('Error 2:', error2);
  
  // Test 3: Simple join check
  console.log('\n3. Testing simple join...');
  const { data: test3, error: error3 } = await supabase
    .from('staff_shifts')
    .select('*, restaurant_staff(*)')
    .eq('restaurant_staff.restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log('Result 3:', test3?.length || 0, 'shifts');  
  if (error3) console.log('Error 3:', error3);
  
  // Test 4: Check what foreign keys exist
  console.log('\n4. Checking a sample shift to see available fields...');
  const { data: sampleShift } = await supabase
    .from('staff_shifts')
    .select('*')
    .limit(1);
    
  if (sampleShift && sampleShift.length > 0) {
    console.log('Sample shift fields:', Object.keys(sampleShift[0]));
  }
}

testRelationships().catch(console.error);
