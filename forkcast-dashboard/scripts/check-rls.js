const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLSPolicies() {
  console.log('=== Checking RLS Policies ===');
  
  // Check if RLS is enabled on staff_shifts
  const { data: rlsStatus, error: rlsError } = await supabase
    .rpc('pg_table_is_visible', { table_name: 'staff_shifts' });
  
  if (rlsError) {
    console.log('RLS check error (expected):', rlsError.message);
  }

  // Check existing policies using SQL
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'staff_shifts');
    
  if (policiesError) {
    console.log('Policies check error:', policiesError.message);
  } else {
    console.log('Current policies for staff_shifts:', policies?.length || 0);
    if (policies && policies.length > 0) {
      policies.forEach(policy => {
        console.log(`- ${policy.policyname}: ${policy.cmd} for ${policy.roles}`);
      });
    }
  }
  
  // Alternative: Check table info
  const { data: tableInfo, error: tableError } = await supabase
    .rpc('pg_get_table_def', { table_name: 'staff_shifts' });
    
  if (tableError) {
    console.log('Table info error (expected):', tableError.message);
  }
}

checkRLSPolicies().catch(console.error);
