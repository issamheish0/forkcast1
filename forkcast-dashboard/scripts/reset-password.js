const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Service role client to update user password
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

async function resetUserPassword() {
  console.log('🔐 Resetting password for test3@test.com...');
  
  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      '36f61a76-7561-4ebd-b61a-4b118d8a0191',
      { password: 'password123' }
    );
    
    if (error) {
      console.error('❌ Error updating password:', error);
    } else {
      console.log('✅ Password updated successfully');
      console.log('📧 User email: test3@test.com');
      console.log('🔑 New password: password123');
    }
  } catch (error) {
    console.error('❌ Caught error:', error);
  }
}

resetUserPassword();
