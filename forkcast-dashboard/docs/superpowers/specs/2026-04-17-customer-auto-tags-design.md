# Customer Automated Tags — Design Spec

**Status:** Draft (pending user approval)
**Date:** 2026-04-17
**Owner:** CRM area / guests page
**Related tables:** `customer_tags`, `customer_tag_assignments`, `restaurant_customers`, `bookings`, `profiles`

## Problem

Today, seven automated guest tags (`Regular`, `Frequent`, `New Guest`, `No-Show Risk`, `Large Groups`, `High Spender`, `Weekend Regular`) are computed in the client component `components/basic/basic-booking-details-dialog.tsx` and rendered only when that dialog is opened. They are not persisted, so they cannot filter the customers list, do not appear on the customer-details dialog, and are re-computed on every render. A lot of useful customer data (`cancelled_count`, `last_visit`, `vip_status`, DOB, allergies, dietary restrictions, `occasion`, loyalty tier, booking time-of-day) is never turned into a tag.

## Goals

1. **Persisted, filterable** — auto-tags live in `customer_tag_assignments` so the existing tag filter on the customers list just works.
2. **Automatic** — tags update when booking state changes or customer stats change, without app code remembering to call a refresh.
3. **Meaningful** — ~30 tags covering loyalty, recency, value, reliability, party profile, timing, and special attention.
4. **Safe** — trigger failures must never block booking writes. System tags cannot be deleted/edited by staff.
5. **Transparent** — system tags render with a bolt/lock icon and a tooltip describing the rule.

## Non-goals

- Per-restaurant configurable thresholds (hard-coded defaults for v1; can be added later).
- Historical audit of tag transitions.
- Pushing tag state to external CRMs.

## Architecture

DB-backed, trigger-driven (Option B from brainstorming).

```
booking status change ─┐
customer stats update ─┼─► trigger ──► refresh_customer_auto_tags(customer_id)
manual "Refresh" btn ──┘                    │
                                            ├─► computes desired tag set from
                                            │   restaurant_customers + bookings + profiles
                                            └─► upserts/deletes rows in
                                                customer_tag_assignments (is_auto = true)
```

A parallel TypeScript utility (`lib/customer-auto-tags.ts`) mirrors the SQL rules for **instant preview in the booking dialog** — but persistence is always DB-driven. If preview disagrees with DB, the DB wins on reload.

## Schema changes

### `customer_tags` — mark system tags

```sql
ALTER TABLE public.customer_tags
  ADD COLUMN is_system  boolean NOT NULL DEFAULT false,
  ADD COLUMN system_key text,
  ADD COLUMN icon       text,
  ADD COLUMN category   text,
  ADD COLUMN priority   integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX customer_tags_system_unique
  ON public.customer_tags(restaurant_id, system_key)
  WHERE system_key IS NOT NULL;
```

- `system_key` is the stable rule identifier (e.g. `loyal`, `lapsed`, `no_show_risk`).
- `icon` holds a lucide icon name for the UI badge.
- `category` groups tags in the UI: `loyalty`, `recency`, `value`, `reliability`, `party`, `timing`, `attention`.
- `priority` controls display order.

### `customer_tag_assignments` — mark which rows are auto-managed

```sql
ALTER TABLE public.customer_tag_assignments
  ADD COLUMN is_auto                 boolean     NOT NULL DEFAULT false,
  ADD COLUMN last_auto_refreshed_at  timestamptz;

CREATE UNIQUE INDEX customer_tag_assignments_unique
  ON public.customer_tag_assignments(customer_id, tag_id);
```

The unique index prevents the refresh function from inserting duplicates (ON CONFLICT target).

### Seed — system tags per restaurant

Function `public.ensure_system_tags_for_restaurant(restaurant_id uuid)` inserts (ON CONFLICT DO NOTHING) all ~30 system tags for that restaurant. Called:
- Once per restaurant during backfill.
- Defensively at the top of `refresh_customer_auto_tags()` so newly added system tag definitions propagate without a manual seed.

## Tag catalog

Every tag: `system_key`, `name`, `category`, `color` (hex), `icon` (lucide), `priority`, `description`, `rule`.

Mutually exclusive groups are marked **(exclusive)** — only one is assigned at a time within the group.

