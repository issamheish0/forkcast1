-- Add booking_actions column to admin_permissions table
-- This allows super admins to control which admins can accept/decline bookings

ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS booking_actions jsonb DEFAULT '{"can_accept_decline": false}'::jsonb;

-- Update existing permissions to have default booking_actions
UPDATE public.admin_permissions 
SET booking_actions = '{"can_accept_decline": true}'::jsonb 
WHERE booking_actions IS NULL;


