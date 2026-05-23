-- 20260504130000_audit_log_retention.sql
--
-- Tiered retention for audit_logs and security_audit_log.
--
-- Why: audit_logs reached ~270k rows / 242 MB, dominated by profile.updated
-- noise from the auth flow. Index pages/scans are slow even though there are
-- indexes on (created_at) and partial (severity).
--
-- Retention policy:
--   audit_logs.severity IN ('debug','info')      → 30 days
--   audit_logs.severity = 'warning'              → 30 days
--   audit_logs.severity IN ('error','critical')  → 365 days
--   security_audit_log (all rows)                → 180 days
--
-- Function is SECURITY DEFINER (matches cleanup_old_notifications) so the
-- pg_cron worker can run it regardless of role-level grants. EXECUTE is
-- locked down to postgres + service_role only.
--
-- Deletes are chunked (default 5000 rows/batch) to avoid long row-lock holds
-- and keep autovacuum / replication latency healthy.

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
AS $$
DECLARE
  v_info_deleted     bigint := 0;
  v_warning_deleted  bigint := 0;
  v_critical_deleted bigint := 0;
  v_sec_deleted      bigint := 0;
  v_chunk            bigint;
  v_max_iterations   int := 5000;
  v_i                int;
BEGIN
  -- Tier 1: debug/info — 30 days
  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.audit_logs
      WHERE id IN (
        SELECT id
        FROM public.audit_logs
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

  -- Tier 2: warning — 90 days
  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.audit_logs
      WHERE id IN (
        SELECT id
        FROM public.audit_logs
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

  -- Tier 3: error/critical — 365 days
  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.audit_logs
      WHERE id IN (
        SELECT id
        FROM public.audit_logs
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

  -- security_audit_log — 180 days
  v_i := 0;
  LOOP
    v_i := v_i + 1;
    EXIT WHEN v_i > v_max_iterations;
    WITH d AS (
      DELETE FROM public.security_audit_log
      WHERE id IN (
        SELECT id
        FROM public.security_audit_log
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
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs(int, int, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs(int, int, int, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs(int, int, int, int, int) TO postgres, service_role;

-- Schedule daily at 04:30 UTC (after daily-maintenance at 03:00).
-- Idempotent: drop the existing job before re-creating.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-audit-logs') THEN
    PERFORM cron.unschedule('cleanup-audit-logs');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-audit-logs',
  '30 4 * * *',
  $cron$SELECT public.cleanup_old_audit_logs();$cron$
);
