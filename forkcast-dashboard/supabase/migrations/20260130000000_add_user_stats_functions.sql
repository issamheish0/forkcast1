-- Migration: Add optimized user stats functions
-- These functions perform aggregations server-side to avoid timeout issues

-- Function to get profile aggregates (avg rating, total loyalty points)
CREATE OR REPLACE FUNCTION get_profile_aggregates()
RETURNS TABLE (
  avg_rating NUMERIC,
  total_loyalty_points BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(user_rating), 0)::NUMERIC AS avg_rating,
    COALESCE(SUM(loyalty_points), 0)::BIGINT AS total_loyalty_points,
    COUNT(*)::BIGINT AS total_count
  FROM profiles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get high value users count (10+ bookings)
CREATE OR REPLACE FUNCTION get_high_value_users_count()
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO result
  FROM (
    SELECT user_id
    FROM bookings
    WHERE user_id IS NOT NULL
      AND status != 'payment_pending'
    GROUP BY user_id
    HAVING COUNT(*) >= 10
  ) AS high_value;

  RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user booking counts (for activity filtering)
CREATE OR REPLACE FUNCTION get_user_booking_counts()
RETURNS TABLE (
  user_id UUID,
  booking_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.user_id,
    COUNT(*)::BIGINT AS booking_count
  FROM bookings b
  WHERE b.user_id IS NOT NULL
    AND b.status != 'payment_pending'
  GROUP BY b.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active users count (booked in last 30 days)
CREATE OR REPLACE FUNCTION get_active_users_count(days_ago INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)::INTEGER INTO result
  FROM bookings
  WHERE user_id IS NOT NULL
    AND status != 'payment_pending'
    AND created_at >= NOW() - (days_ago || ' days')::INTERVAL;

  RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_profile_aggregates() TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_value_users_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_booking_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_count(INTEGER) TO authenticated;
