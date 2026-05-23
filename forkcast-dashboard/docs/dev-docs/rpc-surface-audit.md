# RPC Surface Audit — `rbs-restaurant`

**Audit date:** 2026-04-22
**Trigger:** W02 finding — *"the list of exposed RPCs in the report is not exhaustive"*.
**Source of truth:** the `auth.routines` / `pg_proc` catalogue in the live
Supabase project. The list below is the **client-call inventory** (every
`supabase.rpc(...)` site in the codebase) plus every `CREATE FUNCTION`
shipped in `supabase/migrations/`.

> ⚠️ **Note.** Migrations in this repo are not exhaustive — historical
> functions live only in the Supabase project. The query at the end of
> this document MUST be run against production to confirm the live set.

---

## 1. RPCs called from application code

The columns are: function name, callsites, expected caller role, observed
authz pattern (gate-before-RPC vs. inside-RPC), and risk classification.

| RPC name                                       | Callsites                                                                                          | Expected caller        | AuthZ pattern                              | Risk |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ | ---- |
| `get_restaurant_shared_tables_summary`         | hooks/use-shared-tables.ts                                                                         | restaurant staff       | RLS on inputs                              | low  |
| `get_shared_table_available_seats`             | hooks/use-shared-tables.ts, components/bookings/manual-booking-form.tsx                            | restaurant staff/anon  | function grants `authenticated, anon`      | **medium — review** |
| `is_waitlist_time`                             | lib/booking-request-service.ts, lib/hooks/use-waitlist-status.ts                                   | any auth user          | inputs are restaurant_id only              | low  |
| `find_alternative_slots`                       | lib/booking-request-service.ts                                                                     | restaurant staff       | RLS on inputs                              | low  |
| `convert_waitlist_to_booking`                  | components/basic/waitlist-manager.tsx, app/(dashboard)/waitlist/page.tsx, app/(dashboard)/dashboard/page.tsx | restaurant staff       | RLS on tables touched                      | low  |
| `increment_event_bookings`                     | components/basic/manual-booking-dialog.tsx                                                         | restaurant staff       | RLS                                        | low  |
| `search_customers_fuzzy`                       | components/basic/basic-manual-booking-form.tsx                                                     | restaurant staff       | RLS on customer table                      | low  |
| `get_public_profile_info`                      | components/basic/guarantees-dashboard.tsx ×2, app/(dashboard)/deposits/page.tsx                    | any auth user          | function should restrict columns           | **medium — verify column whitelist** |
| `check_booking_overlap`                        | lib/table-availability.ts ×3                                                                       | restaurant staff       | RLS on bookings                            | low  |
| `search_profiles_admin`                        | 6 callsites (admin pages, customer page, staff page, bookings hook, waitlist view)                 | rbs_admin only         | `SECURITY DEFINER`, internal `is_super_admin` check missing | **HIGH — see §3** |
| `get_booking_guarantee_details`                | app/actions/guarantees.ts, components/bookings/penalty-dialog.tsx                                  | restaurant staff       | server action gated                        | low  |
| `staff_cancel_booking_with_guarantee`          | app/actions/guarantees.ts                                                                          | restaurant staff       | server action gated                        | low  |
| `check_event_capacity`                         | lib/hooks/use-events.ts                                                                            | any auth user          | read-only                                  | low  |
| `update_waitlist_status`                       | components/dashboard/waitlist-panel.tsx                                                            | restaurant staff       | RLS on waitlist                            | low  |
| `refresh_all_customer_auto_tags`               | app/(dashboard)/customers/page.tsx                                                                 | restaurant staff       | restaurant_id arg                          | low  |
| `merge_customers`                              | app/(dashboard)/customers/actions.ts                                                               | restaurant staff       | server action gated                        | low  |
| `increment_customer_bookings`                  | app/(dashboard)/dashboard/page.tsx                                                                 | restaurant staff       | RLS                                        | low  |
| `get_ad_analytics_summary`                     | app/api/admin/analytics/ads/route.ts                                                               | rbs_admin              | route gated by `requireAdmin`              | low  |
| `get_featured_restaurant_analytics`            | app/api/admin/analytics/ads/route.ts                                                               | rbs_admin              | route gated                                | low  |
| `get_banner_analytics`                         | app/api/admin/analytics/ads/route.ts                                                               | rbs_admin              | route gated                                | low  |
| `admin_retry_notifications`                    | app/api/admin/notifications/retry/route.ts                                                         | rbs_admin              | route gated                                | low  |
| `admin_list_notification_campaigns`            | app/admin/notifications/page.tsx                                                                   | rbs_admin              | layout gated                               | low  |
| `get_campaign_analytics`                       | app/admin/notifications/page.tsx                                                                   | rbs_admin              | layout gated                               | low  |
| `get_campaign_outbox_analytics`                | app/admin/notifications/page.tsx                                                                   | rbs_admin              | layout gated                               | low  |
| `admin_get_notification_stats`                 | app/admin/notifications/page.tsx                                                                   | rbs_admin              | layout gated                               | low  |
| `get_admin_booking_stats`                      | app/admin/restaurants/page.tsx                                                                     | rbs_admin              | layout gated                               | low  |
| `admin_delete_restaurant`                      | app/admin/restaurants/page.tsx                                                                     | rbs_admin              | function checks admin internally           | low  |
| `get_activation_metrics`                       | app/admin/reports/page.tsx, app/admin/users/AnalyticsTab.tsx                                       | rbs_admin              | layout gated                               | low  |
| `get_daily_activation_rates`                   | app/admin/users/AnalyticsTab.tsx                                                                   | rbs_admin              | layout gated                               | low  |
| `admin_list_users`                             | app/admin/users/page.tsx                                                                           | rbs_admin              | layout gated                               | low  |
| `admin_count_users`                            | app/admin/users/page.tsx ×3                                                                        | rbs_admin              | layout gated                               | low  |
| `get_user_booking_counts`                      | app/admin/users/page.tsx                                                                           | rbs_admin              | granted to `authenticated`                 | **medium — check internal admin check** |
| `get_total_users_count`                        | app/admin/users/page.tsx                                                                           | rbs_admin              | n/a — verify                                | **medium** |
| `get_active_users_count`                       | app/admin/users/page.tsx                                                                           | rbs_admin              | granted to `authenticated`                 | **medium — check internal admin check** |
| `get_profile_aggregates`                       | app/admin/users/page.tsx                                                                           | rbs_admin              | granted to `authenticated`                 | **medium — check internal admin check** |
| `get_high_value_users_count`                   | app/admin/users/page.tsx                                                                           | rbs_admin              | n/a — verify                                | **medium** |

