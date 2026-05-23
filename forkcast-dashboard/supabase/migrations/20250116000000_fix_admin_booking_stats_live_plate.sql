-- Fix activation metrics to calculate cohort-based activation rate
-- This calculates: How many users made their FIRST booking within their first 30 days after joining?
-- 
-- IMPORTANT: This is NOT about recent activity. We look at EACH USER's FIRST booking historically.
-- 
-- Logic:
-- 1. Find each user's FIRST valid booking (by created_at)
-- 2. Check if that first booking was within 30 days of their profile creation
-- 3. If yes → count as activated
-- 4. If no → don't count as activated
-- 
-- Example:
-- - User joined Jan 1, 2023 (2 years ago)
--   - First booking was Jan 15, 2023 (day 14) → COUNT THEM ✓
--   - First booking was Feb 15, 2023 (day 45) → DON'T COUNT THEM ✗
--
-- We only evaluate users who have either:
-- 1. Joined 30+ days ago (they've had their full window)
-- 2. Already made their first booking (we can evaluate them)

CREATE OR REPLACE FUNCTION get_activation_metrics()
RETURNS JSON AS $$
DECLARE
  total_users_count INTEGER;
  users_with_any_booking INTEGER;
  users_with_completed_booking INTEGER;
  any_booking_rate NUMERIC;
  completed_booking_rate NUMERIC;
BEGIN
  -- Step 1: Define eligible users (users we can evaluate)
  -- Users who joined 30+ days ago OR already made at least one booking
  WITH eligible_users AS (
    SELECT 
      p.id,
      p.created_at AS user_joined_at
    FROM profiles p
    WHERE p.created_at <= NOW() - INTERVAL '30 days'
       OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.user_id = p.id
            AND b.created_at >= p.created_at
        )
  )
  SELECT COUNT(*)
  INTO total_users_count
  FROM eligible_users;

  -- Step 2: Count users whose FIRST booking was within their first 30 days
  WITH eligible_users AS (
    SELECT 
      p.id,
      p.created_at AS user_joined_at
    FROM profiles p
    WHERE p.created_at <= NOW() - INTERVAL '30 days'
       OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.user_id = p.id
            AND b.created_at >= p.created_at
        )
  )
  SELECT COUNT(DISTINCT eu.id)
  INTO users_with_any_booking
  FROM eligible_users eu
  WHERE EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.user_id = eu.id
      AND b.created_at >= eu.user_joined_at
      AND b.created_at <= eu.user_joined_at + INTERVAL '30 days'
      -- This is their FIRST booking (no earlier booking exists)
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b2
        WHERE b2.user_id = eu.id
          AND b2.created_at < b.created_at
          AND b2.created_at >= eu.user_joined_at
      )
  );

  -- Step 3: Count users whose FIRST completed booking was within their first 30 days
  WITH eligible_users AS (
    SELECT 
      p.id,
      p.created_at AS user_joined_at
    FROM profiles p
    WHERE p.created_at <= NOW() - INTERVAL '30 days'
       OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.user_id = p.id
            AND b.created_at >= p.created_at
        )
  )
  SELECT COUNT(DISTINCT eu.id)
  INTO users_with_completed_booking
  FROM eligible_users eu
  WHERE EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.user_id = eu.id
      AND b.created_at >= eu.user_joined_at
      AND b.created_at <= eu.user_joined_at + INTERVAL '30 days'
      AND b.status = 'completed'
      -- This is their FIRST completed booking (no earlier completed booking exists)
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b2
        WHERE b2.user_id = eu.id
          AND b2.created_at < b.created_at
          AND b2.created_at >= eu.user_joined_at
          AND b2.status = 'completed'
      )
  );

  -- Calculate rates as percentages
  IF total_users_count > 0 THEN
    any_booking_rate := (users_with_any_booking::NUMERIC / total_users_count::NUMERIC) * 100;
    completed_booking_rate := (users_with_completed_booking::NUMERIC / total_users_count::NUMERIC) * 100;
  ELSE
    any_booking_rate := 0;
    completed_booking_rate := 0;
  END IF;

  -- Return as JSON matching the interface
  RETURN json_build_object(
    'totalNewUsers', total_users_count,
    'usersWithAnyBooking', users_with_any_booking,
    'usersWithCompletedBooking', users_with_completed_booking,
    'anyBookingActivationRate', ROUND(any_booking_rate, 2),
    'completedBookingActivationRate', ROUND(completed_booking_rate, 2)
  );
END;
$$ LANGUAGE plpgsql;
