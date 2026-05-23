-- Create a test user and restaurant staff member for testing
-- This will be inserted using the service role key

-- Insert a test user profile (this should match an auth.users record)
INSERT INTO profiles (
  id,
  first_name,
  last_name,
  email,
  phone_number,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Test user ID
  'Test',
  'Manager',
  'test@restaurant.com',
  '+1234567890',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email;

-- Insert a restaurant staff record for the test user
INSERT INTO restaurant_staff (
  id,
  restaurant_id,
  user_id,
  position,
  role,
  hourly_wage,
  is_active,
  created_by,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002', -- Test staff ID
  '660e8400-e29b-41d4-a716-446655440005', -- Restaurant ID
  '00000000-0000-0000-0000-000000000001', -- Test user ID
  'General Manager',
  'manager', -- This will allow full access to shifts
  25.00,
  true,
  '00000000-0000-0000-0000-000000000001', -- Created by test user
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  restaurant_id = EXCLUDED.restaurant_id,
  user_id = EXCLUDED.user_id,
  position = EXCLUDED.position,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;
