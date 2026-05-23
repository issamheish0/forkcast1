-- Add created_by field to restaurants table to track restaurant creators
-- This allows restaurant creators to access their restaurants without being staff members

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurants' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.restaurants ADD COLUMN created_by uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_created_by ON public.restaurants(created_by);

-- Add comment to document the field
COMMENT ON COLUMN public.restaurants.created_by IS 'User ID of the person who created this restaurant. Allows restaurant creators to manage their restaurants without staff records.';
