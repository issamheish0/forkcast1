-- Add shared table support for restaurant management system
-- This migration adds support for tables where multiple parties can book seats simultaneously

-- Step 1: Add 'shared' to the table_type enum in restaurant_tables
ALTER TABLE public.restaurant_tables 
DROP CONSTRAINT restaurant_tables_table_type_check;

ALTER TABLE public.restaurant_tables 
ADD CONSTRAINT restaurant_tables_table_type_check 
CHECK (table_type = ANY (ARRAY['booth'::text, 'window'::text, 'patio'::text, 'standard'::text, 'bar'::text, 'private'::text, 'shared'::text]));

-- Step 2: Add seats_occupied column to booking_tables to track how many seats each booking uses
ALTER TABLE public.booking_tables 
ADD COLUMN IF NOT EXISTS seats_occupied INTEGER NOT NULL DEFAULT 1 
CHECK (seats_occupied > 0);

-- Step 3: Add comment to explain the new column
COMMENT ON COLUMN public.booking_tables.seats_occupied IS 'Number of seats this booking occupies at the table (for shared tables)';

-- Step 4: Add is_shared_booking flag to bookings table for easier querying
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS is_shared_booking BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.bookings.is_shared_booking IS 'Indicates if this booking is for a shared table where multiple parties can sit together';

-- Step 5: Add index for performance on shared table queries
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_shared_type ON public.restaurant_tables(table_type) WHERE table_type = 'shared';

-- Step 6: Add index for booking_tables seats_occupied for availability queries
CREATE INDEX IF NOT EXISTS idx_booking_tables_seats_occupied ON public.booking_tables(seats_occupied);

-- Step 7: Add index for shared bookings for restaurant staff queries
CREATE INDEX IF NOT EXISTS idx_bookings_shared ON public.bookings(restaurant_id, is_shared_booking, status) WHERE is_shared_booking = TRUE;

-- Step 8: Create a function to calculate available seats for shared tables
CREATE OR REPLACE FUNCTION get_shared_table_available_seats(
    table_id_param UUID,
    booking_time_param TIMESTAMP WITH TIME ZONE,
    turn_time_minutes_param INTEGER DEFAULT 120
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_capacity INTEGER;
    occupied_seats INTEGER;
    booking_start TIMESTAMP WITH TIME ZONE;
    booking_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get table capacity
    SELECT capacity INTO table_capacity
    FROM public.restaurant_tables 
    WHERE id = table_id_param AND table_type = 'shared';
    
    IF table_capacity IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate time window for overlapping bookings
    booking_start := booking_time_param;
    booking_end := booking_time_param + (turn_time_minutes_param || ' minutes')::INTERVAL;
    
    -- Calculate currently occupied seats for this time window
    SELECT COALESCE(SUM(bt.seats_occupied), 0) INTO occupied_seats
    FROM public.booking_tables bt
    JOIN public.bookings b ON bt.booking_id = b.id
    WHERE bt.table_id = table_id_param
    AND b.status IN ('pending', 'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert')
    AND b.booking_time < booking_end
    AND (b.booking_time + COALESCE(b.turn_time_minutes, turn_time_minutes_param) * INTERVAL '1 minute') > booking_start;
    
    RETURN GREATEST(0, table_capacity - occupied_seats);
END;
$$;

-- Step 9: Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION get_shared_table_available_seats(UUID, TIMESTAMP WITH TIME ZONE, INTEGER) TO authenticated, anon;

-- Step 10: Create function to get shared table occupancy summary for restaurant dashboard
CREATE OR REPLACE FUNCTION get_restaurant_shared_tables_summary(
    restaurant_id_param UUID,
    target_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
    table_id UUID,
    table_number TEXT,
    capacity INTEGER,
    section_name TEXT,
    current_occupancy INTEGER,
    total_bookings_today INTEGER,
    revenue_today DECIMAL,
    peak_occupancy_time TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id as table_id,
        rt.table_number,
        rt.capacity,
        COALESCE(rs.name, 'No Section') as section_name,
        -- Current occupancy (active bookings right now)
        COALESCE((
            SELECT SUM(bt2.seats_occupied)
            FROM booking_tables bt2
            JOIN bookings b2 ON bt2.booking_id = b2.id
            WHERE bt2.table_id = rt.id
            AND b2.status IN ('arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert')
            AND b2.booking_time <= NOW()
            AND (b2.booking_time + COALESCE(b2.turn_time_minutes, 120) * INTERVAL '1 minute') >= NOW()
        ), 0)::INTEGER as current_occupancy,
        -- Total bookings today
        COALESCE((
            SELECT COUNT(*)
            FROM booking_tables bt3
            JOIN bookings b3 ON bt3.booking_id = b3.id
            WHERE bt3.table_id = rt.id
            AND b3.booking_time::DATE = target_date
            AND b3.is_shared_booking = TRUE
        ), 0)::INTEGER as total_bookings_today,
        -- Revenue today (estimated based on average spend)
        COALESCE((
            SELECT SUM(b4.party_size * 35.00) -- Estimated $35 per person
            FROM booking_tables bt4
            JOIN bookings b4 ON bt4.booking_id = b4.id
            WHERE bt4.table_id = rt.id
            AND b4.booking_time::DATE = target_date
            AND b4.status = 'completed'
            AND b4.is_shared_booking = TRUE
        ), 0)::DECIMAL as revenue_today,
        -- Peak occupancy time
        (
            SELECT b5.booking_time::TIME
            FROM booking_tables bt5
            JOIN bookings b5 ON bt5.booking_id = b5.id
            WHERE bt5.table_id = rt.id
            AND b5.booking_time::DATE = target_date
            AND b5.is_shared_booking = TRUE
            GROUP BY b5.booking_time::TIME
            ORDER BY SUM(bt5.seats_occupied) DESC
            LIMIT 1
        ) as peak_occupancy_time
    FROM restaurant_tables rt
    LEFT JOIN restaurant_sections rs ON rt.section_id = rs.id
    WHERE rt.restaurant_id = restaurant_id_param
    AND rt.table_type = 'shared'
    AND rt.is_active = TRUE
    ORDER BY rt.table_number;
END;
$$;

-- Step 11: Grant execute permissions on the summary function
GRANT EXECUTE ON FUNCTION get_restaurant_shared_tables_summary(UUID, DATE) TO authenticated;

-- Step 12: Add RLS policy for restaurant staff to view shared table bookings
CREATE POLICY "Restaurant staff can view shared table bookings for their restaurant" ON public.bookings
FOR SELECT USING (
    is_shared_booking = TRUE AND
    EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = auth.uid()
        AND rs.restaurant_id = bookings.restaurant_id
        AND rs.is_active = TRUE
    )
);

-- Step 13: Create index for staff dashboard queries
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_shared_time ON public.bookings(restaurant_id, is_shared_booking, booking_time) WHERE is_shared_booking = TRUE;
