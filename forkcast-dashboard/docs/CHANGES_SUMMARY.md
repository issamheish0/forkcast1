# Changes Summary - Floor Plan & Booking System Enhancements
   
**Date:** 2026-02-17
**Branch:** `issa-floor-plan`
     
---

## Overview

This document covers all changes made across the restaurant management web app (`rbs-restaurant`) and the mobile customer app (`RBS`) to implement client requirements for floor plan operations, booking workflows, and homepage routing.

---   

## 1. Orange Color for Upcoming Bookings (Web App)

**File:** `app/(dashboard)/floorplan/page.tsx`

Tables with an upcoming booking arriving within 60 minutes now display **orange** instead of green. Previously, orange was only used for overstay scenarios.

- Logic: If a table has a confirmed/checked-in booking with `booking_time` within the next 60 minutes, its fill color is set to `#f97316` (orange).
- This gives staff a visual heads-up that a table is about to be needed.

---

## 2. Multi-Table Merging for Bookings (Web App)

**Files:**
- `app/(dashboard)/floorplan/page.tsx` — `assignTableMutation` now accepts `{ bookingId, tableIds[], addToExisting? }`
- `components/floorplan/booking-details-drawer.tsx` — Added merge UI with checkbox selection, combined capacity indicator, and confirm button

**How it works:**
- When a booking already has tables assigned and a staff member drags it onto another table, the system **adds** the new table to the existing assignment (merge) instead of replacing.
- The booking details drawer shows a "Merge Tables" section where staff can select multiple available tables and see combined capacity.
- The `booking_tables` junction table supports many-to-many relationships between bookings and tables.

---

## 3. Late Arrival Detection & Display (Web App)

**Files:**
- `components/floorplan/bookings-panel.tsx` — Late Arrivals Alert banner + internal `isLate` detection per booking card
- `components/floorplan/booking-details-drawer.tsx` — "No Show" button for late confirmed bookings

**How it works:**
- Computed client-side: any `confirmed` booking for today where `booking_time < now` is flagged as late.
- A red alert banner shows the count of late arrivals at the top of the bookings panel.
- Individual booking cards show a red "Late" badge with time elapsed.
- The booking details drawer shows a "Mark No Show" button for late bookings.

---

## 4. Auto-Assign Instant Table on Booking Creation (Web App)

**File:** `lib/booking-request-service.ts`

**How it works:**
- After an instant booking is created (not a request), the system automatically attempts to assign the smallest fitting available table in the customer's preferred section.
- The `autoAssignTable()` method queries available tables, checks for time conflicts, and inserts into `booking_tables`.
- This is **non-blocking** — if auto-assign fails, the booking still succeeds without a table (staff can assign manually later).
- The `preferred_section` field is saved on the booking record for reference.

---

## 5. Floor Plan as Default Homepage for Basic+Addon Restaurants (Web App)

**Files modified:**
- `app/page.tsx` — Server-side root redirect now checks for `floor_plan` addon
- `app/(dashboard)/dashboard/page.tsx` — Client-side guard redirects basic+floor_plan users to `/floorplan`
- `lib/contexts/restaurant-context.tsx` — Restaurant switching routes basic+floor_plan users to `/floorplan`
- `components/layout/nav-config.ts` — Added "Floor Plan" (live view) nav item with `Map` icon
- `components/layout/sidebar.tsx` — No changes needed (uses `hasFeature()` which already checks addons)

**Routing behavior:**

| Scenario | Basic (no addon) | Basic + `floor_plan` addon | Pro |
|---|---|---|---|
| Initial page load (`/`) | `/basic-dashboard` | `/floorplan` | `/dashboard` |
| Navigate to `/dashboard` | `/basic-dashboard` | `/floorplan` | stays |
| Restaurant switching | `/basic-dashboard` | `/floorplan` | `/dashboard` |
| Sidebar "Dashboard" link | `/basic-dashboard` | `/basic-dashboard` | `/dashboard` |
| Sidebar "Floor Plan" link | hidden | `/floorplan` | `/floorplan` |

**Key:** Users with the `floor_plan` addon can still access `/basic-dashboard` via the sidebar "Dashboard" link. The homepage redirect only affects where they land by default.

---

## 6. Floor Plan Live View in Sidebar Navigation (Web App)

**File:** `components/layout/nav-config.ts`

Added a new "Floor Plan" navigation item pointing to `/floorplan` (the live operational view) with:
- Icon: `Map` (from lucide-react)
- Permission: `tables.view`
- Tier feature: `floor_plan`

This is separate from "Floor Plans" (`/floorplans`) which links to the floor plan editor. Both are gated behind the `floor_plan` feature/addon.

---

## 7. Mobile App Booking Flow Fixes (RBS Mobile App)

**File:** `hooks/useBookingCreate.ts`

