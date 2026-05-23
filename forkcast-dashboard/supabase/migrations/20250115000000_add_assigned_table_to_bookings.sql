-- Add assigned_table field to bookings table
ALTER TABLE public.bookings 
ADD COLUMN assigned_table text;

-- Add comment to explain the field
COMMENT ON COLUMN public.bookings.assigned_table IS 'Table number assigned to the booking (e.g., "5", "12", "A1")';








