# Booking Alarm Mute / Snooze — Design

**Date:** 2026-04-21
**Status:** Design (pending approval)
**Owner:** @asif

## Problem

The booking alarm is tied 1:1 to the existence of any pending booking in the restaurant. When staff need a moment of silence — most commonly to make or take a phone call — they have no way to pause the looping audio without actually accepting or declining the booking. The tablet keeps ringing through the entire call.

## Goals

1. Let staff silence the alarm on demand.
2. Keep pending bookings visible and unambiguously flagged so staff can't forget them.
3. Prevent "I muted it and forgot" failure mode (which would cost the restaurant real bookings).
4. No new dependencies, no API routes, no database schema changes — client-side only, consistent with CLAUDE.md guardrails.

## Non-Goals

- Per-booking muting. Mute is a global switch on the alarm service.
- Cross-device mute sync. Each tablet/browser tab has its own in-memory state.
- Persistence across full page reload. Reloads are rare on the tablet dashboard; after reload, `BookingAlarmWatcher` re-syncs with the DB anyway.

## Behavior

### Mute durations

Four timed options plus an indefinite option:

- 1 minute
- 5 minutes
- 10 minutes
- 30 minutes
- **Indefinite** (no auto-resume — staff must tap Resume)

### While muted

- `<audio>` is paused; wake lock stays acquired (screen stays on so the muted state is visible).
- `BookingAlarmOverlay` stays mounted, swapped to a muted variant: shows current pending count, "Muted" label, live countdown (or "Indefinite" when no timer), and a prominent **Resume now** button.
- `isRinging` remains `true` (derived from `pendingBookingIds.size > 0`). Consumers like `PendingBookingsBanner` continue to render.
- New bookings arriving during mute are added to `pendingBookingIds`, the count updates, and listeners re-render — but **no audio plays**. This is the deliberate tradeoff: staff explicitly asked for silence, so silence they get. The visible count + muted overlay prevent the miss.

### Resume paths

1. Tap **Resume now** in the overlay → timer cancelled, audio resumes if any pendings remain.
2. Timer expires → auto-unmute → audio resumes if any pendings remain.
3. All pendings resolved while muted → mute auto-clears (nothing to ring for).
4. Full page reload → service is re-instantiated; mute state lost (acceptable).

## Technical Design

### `BookingAlarmService` additions

New private state:

```ts
private isMuted = false
private muteUntil: number | null = null       // null = indefinite
private muteTimeoutId: ReturnType<typeof setTimeout> | null = null
```

New methods:

```ts
mute(durationMs: number | null): void   // null = indefinite
unmute(): void
getMuteState(): { isMuted: boolean; muteUntil: number | null }
```

Modified behavior:

- `ensurePlaying()` — early-return when `isMuted`.
- `startAlarm(id)` — still adds to set, notifies listeners, acquires wake lock. Skips the `ensurePlaying()` call path when muted (covered by the early return).
- `stopAlarm(id)` — when the last booking is removed while muted, also clear the mute state (no point being muted with nothing to mute).
- `stopAll()` — also clears mute state.
- `notifyListeners()` — snapshot already rebuilt; listeners will read mute state via a new getter.

Internal helpers:

- `clearMuteTimer()` — clears `muteTimeoutId` if present, sets to null.
- `scheduleUnmute(durationMs)` — sets `muteTimeoutId` to fire `unmute()` after the duration.

### `useBookingAlarm` hook additions

Currently subscribes to `pendingBookingIds` changes. We extend the subscription to also surface mute state:

```ts
return {
  pendingIds,
  isRinging,                    // unchanged — pending count > 0
  pendingCount,
  newestPendingId,
  hasNewArrivals,
  newArrivalIds,
  // new:
  isMuted: boolean,
  muteUntil: number | null,
  mute: (durationMs: number | null) => void,
  unmute: () => void,
}
```

Because mute state flips without the pending set changing, the service must call `notifyListeners()` on mute/unmute. Listeners pull mute state fresh via `getMuteState()` in the `subscribe` callback; the hook mirrors that into React state.

To avoid sprawling the existing hook signature, the mute state and actions can be consumed either from `useBookingAlarm()` (extended) or from a dedicated `useBookingAlarmMute()` hook that shares the same subscribe. I'll go with extending `useBookingAlarm` since all current consumers are in the same file directory and the extra fields are cheap.

