-- Test script to set a restaurant to Basic tier
-- Run this in your Supabase SQL editor

-- Show current restaurants and their tiers
SELECT id, name, tier, status FROM restaurants LIMIT 5;

-- Set the first active restaurant to Basic tier for testing
-- Replace the restaurant_id below with the actual ID from the query above
-- UPDATE restaurants SET tier = 'basic' WHERE id = 'your-restaurant-id-here';

-- To verify the change:
-- SELECT id, name, tier FROM restaurants WHERE tier = 'basic';

-- To revert back to Pro tier:
-- UPDATE restaurants SET tier = 'pro' WHERE id = 'your-restaurant-id-here';
