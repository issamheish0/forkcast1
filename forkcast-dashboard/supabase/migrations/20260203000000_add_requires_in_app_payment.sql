-- Add requires_in_app_payment column to restaurant_events table
-- This column controls whether events require in-app payment or allow payment at the restaurant

ALTER TABLE restaurant_events
ADD COLUMN IF NOT EXISTS requires_in_app_payment boolean DEFAULT true;

-- Add a comment to explain the column
COMMENT ON COLUMN restaurant_events.requires_in_app_payment IS 'When true, guests must pay online when booking. When false, guests pay at the restaurant.';