### W02 follow-up RPCs (new in this change set)

| RPC name                              | Defined in                                                          | Caller             | Notes |
| ------------------------------------- | ------------------------------------------------------------------- | ------------------ | ----- |
| `fn_record_failed_login`              | 20260422120000_add_account_lockout_…sql                             | service_role only  | EXECUTE revoked from `anon`/`authenticated`. |
| `fn_clear_failed_logins`              | same                                                                | service_role only  | "                                            |
| `fn_check_login_lockout`              | same                                                                | service_role only  | read-only                                    |
| `fn_detect_brute_force_ips`           | same                                                                | service_role only  | called by `/api/cron/auth-bruteforce-alert`  |
| `fn_force_password_reset`             | same                                                                | service_role only  | extra inner `rbs_admins` check on `auth.uid()` |
| `fn_consume_forced_reset`             | same                                                                | authenticated user | inner `auth.uid() == p_user_id` check        |
| `_fn_lockout_duration` (helper)       | same                                                                | n/a (internal)     | IMMUTABLE                                    |

---

## 2. Functions defined in repo migrations

Pulled from `CREATE OR REPLACE FUNCTION` statements in `supabase/migrations/`:

```
get_activation_metrics()                          — 20250116000000
public.is_super_admin()                           — 20250118000000
public.prevent_duplicate_booking_handler()        — 20250119000000
get_shared_table_available_seats(uuid, ts, int)   — 20250902120000
get_restaurant_shared_tables_summary(uuid, date)  — 20250902120000
get_profile_aggregates()                          — 20260130000000
get_high_value_users_count()                      — 20260130000000
get_user_booking_counts()                         — 20260130000000
get_active_users_count(int)                       — 20260130000000
search_profiles_admin(text)                       — 20260327000001
admin_delete_restaurant(uuid)                     — 20260327000003
public.ensure_system_tags_for_restaurant(uuid)    — 20260417180000
public.refresh_customer_auto_tags(uuid)           — 20260417180000
public.refresh_all_customer_auto_tags(uuid)       — 20260417180000
public.on_booking_change_refresh_tags()           — 20260417180000 (trigger)
public.on_customer_stats_change_refresh_tags()    — 20260417180000 (trigger)
fn_record_failed_login / fn_clear_failed_logins / fn_check_login_lockout
  / fn_detect_brute_force_ips / fn_force_password_reset
  / fn_consume_forced_reset / _fn_lockout_duration  — 20260422120000 (NEW)
```

