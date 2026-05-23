-- Create booking_handlers table to track which admin is handling each booking
-- This is separate from the bookings table as requested

CREATE TABLE IF NOT EXISTS public.booking_handlers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  admin_id bigint NOT NULL,
  handled_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_handlers_pkey PRIMARY KEY (id),
  CONSTRAINT booking_handlers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT booking_handlers_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.rbs_admins(id) ON DELETE CASCADE,
  CONSTRAINT booking_handlers_booking_id_unique UNIQUE (booking_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_handlers_booking_id ON public.booking_handlers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_handlers_admin_id ON public.booking_handlers(admin_id);

-- Enable RLS
ALTER TABLE public.booking_handlers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all booking handlers
DROP POLICY IF EXISTS "Admins can view booking handlers" ON public.booking_handlers;
CREATE POLICY "Admins can view booking handlers"
  ON public.booking_handlers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE rbs_admins.user_id = auth.uid()
    )
  );

-- Admins can insert booking handlers (for handling bookings)
DROP POLICY IF EXISTS "Admins can handle bookings" ON public.booking_handlers;
CREATE POLICY "Admins can handle bookings"
  ON public.booking_handlers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE rbs_admins.user_id = auth.uid()
      AND rbs_admins.id = admin_id
    )
  );

-- Note: No UPDATE or DELETE policies - once a booking is handled, it cannot be changed

-- Create a function to prevent duplicate handler assignments
CREATE OR REPLACE FUNCTION public.prevent_duplicate_booking_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  handler_admin_id bigint;
  handler_user_id uuid;
  handler_name text;
BEGIN
  -- Check if booking already has a handler
  SELECT admin_id INTO handler_admin_id
  FROM public.booking_handlers
  WHERE booking_id = NEW.booking_id
  LIMIT 1;
  
  IF handler_admin_id IS NOT NULL THEN
    -- Get the handler's user_id
    SELECT user_id INTO handler_user_id
    FROM public.rbs_admins
    WHERE id = handler_admin_id;
    
    -- Get the handler's name
    IF handler_user_id IS NOT NULL THEN
      SELECT full_name INTO handler_name
      FROM public.profiles
      WHERE id = handler_user_id;
    END IF;
    
    -- Raise exception with handler name if available
    IF handler_name IS NOT NULL AND handler_name != '' THEN
      RAISE EXCEPTION 'Booking is already being handled by %', handler_name;
    ELSE
      RAISE EXCEPTION 'Booking is already being handled by another admin';
    END IF;
  END IF;
  
  -- Also verify the booking is still pending
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = NEW.booking_id
    AND status != 'pending'
  ) THEN
    RAISE EXCEPTION 'Booking can only be handled when status is pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce one handler per booking
DROP TRIGGER IF EXISTS prevent_duplicate_booking_handler_trigger ON public.booking_handlers;
CREATE TRIGGER prevent_duplicate_booking_handler_trigger
  BEFORE INSERT ON public.booking_handlers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_booking_handler();
