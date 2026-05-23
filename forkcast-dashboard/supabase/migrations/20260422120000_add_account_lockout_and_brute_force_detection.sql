-- 20260422120000_add_account_lockout_and_brute_force_detection.sql
--
-- W02 follow-up: account lockout, brute-force detection, and forced password
-- reset infrastructure. This is *server-side state* — we cannot trust the
-- client-side counter, so all writes happen via SECURITY DEFINER RPCs from
-- the Next.js API routes (with the service-role key).
--
-- Tables:
--   public.failed_login_attempts   — append-only log
--   public.account_lockouts        — current lockout state (one row per email)
--   public.forced_password_resets  — admins can mark a user as "must reset"
--
-- RPCs (all SECURITY DEFINER, EXECUTE granted only to `service_role`):
--   public.fn_record_failed_login(p_email, p_ip, p_user_agent)
--   public.fn_clear_failed_logins(p_email)
--   public.fn_check_login_lockout(p_email)        -- read-only, used at sign-in
--   public.fn_detect_brute_force_ips(p_window, p_threshold)  -- alerting
--   public.fn_force_password_reset(p_email)
--   public.fn_consume_forced_reset(p_user_id)     -- called after successful reset
--
-- Lockout policy (exponential backoff):
--   1-2 fails  → no lock
--   3   fails  → 1   minute
--   5   fails  → 5   minutes
--   8   fails  → 30  minutes
--   12+ fails  → 24  hours
--   Counters auto-reset 24 h after the most recent failure.

-- ---------------------------------------------------------------------------
-- Required extensions (must come before any citext column is referenced).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- failed_login_attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id            bigserial PRIMARY KEY,
  email         citext NOT NULL,
  ip_address    inet,
  user_agent    text,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fla_email_time
  ON public.failed_login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fla_ip_time
  ON public.failed_login_attempts (ip_address, created_at DESC);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role / SECURITY DEFINER funcs can read/write.
REVOKE ALL ON public.failed_login_attempts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- account_lockouts (current state — rebuilt on each failed attempt)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_lockouts (
  email             citext PRIMARY KEY,
  fail_count        integer NOT NULL DEFAULT 0,
  locked_until      timestamptz,
  last_attempt_at   timestamptz NOT NULL DEFAULT now(),
  last_ip           inet,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_lockouts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- forced_password_resets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forced_password_resets (
  user_id      uuid PRIMARY KEY,
  reason       text NOT NULL,
  enforced_by  uuid,
  enforced_at  timestamptz NOT NULL DEFAULT now(),
  consumed_at  timestamptz,
  -- not a strict FK — we may force a reset for an account that does not
  -- exist in profiles yet (e.g. invited but never logged in)
  CHECK (length(reason) BETWEEN 1 AND 500)
);

ALTER TABLE public.forced_password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forced_password_resets FROM anon, authenticated;

-- Allow the *user themselves* to read their own forced-reset row so the
-- client UI can render the "you must reset" notice without a service-role
-- round-trip.
CREATE POLICY "forced_reset_self_read"
  ON public.forced_password_resets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND consumed_at IS NULL);

-- ---------------------------------------------------------------------------
-- Helper: compute lockout duration from a fail count (returns interval)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._fn_lockout_duration(p_fail_count integer)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_fail_count < 3   THEN INTERVAL '0'
    WHEN p_fail_count < 5   THEN INTERVAL '1 minute'
    WHEN p_fail_count < 8   THEN INTERVAL '5 minutes'
    WHEN p_fail_count < 12  THEN INTERVAL '30 minutes'
    ELSE INTERVAL '24 hours'
  END
$$;

