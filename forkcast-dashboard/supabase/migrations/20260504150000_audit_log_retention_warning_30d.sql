-- 20260504150000_audit_log_retention_warning_30d.sql
--
-- Lower the default warning retention from 90 days to 30 days.
--
-- Reason: a one-time phone-number backfill on ~2026-04-20 produced ~101k
-- profile.sensitive_updated rows in a single week. 90-day retention kept all
-- of them. Steady-state warning volume is small (~80/day), so 30 days is
-- ample for security investigations and matches the info retention.
--
-- Only the function default changes; the body, search_path, security
-- attributes, grants, and cron schedule are unchanged.

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_info_days     int DEFAULT 30,
  p_warning_days  int DEFAULT 30,
  p_critical_days int DEFAULT 365,
  p_security_days int DEFAULT 180,
  p_batch         int DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_info_deleted     bigint := 0;
  v_warning_deleted  bigint := 0;
  v_critical_deleted bigint := 0;
  v_sec_deleted      bigint := 0;
  v_chunk            bigint;
  v_max_iterations   int := 5000;
  v_i                int;
BEGIN
  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.audit_logs
      WHERE id IN (
        SELECT id FROM public.audit_logs
        WHERE severity IN ('debug', 'info')
          AND created_at < now() - make_interval(days => p_info_days)
        ORDER BY created_at
        LIMIT p_batch
      )
      RETURNING 1
    )
    SELECT count(*) INTO v_chunk FROM d;
    v_info_deleted := v_info_deleted + v_chunk;
    EXIT WHEN v_chunk = 0;
  END LOOP;

  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.audit_logs
      WHERE id IN (
        SELECT id FROM public.audit_logs
        WHERE severity = 'warning'
          AND created_at < now() - make_interval(days => p_warning_days)
        ORDER BY created_at
        LIMIT p_batch
      )
      RETURNING 1
    )
    SELECT count(*) INTO v_chunk FROM d;
    v_warning_deleted := v_warning_deleted + v_chunk;
    EXIT WHEN v_chunk = 0;
  END LOOP;

  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.audit_logs
      WHERE id IN (
        SELECT id FROM public.audit_logs
        WHERE severity IN ('error', 'critical')
          AND created_at < now() - make_interval(days => p_critical_days)
        ORDER BY created_at
        LIMIT p_batch
      )
      RETURNING 1
    )
    SELECT count(*) INTO v_chunk FROM d;
    v_critical_deleted := v_critical_deleted + v_chunk;
    EXIT WHEN v_chunk = 0;
  END LOOP;

  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.security_audit_log
      WHERE id IN (
        SELECT id FROM public.security_audit_log
        WHERE created_at < now() - make_interval(days => p_security_days)
        ORDER BY created_at
        LIMIT p_batch
      )
      RETURNING 1
    )
    SELECT count(*) INTO v_chunk FROM d;
    v_sec_deleted := v_sec_deleted + v_chunk;
    EXIT WHEN v_chunk = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'audit_logs_info_deleted',     v_info_deleted,
    'audit_logs_warning_deleted',  v_warning_deleted,
    'audit_logs_critical_deleted', v_critical_deleted,
    'security_audit_log_deleted',  v_sec_deleted,
    'completed_at',                now()
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'cleanup_old_audit_logs failed.' USING ERRCODE = 'P0001';
END;
$fn$;
