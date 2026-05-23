const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createDataForUserRestaurant() {
  console.log('=== Creating sample data for user restaurant ===');
  
  const userRestaurantId = '660e8400-e29b-41d4-a716-446655440001'; // Your restaurant
  const userId = '36f61a76-7561-4ebd-b61a-4b118d8a0191'; // Your user ID
  
  try {
    // 1. Create staff members for your restaurant
    console.log('📝 Creating staff members...');
    
    const staffMembers = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        restaurant_id: userRestaurantId,
        user_id: userId, // You as owner
        position: 'Owner',
        role: 'owner',
        hourly_wage: 0,
        is_active: true,
        created_by: userId,
      },
      {
        id: '11111111-1111-1111-1111-111111111112',
        restaurant_id: userRestaurantId,
        user_id: '11111111-1111-1111-1111-111111111122', // Dummy user ID
        position: 'Head Chef',
        role: 'manager',
        hourly_wage: 28,
        is_active: true,
        created_by: userId,
      },
      {
        id: '11111111-1111-1111-1111-111111111113',
        restaurant_id: userRestaurantId,
        user_id: '11111111-1111-1111-1111-111111111123', // Dummy user ID
        position: 'Server',
        role: 'staff',
        hourly_wage: 18,
        is_active: true,
        created_by: userId,
      },
    ];

    for (const staff of staffMembers) {
      const { error } = await supabase
        .from('restaurant_staff')
        .upsert(staff);
      
      if (error && !error.message.includes('duplicate key')) {
        console.error('Error creating staff:', error);
      }
    }
    
    console.log('✅ Staff members created');

    // 2. Create staff shifts for this week
    console.log('📅 Creating staff shifts...');
    
    const shifts = [];
    const dates = ['2025-09-01', '2025-09-02', '2025-09-03', '2025-09-04', '2025-09-05'];
    const staffIds = staffMembers.map(s => s.id);
    
    dates.forEach((date, dateIndex) => {
      staffIds.forEach((staffId, staffIndex) => {
        // Create shifts for each staff member
        const startHour = 8 + (staffIndex * 2); // Stagger start times
        const endHour = startHour + 8; // 8-hour shifts
        
        shifts.push({
          id: `2222222${dateIndex}-222${staffIndex}-2222-2222-222222222222`,
          restaurant_id: userRestaurantId,
          staff_id: staffId,
          shift_date: date,
          start_time: `${startHour.toString().padStart(2, '0')}:00:00`,
          end_time: `${endHour.toString().padStart(2, '0')}:00:00`,
          role: staffIndex === 0 ? 'Manager' : staffIndex === 1 ? 'Chef' : 'Server',
          station: staffIndex === 0 ? 'Front' : staffIndex === 1 ? 'Kitchen' : 'Dining',
          status: 'scheduled',
          hourly_rate: staffMembers[staffIndex].hourly_wage,
          created_by: userId,
        });
      });
    });

    for (const shift of shifts) {
      const { error } = await supabase
        .from('staff_shifts')
        .upsert(shift);
      
      if (error && !error.message.includes('duplicate key')) {
        console.error('Error creating shift:', error);
      }
    }
    
    console.log(`✅ Created ${shifts.length} shifts`);

    // 3. Create some time clock entries (people currently clocked in)
    console.log('⏰ Creating time clock entries...');
    
    const timeClockEntries = [
      {
        id: '33333333-3333-3333-3333-333333333331',
        restaurant_id: userRestaurantId,
        staff_id: staffIds[1], // Head Chef
        shift_id: shifts.find(s => s.shift_date === '2025-09-01' && s.staff_id === staffIds[1])?.id,
        clock_in_time: '2025-09-01T08:00:00Z',
        clock_out_time: null, // Still clocked in
        break_start_time: null,
        break_end_time: null,
        status: 'clocked_in',
        created_by: userId,
      },
      {
        id: '33333333-3333-3333-3333-333333333332',
        restaurant_id: userRestaurantId,
        staff_id: staffIds[2], // Server
        shift_id: shifts.find(s => s.shift_date === '2025-09-01' && s.staff_id === staffIds[2])?.id,
        clock_in_time: '2025-09-01T10:00:00Z',
        clock_out_time: null, // Still clocked in
        break_start_time: null,
        break_end_time: null,
        status: 'clocked_in',
        created_by: userId,
      },
    ];

    for (const entry of timeClockEntries) {
      const { error } = await supabase
        .from('time_clock_entries')
        .upsert(entry);
      
      if (error && !error.message.includes('duplicate key')) {
        console.error('Error creating time clock entry:', error);
      }
    }
    
    console.log(`✅ Created ${timeClockEntries.length} time clock entries`);

    // 4. Verify the data
    console.log('\n=== Verification ===');
    
    const { data: staffData } = await supabase
      .from('restaurant_staff')
      .select('*')
      .eq('restaurant_id', userRestaurantId);
      
    const { data: shiftsData } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('restaurant_id', userRestaurantId);
      
    const { data: clockData } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('restaurant_id', userRestaurantId);
      
    console.log(`✅ Staff members: ${staffData?.length || 0}`);
    console.log(`✅ Shifts: ${shiftsData?.length || 0}`);
    console.log(`✅ Active clock-ins: ${clockData?.filter(c => !c.clock_out_time).length || 0}`);
    
    console.log('\n🎉 Sample data created for your restaurant!');
    console.log('Now navigate to /schedules and it should show data.');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

createDataForUserRestaurant();
