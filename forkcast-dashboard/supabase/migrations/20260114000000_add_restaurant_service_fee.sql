-- Add service fee percentage column to restaurants table
-- This fee is applied to deposit payments for manual bookings

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS service_fee_percentage numeric DEFAULT 0 CHECK (service_fee_percentage >= 0 AND service_fee_percentage <= 100);

COMMENT ON COLUMN restaurants.service_fee_percentage IS 'Service fee percentage applied to deposit payments (e.g., 5 for 5%). Range: 0-100';

-- Create index for quick lookups when generating payment links
CREATE INDEX IF NOT EXISTS idx_restaurants_service_fee ON restaurants(service_fee_percentage) WHERE service_fee_percentage > 0;
