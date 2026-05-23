-- Add tier column to restaurants table if it doesn't exist
-- This migration ensures the tier system is properly set up

-- Create tier enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE tier AS ENUM ('basic', 'pro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add tier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurants' 
        AND column_name = 'tier'
    ) THEN
        ALTER TABLE restaurants ADD COLUMN tier tier NOT NULL DEFAULT 'pro';
    END IF;
END $$;

-- Update any existing restaurants to have a tier if they don't
UPDATE restaurants 
SET tier = 'pro' 
WHERE tier IS NULL;

-- Add a comment to document the tier system
COMMENT ON COLUMN restaurants.tier IS 'Restaurant tier: basic (simple booking management) or pro (full features)';
