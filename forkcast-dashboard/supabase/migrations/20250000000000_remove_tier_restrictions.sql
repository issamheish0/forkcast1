-- Migration: remove_tier_restrictions_add_floor_plan_to_all
-- Sets all restaurants to 'pro' tier and ensures floor_plan addon is present.
-- Tier-based and addon-based feature gating has been removed from the application;
-- all restaurants now have access to all features including the floor plan.

UPDATE restaurants
SET
  tier = 'pro',
  addons = CASE
    WHEN addons IS NULL THEN ARRAY['floor_plan']
    WHEN NOT ('floor_plan' = ANY(addons)) THEN addons || ARRAY['floor_plan']
    ELSE addons
  END;