### `BookingAlarmOverlay` changes

Today it's a single pill that routes to the bookings page. We split the render into two states:

**Ringing state (existing, unchanged visually):**
- Click card → navigate to bookings
- Small `Bell` icon + count

Add a **Snooze** secondary action (small icon button, `BellOff` / `VolumeX` icon) inside the card — tapping it opens a popover with the duration chips.

**Muted state (new):**
- Card stays in place, but content swaps:
  - Icon: `BellOff`
  - Title: "X pending — muted"
  - Subtitle: countdown like "Resumes in 4:23" or "Muted — tap Resume"
  - Primary button: **Resume now**
  - Secondary tap area: still navigates to bookings

Countdown is a `useEffect` `setInterval(1000)` that re-renders while `muteUntil != null`. When `Date.now() >= muteUntil`, the service's own timer will have already fired — but we add a safety check in the component too (if the tab was throttled and the service timer drifted, the component can call `unmute()` itself).

### Popover UI

Use existing shadcn `Popover` + `Button` components (already in the project). Layout:

```
┌──────────────────────────────┐
│  Mute alarm for              │
│  [1 min] [5 min] [10 min]    │
│  [30 min] [Until I resume]   │
└──────────────────────────────┘
```

Touch targets ≥44px per CLAUDE.md tablet guidelines. `touchAction: 'manipulation'` on buttons.

### Stop-path updates

`bookingAlarmService.stopAlarm` and `stopAll` need to clear mute state when the pending set empties (handled in the service itself — no call-site changes).

## Files Affected

| File | Change |
|---|---|
| `lib/services/booking-alarm-service.ts` | Add mute state, `mute`/`unmute`/`getMuteState`, early-return in `ensurePlaying`, clear mute on empty set |
| `lib/hooks/use-booking-alarm.ts` | Return `isMuted`, `muteUntil`, `mute`, `unmute` |
| `components/booking-alarm/booking-alarm-overlay.tsx` | Add snooze popover + muted-state UI with countdown + Resume button |

No changes to: `BookingAlarmWatcher`, `NotificationContext`, `PendingBookingsBanner`, layout files, or any mutation/hook that calls `stopAlarm`.

## Edge Cases

1. **Snooze while another snooze is active:** new `mute()` call replaces the timer — same pattern as an extend.
2. **Mute, then all bookings resolve via another device:** realtime triggers `stopAlarm` for each ID; service detects empty set and clears mute; overlay disappears.
3. **Mute, then tab backgrounded for > timer duration:** browsers throttle `setTimeout` in background tabs. When tab becomes visible again, the existing `visibilitychange` handler re-acquires wake lock. We also check on visibility whether `muteUntil` has passed and force-unmute. Same safety check runs inside the countdown `useEffect` in the overlay.
4. **Audio unlock not yet granted when mute expires:** `ensurePlaying()` already handles the "autoplay blocked" case — it will retry on next user interaction, exactly the existing behavior.
5. **Service worker `PLAY_ALARM` arrives while muted:** it calls `startAlarm(id)` which adds to the set; `ensurePlaying()` no-ops because muted. Consistent with design.

## Testing Plan

Manual verification in browser (this is a UI/audio behavior — no good automated story):

1. Trigger a pending booking → alarm rings → overlay shows ringing state.
2. Click snooze → popover opens → pick 1 min → audio stops, overlay shows "Resumes in 0:59…" countdown.
3. Wait 60s → audio resumes automatically.
4. Repeat, tap **Resume now** mid-countdown → audio resumes immediately.
5. Pick "Until I resume" → overlay shows "Muted — tap Resume", no countdown, audio stays off until button pressed.
6. While muted, create another pending booking (seed or real) → count increments silently.
7. While muted, accept both bookings → overlay disappears, mute state clears.
8. Refresh page while muted → mute clears; if bookings still pending, alarm resumes on first user interaction.
9. Verify on `/basic-dashboard` (basic tier) and `/dashboard` (pro tier) — both layouts mount the overlay.
10. Verify touch targets work on tablet viewport (1024×768).

## Rollout

Single PR. No feature flag — the change is additive and the default state (`isMuted: false`) preserves current behavior exactly.

## Open Questions

None — durations confirmed (1/5/10/30 + indefinite).