-- ---------------------------------------------------------------------------
-- fn_record_failed_login — call on every failed sign-in
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_failed_login(
  p_email      citext,
  p_ip         inet,
  p_user_agent text DEFAULT NULL,
  p_reason     text DEFAULT 'invalid_credentials'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count    integer;
  v_locked   timestamptz;
  v_duration interval;
BEGIN
  IF p_email IS NULL OR length(p_email) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;

  INSERT INTO public.failed_login_attempts (email, ip_address, user_agent, reason)
  VALUES (p_email, p_ip, p_user_agent, p_reason);

  -- Reset the rolling counter if last attempt was > 24 h ago
  INSERT INTO public.account_lockouts (email, fail_count, last_attempt_at, last_ip)
  VALUES (p_email, 1, now(), p_ip)
  ON CONFLICT (email) DO UPDATE
  SET fail_count = CASE
        WHEN public.account_lockouts.last_attempt_at < now() - INTERVAL '24 hours'
          THEN 1
        ELSE public.account_lockouts.fail_count + 1
      END,
      last_attempt_at = now(),
      last_ip = p_ip,
      updated_at = now()
  RETURNING fail_count INTO v_count;

  v_duration := public._fn_lockout_duration(v_count);
  IF v_duration > INTERVAL '0' THEN
    v_locked := now() + v_duration;
    UPDATE public.account_lockouts
    SET locked_until = v_locked
    WHERE email = p_email;
  END IF;

  -- Mirror to the existing security_audit_log so SOC tooling sees it.
  INSERT INTO public.security_audit_log
    (user_id, restaurant_id, activity_type, risk_score, details, ip_address, user_agent)
  VALUES
    (NULL, NULL, 'login_failed',
     LEAST(100, v_count * 15),
     jsonb_build_object('email', p_email, 'fail_count', v_count, 'reason', p_reason),
     p_ip, p_user_agent);

  RETURN jsonb_build_object(
    'fail_count',   v_count,
    'locked_until', v_locked,
    'lock_duration_seconds', EXTRACT(EPOCH FROM v_duration)::int
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- fn_clear_failed_logins — call after successful sign-in
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_clear_failed_logins(p_email citext)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.account_lockouts WHERE email = p_email;
END;
$$;

-- ---------------------------------------------------------------------------
-- fn_check_login_lockout — read-only, called by the precheck endpoint
-- Returns: { locked: bool, locked_until, fail_count, requires_captcha }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_check_login_lockout(p_email citext)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_locked_now boolean;
BEGIN
  SELECT fail_count, locked_until, last_attempt_at
    INTO r
  FROM public.account_lockouts
  WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'locked',           false,
      'fail_count',       0,
      'requires_captcha', false
    );
  END IF;

  v_locked_now := r.locked_until IS NOT NULL AND r.locked_until > now();

  RETURN jsonb_build_object(
    'locked',                v_locked_now,
    'locked_until',          r.locked_until,
    'fail_count',            r.fail_count,
    -- CAPTCHA threshold = 2 fails (so it shows on attempt #3)
    'requires_captcha',      r.fail_count >= 2,
    'seconds_until_unlock',  GREATEST(0, EXTRACT(EPOCH FROM (r.locked_until - now()))::int)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- fn_detect_brute_force_ips — alerting cron
-- Returns a row per offender IP with stats; NULL p_window/p_threshold use
-- defaults of 15 minutes / 20 distinct accounts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_detect_brute_force_ips(
  p_window_minutes integer DEFAULT 15,
  p_threshold      integer DEFAULT 20
)
RETURNS TABLE (
  ip_address          inet,
  attempt_count       bigint,
  distinct_accounts   bigint,
  first_seen          timestamptz,
  last_seen           timestamptz,
  sample_user_agents  text[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    ip_address,
    count(*) AS attempt_count,
    count(DISTINCT email) AS distinct_accounts,
    min(created_at) AS first_seen,
    max(created_at) AS last_seen,
    (array_agg(DISTINCT user_agent))[1:5] AS sample_user_agents
  FROM public.failed_login_attempts
  WHERE created_at >= now() - make_interval(mins => p_window_minutes)
    AND ip_address IS NOT NULL
  GROUP BY ip_address
  HAVING count(*) >= p_threshold
      OR count(DISTINCT email) >= GREATEST(5, p_threshold / 4)
  ORDER BY attempt_count DESC
$$;

-- ---------------------------------------------------------------------------
-- fn_force_password_reset — admin-callable: marks user as must-reset, logs it.
-- Caller must be a verified rbs_admin (verified via auth.uid()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_force_password_reset(
  p_user_id uuid,
  p_reason  text DEFAULT 'compromised_account'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Only super_admins may force-reset other accounts (defence-in-depth — the
  -- service-role caller has already been gated, but let's not rely on that).
  IF NOT EXISTS (
    SELECT 1 FROM public.rbs_admins
    WHERE user_id = v_caller AND role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  INSERT INTO public.forced_password_resets (user_id, reason, enforced_by)
  VALUES (p_user_id, p_reason, v_caller)
  ON CONFLICT (user_id) DO UPDATE
    SET reason       = EXCLUDED.reason,
        enforced_by  = EXCLUDED.enforced_by,
        enforced_at  = now(),
        consumed_at  = NULL;

  -- Audit
  INSERT INTO public.security_audit_log
    (user_id, restaurant_id, activity_type, risk_score, details)
  VALUES
    (p_user_id, NULL, 'forced_password_reset', 80,
     jsonb_build_object('reason', p_reason, 'enforced_by', v_caller));
END;
$$;

-- ---------------------------------------------------------------------------
-- fn_consume_forced_reset — called by the password-reset flow once user has
-- successfully picked a new password. Caller must be the user themselves.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_consume_forced_reset(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'caller must be the target user';
  END IF;

  UPDATE public.forced_password_resets
  SET consumed_at = now()
  WHERE user_id = p_user_id AND consumed_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants — keep mutating funcs locked to service_role; allow consume from user.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_record_failed_login(citext, inet, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_clear_failed_logins(citext)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_check_login_lockout(citext)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_detect_brute_force_ips(integer, integer)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_force_password_reset(uuid, text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_consume_forced_reset(uuid)                    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_record_failed_login(citext, inet, text, text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_clear_failed_logins(citext)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_check_login_lockout(citext)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_detect_brute_force_ips(integer, integer)       TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_force_password_reset(uuid, text)               TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_consume_forced_reset(uuid)                     TO authenticated;