**Gap identified:** The alternate booking creation flow (`useBookingCreate`) was missing `p_preferred_section` and `p_booking_policy` parameters in its RPC call to `create_booking_with_tables`. This meant:
- Bookings through this path didn't trigger auto-assign in the web app
- Section preference wasn't recorded

**Fix applied:**
- Added `preferredSection` param parsing from route params
- Added `p_booking_policy` and `p_preferred_section` to the RPC call (instant booking path)
- Added `preferred_section` to the direct `.insert()` call (request booking path)
- Added `preferred_section` to the deposit booking `.insert()` call

**Primary flow (`useBookingConfirmation` via `availability.tsx`) was already correct** — it sends both `p_booking_policy` and `p_preferred_section`.

---

## 8. Colleague's Bookings Panel Redesign Reconciliation (Web App)

**File:** `components/floorplan/bookings-panel.tsx`

Colleague redesigned the bookings panel with:
- 3-column grid layout (accent bar + content + right action area)
- Expand/collapse booking cards
- New props: `onUnassignBooking`, `onGoToFloorplan`, `onVisualizeBooking`, `allPendingRequests`
- Conditional tabs: Seated/Upcoming/Requests (today) vs Upcoming/Unassigned/Requests (future dates)
- Internal late arrival detection per card

**Reconciliation fixes applied:**
1. **`lateArrivals` undefined** — Variable was referenced in the Late Arrivals Alert JSX but wasn't defined after the restructure. Added computation back.
2. **`isLate` prop shadowed** — Colleague's internal `const isLate` shadowed a now-unused prop. Removed the prop from the interface.
3. **`onMarkNoShow` dead code** — Old prop reference removed (colleague renamed to `onNoShow`).

---

## 9. TypeScript Fixes from Colleague's Changes (Web App)

**File:** `app/(dashboard)/floorplan/page.tsx`

- Fixed `invalidateQueries` syntax (3 occurrences): Changed from React Query v4 `invalidateQueries(['key'])` to v5 `invalidateQueries({ queryKey: ['key'] })`.
- Fixed `.table` property access (2 occurrences): Added `as any` casts for nested junction table access.
- Removed debug `console.debug` in JSX that caused `void` return type error.

**File:** `app/(dashboard)/dashboard/page.tsx`
- Fixed union type access: Changed `result.booking` to `'booking' in result ? result.booking : null` for proper type narrowing.

---

## Database State (Verified via Supabase REST API)

| Table/Column | Status |
|---|---|
| `restaurant_sections.max_covers` | EXISTS (nullable, currently null for existing sections) |
| `table_booking_rules` table | EXISTS (with `id`, `table_id`, `restaurant_id`, `name`, `booking_type`, `priority`, `conditions`, `is_active`, `created_at`, `updated_at`) |
| `restaurant_tables.default_booking_type` | EXISTS (values: `"request"`, `"instant"`) |
| `booking_tables` junction table | EXISTS (columns: `booking_id`, `table_id`, `seats_occupied`) |
| `restaurants.addons` | EXISTS (array column, currently empty for most restaurants) |

---

## Build Status

- **Web app (`rbs-restaurant`):** `npm run build` passes cleanly
- **Mobile app (`RBS`):** `npx tsc --noEmit` has no errors in modified files (pre-existing test fixture issues in `__tests__/` are unrelated)

---

## Architecture Notes

### Booking Creation Paths (Mobile App)

| Path | Used By | RPC/Insert | Sends `preferred_section` | Sends `booking_policy` |
|---|---|---|---|---|
| `useBookingConfirmation` | `availability.tsx` (primary) | `create_booking_with_tables` RPC | Yes | Yes |
| `useBookingCreate` (instant) | `create.tsx` (alternate) | `create_booking_with_tables` RPC | Yes (after fix) | Yes (after fix) |
| `useBookingCreate` (request) | `create.tsx` (alternate) | Direct `.insert()` on `bookings` | Yes (after fix) | N/A (status set directly) |
| Deposit booking | `availability.tsx` | Direct `.insert()` on `bookings` | Yes | N/A (status set directly) |

### Server-Side Enforcement

The mobile app does NOT know about `table_booking_rules`, `max_covers`, or `section_capacity`. All capacity and rule enforcement happens server-side via:
- `create_booking_with_tables` RPC function (handles table assignment, conflict checking)
- `BookingRequestService.autoAssignTable()` (web app, for auto-assigning after creation)
- `quick_availability_check` and `get_available_tables` RPCs (for availability queries)

### Tier & Addon System

The `floor_plan` feature is gated by the addon system:
- **Pro tier:** All features enabled by default
- **Basic tier:** `floor_plan` disabled by default, enabled when `'floor_plan'` is in the restaurant's `addons` array
- The `hasFeature()` utility in `lib/utils/tier.ts` checks both tier features and addons
