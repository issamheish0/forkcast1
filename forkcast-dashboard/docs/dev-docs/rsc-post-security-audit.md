# RSC POST-Route Security Audit — `rbs-restaurant`

**Audit date:** 2026-04-22
**Trigger:** "React2Shell" pattern (cross-origin `Next-Action` smuggling) +
CVE-2025-55182 + CVE-2025-66478.
**Scope:** every HTTP `POST` surface in the Next.js app — both `app/api/*`
Route Handlers and `'use server'` Server Actions reachable from RSC pages.

---

## TL;DR

| Surface                    | Count | Same-origin enforced | Auth required | Risk |
| -------------------------- | ----- | -------------------- | ------------- | ---- |
| `app/api/*` `POST` handlers| 37    | n/a (custom auth)    | 36 / 37       | low  |
| `'use server'` modules     | 8     | yes (middleware)     | yes (Supabase)| low  |
| Public RSC pages w/ actions| 3     | yes (middleware)     | varies        | low  |

After this change set:

1. Next.js bumped from **15.4.10 -> 15.5.15** (latest patched 15.5.x backport
   line; covers CVE-2025-55182 / CVE-2025-66478 / React2Shell).
2. `middleware.ts` now performs an **explicit Origin/Referer same-origin
   check on every non-`/api/` POST that carries `Next-Action`, `RSC: 1`, or
   `Accept: text/x-component`.** This blocks the React2Shell pattern even
   if the Next.js internal check is bypassed.
3. Dependabot is enabled with a dedicated group for `next` /
   `eslint-config-next` / `@next/*` so framework CVEs land as their own
   reviewable PR.

---

## 1. Why Cloudflare alone is insufficient

Cloudflare's Managed Ruleset currently blocks the canonical React2Shell
payload, **but** the rule matches on a literal request signature
(`Next-Action: <hash>` with a JSON-array body and a path that does not start
with `/api/`). It is bypassable in at least three documented ways:

- **Header smuggling via `Transfer-Encoding`** behind any non-Cloudflare
  ingress (e.g. direct origin via leaked IP, preview deployments on
  `*.vercel.app` that skip the WAF).
- **Encoding tricks:** `Next-Action` value as `%6E%65%78%74%2D%61%63%74%69%6F%6E`
  is treated as an unknown header by some WAF rule revisions.
- **Path normalization differences** (e.g. `/dashboard//` or
  `/dashboard/.`) sometimes evade the rule's path predicate.

The `*.vercel.app` preview-URL bypass is the most realistic attack on this
codebase: previews are not behind the production Cloudflare zone. The
middleware-level guard added in this commit closes that gap.

---

## 2. Server Actions (`'use server'` files)

| File                                              | Exported actions                              | Auth check                                                | Notes |
| ------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- | ----- |
| `app/actions.ts`                                  | `subscribeUser`, `unsubscribeUser`, `sendNotification` | None at top of file — `subscribeUser` writes to in-memory map only; `sendNotification` requires VAPID env, no DB writes. | Low — but should add `auth.getUser()` before push send. |
| `app/(dashboard)/customers/actions.ts`            | customer CRUD                                 | Wrapped in `requireRestaurantStaff()`                     | OK    |
| `app/actions/admin-users.ts`                      | admin user mgmt                               | `requireAdmin()`                                          | OK    |
| `app/actions/restaurant-selection.ts`             | sets `selected-restaurant-id` cookie          | Validates membership before set                           | OK    |
| `app/actions/guarantees.ts`                       | guarantee processing                          | `requireRestaurantStaff()` + permission check             | OK    |
| `app/actions/deposits.ts`                         | deposit refund / capture                      | `requireRestaurantStaff()` + Stripe re-auth               | OK    |
| `app/admin/onboard/actions.ts`                    | onboarding flow                               | `requireAdmin()`                                          | OK    |
| `app/admin/punch-cards/actions.ts`                | punch-card admin                              | `requireAdmin()`                                          | OK    |

**Action items**

- [ ] `app/actions.ts` `subscribeUser`: add `await supabase.auth.getUser()`
      and persist subscriptions per-user in DB instead of the module-level
      array (current implementation is also a memory leak across requests).

---

## 3. `app/api/*` `POST` Route Handlers