The number of **client `.rpc()` callsites (37)** exceeds the number of
**migrations-defined functions (~16)**, confirming the pentest report's
suspicion: *the canonical RPC set is not in this repo*. The remainder of
the production catalogue must be enumerated against the live database.

---

## 3. Findings

### F-1. `search_profiles_admin` is a `SECURITY DEFINER` over `auth.users` granted to all authenticated users

`supabase/migrations/20260327000001_add_search_profiles_admin.sql` defines:

```sql
CREATE OR REPLACE FUNCTION search_profiles_admin(search_query TEXT)
…
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION search_profiles_admin(TEXT) TO authenticated;
```

The function reads from `auth.users` and `profiles`. Because it is
`SECURITY DEFINER` and granted to `authenticated`, **any logged-in user
(including a basic-tier restaurant owner) can call it** and enumerate
profile data they could not otherwise read through RLS. The current
mitigation lives at the route layer (the call is only in admin pages),
but the function itself does not enforce the admin check.

**Recommended fix** (deferred — out of scope for this PR, requires DB
migration coordination):

```sql
CREATE OR REPLACE FUNCTION search_profiles_admin(search_query TEXT)
RETURNS …
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rbs_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  -- existing body
END;
$$;
```

### F-2. `get_profile_aggregates` / `get_active_users_count` / `get_user_booking_counts` granted to `authenticated`

Same pattern as F-1 in `20260130000000_add_user_stats_functions.sql`.
These return aggregate counts but rely on the caller being an admin.
Remediation: add an inner `is_super_admin()` check, or re-`GRANT` to a
narrower role (`service_role` only and call them from a route handler).

### F-3. `get_public_profile_info` returns columns not whitelisted in code

The migration is not in the repo, but the function name suggests "public
profile info". Verify it does not leak email, phone or other PII to
restaurant staff that should only see the customer fields they need.

### F-4. `get_shared_table_available_seats` granted to `anon`

`supabase/migrations/20250902120000_add_shared_table_support.sql` line 77
grants execute to both `authenticated` AND `anon`. This is intentional
(public booking widget) but should be confirmed against threat model. It
takes a `restaurant_id` so an attacker can probe arbitrary restaurants;
ensure any rate-limit covers it.

---

## 4. Live-DB enumeration query

Run this against the production Supabase database to obtain the
**exhaustive** list of callable RPCs along with their grants:

```sql
SELECT
  n.nspname                                                          AS schema,
  p.proname                                                          AS function,
  pg_get_function_identity_arguments(p.oid)                          AS args,
  CASE p.prosecdef WHEN TRUE THEN 'DEFINER' ELSE 'INVOKER' END       AS security,
  pg_get_userbyid(p.proowner)                                        AS owner,
  COALESCE(
    array_agg(DISTINCT
      CASE WHEN has_function_privilege('anon',          p.oid, 'EXECUTE') THEN 'anon'          END
    ) FILTER (WHERE has_function_privilege('anon',          p.oid, 'EXECUTE')),
    '{}'
  )                                                                  AS anon_can_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')          AS authenticated_can_exec,
  has_function_privilege('service_role',  p.oid, 'EXECUTE')          AS service_role_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
  AND p.prokind = 'f'
GROUP BY 1,2,3,4,5,p.oid
ORDER BY 1,2;
```

Cross-reference the output with this document; anything in the live DB
but missing from §1/§2 is an undocumented surface and should be triaged.

---

## 5. Action items

| #     | Action                                                                       | Owner   | Status |
| ----- | ---------------------------------------------------------------------------- | ------- | ------ |
| RPC-1 | Run §4 query in prod, paste the result into this doc (`§ 6. Live snapshot`) | backend | open   |
| RPC-2 | F-1: harden `search_profiles_admin` with internal admin check               | backend | open   |
| RPC-3 | F-2: harden user-stats RPCs the same way                                    | backend | open   |
| RPC-4 | F-3: review `get_public_profile_info` column projection                     | backend | open   |
| RPC-5 | Add a CI check that fails the build when a new `.rpc('foo', …)` callsite   |
|       | references a function not present in this audit                              | infra   | open   |

---

## 6. Live snapshot

> *Paste the output of the §4 query here after running it in prod.*
