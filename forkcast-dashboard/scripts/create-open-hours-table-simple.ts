// Simple script to create the restaurant_open_hours table
// This script should be run via Supabase SQL Editor or manually applied
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verifyAndSetupOpenHours() {
  try {
    console.log('🔍 Checking if restaurant_open_hours table exists...')

    // Try to query the table to see if it exists
    const { data, error } = await supabase
      .from('restaurant_open_hours')
      .select('*')
      .limit(1)

    if (error && error.message.includes('does not exist')) {
      console.log('❌ Table does not exist. Please apply the migration manually.')
      console.log('')
      console.log('📋 COPY AND PASTE THE FOLLOWING SQL INTO SUPABASE SQL EDITOR:')
      console.log('─'.repeat(80))

      console.log(`
-- Create restaurant_open_hours table
CREATE TABLE IF NOT EXISTS public.restaurant_open_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text])),
  service_type text NOT NULL DEFAULT 'general'::text CHECK (service_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'general'::text, 'bar'::text, 'kitchen'::text])),
  is_open boolean DEFAULT true,
  open_time time without time zone,
  close_time time without time zone,
  name text DEFAULT ''::text,
  accepts_walkins boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_open_hours_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_open_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT restaurant_open_hours_valid_times CHECK (
    (is_open = false) OR
    (is_open = true AND open_time IS NOT NULL AND close_time IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_open_hours_restaurant_id ON public.restaurant_open_hours (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_open_hours_day_service ON public.restaurant_open_hours (restaurant_id, day_of_week, service_type);

-- Enable RLS
ALTER TABLE public.restaurant_open_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view restaurant open hours" ON public.restaurant_open_hours
  FOR SELECT USING (true);

CREATE POLICY "Restaurant staff can manage open hours" ON public.restaurant_open_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_open_hours.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_restaurant_open_hours_updated_at
  BEFORE UPDATE ON public.restaurant_open_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `)

      console.log('─'.repeat(80))
      console.log('')
      console.log('🔧 After running the SQL above, run this script again to populate default data.')
      return false
    } else if (error) {
      console.error('❌ Error checking table:', error)
      return false
    } else {
      console.log('✅ Table exists! Checking for data...')

      // Check if we have data
      const { count } = await supabase
        .from('restaurant_open_hours')
        .select('*', { count: 'exact', head: true })

      console.log(`📊 Found ${count || 0} open hours records`)

      if (count === 0) {
        console.log('📝 Populating default open hours for existing restaurants...')
        await populateDefaultOpenHours()
      }

      return true
    }
  } catch (error) {
    console.error('💥 Verification failed:', error)
    return false
  }
}

async function populateDefaultOpenHours() {
  try {
    // Get all restaurants
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id')

    if (restaurantsError) {
      console.error('❌ Error fetching restaurants:', restaurantsError)
      return
    }

    if (!restaurants || restaurants.length === 0) {
      console.log('ℹ️  No restaurants found to populate')
      return
    }

    console.log(`🏢 Found ${restaurants.length} restaurants`)

    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const defaultOpenHours = []

    // Create default hours for each restaurant and each day
    for (const restaurant of restaurants) {
      for (const day of daysOfWeek) {
        defaultOpenHours.push({
          restaurant_id: restaurant.id,
          day_of_week: day,
          service_type: 'general',
          is_open: true,
          open_time: '08:00',
          close_time: '23:00',
          name: 'General Service',
          accepts_walkins: true,
          notes: 'Default open hours - please update as needed'
        })
      }
    }

    console.log(`📋 Inserting ${defaultOpenHours.length} default open hours records...`)

    const { error: insertError } = await supabase
      .from('restaurant_open_hours')
      .insert(defaultOpenHours)

    if (insertError) {
      console.error('❌ Error inserting default hours:', insertError)
    } else {
      console.log('✅ Default open hours populated successfully!')
    }

  } catch (error) {
    console.error('💥 Population failed:', error)
  }
}

async function main() {
  console.log('🚀 Setting up restaurant open hours table...')

  const success = await verifyAndSetupOpenHours()

  if (success) {
    console.log('🎉 Open hours setup complete!')
    console.log('')
    console.log('📋 Next steps:')
    console.log('1. Update the TypeScript types')
    console.log('2. Create React hooks for data management')
    console.log('3. Build the UI components')
    console.log('4. Integrate with the settings page')
  } else {
    console.log('⚠️  Manual intervention required. Please apply the SQL above first.')
  }
}

main()