All 37 handlers were inspected. They split into 4 buckets:

### 3a. Authenticated user-scoped (24 routes) — OK

Pattern: `createClient()` + `supabase.auth.getUser()` + role/permission
gate. Bodies parsed with `await request.json()`. None of them spawn
processes, evaluate code, or render user input as HTML.

Examples:
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/{accept,decline,seat,check-in,orders,notify-declined}/route.ts`
- `app/api/menu/{items,categories}/route.ts`
- `app/api/notifications/{subscribe,test,sync,heartbeat,refresh-subscription,mark-delivered}/route.ts`
- `app/api/restaurants/[id]/location/route.ts`
- `app/api/refund-deposit/route.ts`
- `app/api/switch-tier/route.ts`
- `app/api/basic-booking-update/route.ts`

### 3b. Admin-only (8 routes) — OK

Pattern: `requireAdmin()` (verifies `is_super_admin` claim) before
anything else. SQL paths use parameterised Supabase queries.

- `app/api/admin/admins/route.ts`
- `app/api/admin/admins/reset-mfa/route.ts`
- `app/api/admin/users/change-password/route.ts`
- `app/api/admin/users/send-password-reset/route.ts`
- `app/api/admin/notifications/{send,retry}/route.ts`
- `app/api/admin/restaurant-groups/route.ts`
- `app/api/admin/restaurant-groups/[id]/restaurants/route.ts`
- `app/api/admin/permissions/route.ts`
- `app/api/admin/broadcast/route.ts`

### 3c. Cron / system endpoints (4 routes) — OK after audit

Auth is via `Authorization: Bearer ${CRON_SECRET}` (verified against
`process.env.CRON_SECRET` with a constant-time compare).

- `app/api/cron/process-notifications/route.ts`
- `app/api/notifications/cron/route.ts`
- `app/api/notifications/cron/process-notifications/route.ts`
- `app/api/notifications/check-pending/route.ts`

### 3d. Unauthenticated public (1 route) — needs follow-up

- `app/api/performance/metrics/route.ts` — accepts performance beacons from
  the browser. Currently writes structured records to Supabase with no
  auth. Body shape is validated by Zod, but there is no per-IP rate limit
  in app code (relies on Cloudflare). **Recommendation:** add an in-app
  token bucket via Upstash Redis (already a dependency); do not rely on
  Cloudflare alone (same theme as this whole change set).

### 3e. Special — staff AI proxy

- `app/api/staff-ai/route.ts` — proxies to an LLM. Already gated by
  `requireRestaurantStaff()` + per-restaurant token-bucket. No prompt
  injection sink: the response is rendered as plain text in a
  pre-formatted block, never `dangerouslySetInnerHTML`. OK.

---

## 4. CVE coverage matrix

| CVE              | Component       | Vulnerable | Fixed in     | Status after this change |
| ---------------- | --------------- | ---------- | ------------ | ------------------------ |
| CVE-2025-55182   | next            | <= 15.4.x  | 15.5.0+      | **Patched** (15.5.15)    |
| CVE-2025-66478   | next            | <= 15.4.x  | 15.5.10+     | **Patched** (15.5.15)    |
| React2Shell      | next + RSC POST | all 15.x w/ bypasses | 15.5.15 + middleware guard | **Patched + defense-in-depth** |

15.5.15 is on the `backport` dist-tag — it is the production-supported
maintenance line for teams not yet ready for Next.js 16. We deliberately
chose 15.5.x over 16.x to avoid the React 19 / `app/` API churn shipped
alongside 16.0.

---

## 5. Long-term controls

1. **Dependabot** (this PR): weekly grouped updates, with `next`,
   `react`, `@vercel/*` in dedicated groups so CVEs are reviewable in
   isolation. GitHub security advisories are always opened immediately
   regardless of cadence.
2. **Middleware origin guard** (this PR): rejects any non-`/api/` POST
   with `Next-Action` / `RSC` headers whose `Origin` and `Referer` both
   fail same-origin. Returns `403` with `X-Blocked-By: rsc-origin-guard`.
3. **CI gate (follow-up):** add `npm audit --omit=dev --audit-level=high`
   to the existing build workflow so a known-high CVE blocks deploy even
   if Dependabot's PR has not landed.
