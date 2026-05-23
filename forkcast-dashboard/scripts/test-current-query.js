const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCurrentQuery() {
  console.log('=== Testing current service query approach ===');
  
  const weekStart = '2025-08-31';
  const weekEnd = '2025-09-06';
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005';
  
  // Test the current service approach
  const { data, error } = await supabase
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
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd)
    .order('shift_date', { ascending: true });

  console.log('Current service result:', data?.length || 0, 'shifts');
  if (error) console.log('Current service error:', error);
  
  if (data && data.length > 0) {
    console.log('Sample shift:', data[0]);
  }
}

testCurrentQuery().catch(console.error);
