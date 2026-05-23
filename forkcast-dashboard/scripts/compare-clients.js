const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test with anonymous key (browser environment)
const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test with service role (server environment)
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compareClients() {
  console.log('=== Comparing Anonymous vs Service Role access ===');
  
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005';
  const weekStart = '2025-08-31';
  const weekEnd = '2025-09-06';
  
  // Test with anonymous key (what browser uses)
  console.log('\n1. Testing with Anonymous Key (browser environment)...');
  const { data: anonData, error: anonError } = await anonSupabase
    .from('staff_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log('Anonymous result:', anonData?.length || 0, 'shifts');
  if (anonError) console.log('Anonymous error:', anonError);
  
  // Test with service role key (what our Node.js scripts use)
  console.log('\n2. Testing with Service Role Key (server environment)...');
  const { data: serviceData, error: serviceError } = await serviceSupabase
    .from('staff_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log('Service role result:', serviceData?.length || 0, 'shifts');
  if (serviceError) console.log('Service role error:', serviceError);
  
  // Test with restaurant staff join using anonymous key
  console.log('\n3. Testing restaurant staff join with anonymous key...');
  const { data: joinData, error: joinError } = await anonSupabase
    .from('staff_shifts')
    .select(`
      *,
      staff:restaurant_staff(
        id,
        user_id,
        role
      )
    `)
    .eq('restaurant_id', restaurantId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);
    
  console.log('Join result:', joinData?.length || 0, 'shifts');
  if (joinError) console.log('Join error:', joinError);
}

compareClients().catch(console.error);