### Loyalty (exclusive — based on completed-visit count)
| key | name | color | rule |
|---|---|---|---|
| `first_timer`    | First-Timer    | `#a855f7` | `completed = 1` and first_visit within 60d |
| `repeat_guest`   | Repeat Guest   | `#6366f1` | `completed BETWEEN 2 AND 4` |
| `regular`        | Regular        | `#22c55e` | `completed BETWEEN 5 AND 14` |
| `frequent`       | Frequent       | `#3b82f6` | `completed BETWEEN 15 AND 29` |
| `loyal`          | Loyal          | `#f59e0b` | `completed >= 30` |

### Recency (exclusive — based on `last_visit`)
| key | name | color | rule |
|---|---|---|---|
| `active`       | Active       | `#10b981` | last visit ≤ 30d |
| `lapsing`      | Lapsing      | `#eab308` | last visit 31–90d |
| `lapsed`       | Lapsed       | `#f97316` | last visit 91–180d |
| `dormant`      | Dormant      | `#6b7280` | last visit > 180d |
| `welcome_back` | Welcome Back | `#06b6d4` | visited in last 14d **and** had a ≥90d gap before |

### Value
| key | name | color | rule |
|---|---|---|---|
| `high_spender` | High Spender | `#14b8a6` | `total_spent BETWEEN 500 AND 1999` |
| `top_spender`  | Top Spender  | `#0ea5e9` | `total_spent BETWEEN 2000 AND 4999` |
| `whale`        | Whale        | `#8b5cf6` | `total_spent >= 5000` |

### Reliability
| key | name | color | rule |
|---|---|---|---|
| `reliable`          | Reliable          | `#16a34a` | ≥5 completed, 0 no-shows, cancel-rate < 10% |
| `no_show_risk`      | No-Show Risk      | `#ef4444` | `no_show_count >= 2` |
| `frequent_canceller`| Frequent Canceller| `#dc2626` | `cancelled_count >= 3` or cancel-rate > 40% with ≥5 bookings |
| `at_risk`           | At-Risk           | `#b91c1c` | ≥3 no-shows + cancels combined in last 90 days |

### Party profile
| key | name | color | rule |
|---|---|---|---|
| `solo_diner`  | Solo Diner  | `#64748b` | avg party size < 1.5, ≥3 bookings |
| `couple`      | Couple      | `#ec4899` | avg party size 1.5–2.5, ≥3 bookings |
| `small_group` | Small Group | `#f472b6` | avg party size 2.5–4.9, ≥3 bookings |
| `large_group` | Large Group | `#f59e0b` | avg party size ≥ 5 |
| `event_host`  | Event Host  | `#d946ef` | ≥2 completed bookings with party_size ≥ 8 |

### Timing
| key | name | color | rule |
|---|---|---|---|
| `weekend_regular` | Weekend Regular | `#6366f1` | >60% visits on Sat/Sun, ≥3 visits |
| `weekday_regular` | Weekday Regular | `#0d9488` | >70% visits on Mon–Fri, ≥5 visits |
| `lunch_guest`     | Lunch Guest     | `#fbbf24` | >60% visits 11:00–15:00, ≥3 visits |
| `dinner_guest`    | Dinner Guest    | `#7c3aed` | >60% visits 17:00–22:00, ≥3 visits |
| `late_diner`      | Late Diner      | `#1e293b` | >30% visits after 21:00, ≥3 visits |

### Special attention
| key | name | color | rule |
|---|---|---|---|
| `birthday_month`     | Birthday This Month | `#f43f5e` | `profile.date_of_birth` month = current month |
| `celebrator`         | Celebrator          | `#fb7185` | ≥3 bookings with non-empty occasion |
| `allergy_alert`      | Allergy Alert       | `#dc2626` | `profile.allergies` non-empty |
| `dietary_restriction`| Dietary Restriction | `#84cc16` | `profile.dietary_restrictions` non-empty |
| `vip`                | VIP                 | `#eab308` | `vip_status = true` |
| `blacklisted`        | Blacklisted         | `#111827` | `blacklisted = true` |
| `loyalty_member`     | Loyalty Member      | `#a855f7` | `profile.loyalty_points > 0` or `membership_tier <> 'bronze'` |
| `special_requests`   | Special Requests    | `#0891b2` | ≥50% of completed bookings have non-empty special_requests, min 3 bookings |

## Function: `refresh_customer_auto_tags(customer_id)`

Signature:
```sql
CREATE FUNCTION public.refresh_customer_auto_tags(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER;
```

Steps:
1. Load `restaurant_customers` row; bail if missing.
2. Call `ensure_system_tags_for_restaurant(restaurant_id)` (idempotent).
3. Load linked `profiles` row (if `user_id` present).
4. Compute aggregate metrics from `bookings` scoped by `restaurant_id` and matched by `user_id` OR `guest_email`.
5. Build the desired `system_key[]` set according to the rule table.
6. In one statement: `DELETE` auto-assignments whose `system_key` isn't in the desired set.
7. `INSERT ... ON CONFLICT DO UPDATE` auto-assignments for every `system_key` in the desired set.
8. All wrapped in `SECURITY DEFINER` so RLS doesn't block it.

## Triggers

**On `bookings` — refresh the affected customer:**

```sql
CREATE TRIGGER trg_bookings_refresh_auto_tags
AFTER INSERT OR UPDATE OF status, booking_time, party_size, special_requests, occasion
OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.on_booking_change_refresh_tags();
```

The trigger function looks up the matching `restaurant_customers` row (by `user_id` or `guest_email`) and calls `refresh_customer_auto_tags()`. Wrapped in `EXCEPTION WHEN OTHERS THEN RETURN NEW` so a tagging failure cannot block a booking write.

**On `restaurant_customers` — refresh when its own stats change:**

```sql
CREATE TRIGGER trg_customers_refresh_auto_tags
AFTER UPDATE OF total_bookings, total_spent, average_party_size,
                last_visit, no_show_count, cancelled_count,
                vip_status, blacklisted
ON public.restaurant_customers
FOR EACH ROW EXECUTE FUNCTION public.on_customer_stats_change_refresh_tags();
```

## Bulk refresh RPC

```sql
CREATE FUNCTION public.refresh_all_customer_auto_tags(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER;
```

Iterates every customer for the restaurant, calls the per-customer refresh, returns the count refreshed. Exposed to authenticated staff of the restaurant (checked via `restaurant_staff`).

## UI changes

1. **`lib/customer-auto-tags.ts`** (new) — exports `SYSTEM_TAG_CATALOG` (metadata) and `computePreviewTags(customer, history, profile)` mirroring SQL rules for instant previews.
2. **`components/basic/basic-booking-details-dialog.tsx`** — remove the inline `generateAutoTags`; fetch assignments from DB (already does) and render auto+manual together with a small bolt/lock icon on `is_auto` ones.
3. **`components/customers/customer-details-dialog.tsx`** — already renders assignments; add the same auto-tag styling.
4. **`app/(dashboard)/customers/page.tsx`** — add a "Refresh tags" button in the header that calls the bulk RPC and invalidates the customers query. Tag filter already works (uses assignments).
5. **`components/customers/tag-management-dialog.tsx`** — hide system tags from edit/delete; show them in a read-only "Automated tags" section with tooltips describing rules.
6. **Assignment protection** — `handleToggleTag` in both dialogs refuses to toggle assignments where the underlying tag has `is_system = true`.

## Edge cases & safety

- **Guest vs user match** — customer/booking matching uses `user_id` when set, else `guest_email`. If both are null (walk-in), we skip refresh.
- **Recursive triggers** — the refresh function only writes to `customer_tag_assignments`; no trigger on that table calls back to bookings. No recursion risk.
- **Volume** — 23k customers × ~30 tags = worst-case 690k assignments. Indexes on `(customer_id, tag_id)` and `(restaurant_id, system_key)` keep lookups fast.
- **Trigger exception isolation** — every trigger function catches and swallows exceptions, returning NEW. Tags can never block booking ops.
- **Partial data** — profile can be null (guest bookings); those rules are skipped (no error).
- **VIP expiry** — `restaurant_vip_users` has `valid_until`; v1 uses `restaurant_customers.vip_status` for simplicity. A follow-up can sync VIP from the VIP-users table via its own trigger.

## Rollback plan

Migration is reversible:
- Triggers can be dropped cleanly.
- Functions can be dropped.
- Added columns can be dropped (or left — they default to false/null).
- System rows in `customer_tags` can be deleted with `WHERE is_system = true`.

A single `DROP TRIGGER ... ; DROP FUNCTION ... ; DELETE FROM customer_tags WHERE is_system = true;` restores pre-migration behavior. Manual tags are untouched.

## Verification plan

After applying:
1. `SELECT COUNT(*) FROM customer_tags WHERE is_system = true` → expect ~30 × 141 = ~4,230.
2. Run `refresh_all_customer_auto_tags(r.id)` for every restaurant; sum rows.
3. Spot-check: pick 5 customers with known booking histories, verify tag set matches rules.
4. Insert/update a booking, confirm the trigger fires and the assignments change.
5. Run `npm run build` and `npm run lint` — no new errors.
6. Manually open the customers page and a booking dialog; confirm tags render with the bolt icon.
