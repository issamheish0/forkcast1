# ForkCast — Mobile App + Restaurant Dashboard (v1 rebuild)

Two clean, minimal apps connected to a single Supabase backend.

```
myISD/
├─ mobile/        Expo React Native app for diners (book a table)
└─ dashboard/     Next.js web app for restaurants (manage bookings)
```

Both apps already point to the new Supabase project
`https://jemloczmesahiiphtrki.supabase.co` (see each `.env.example`).

## What's in v1

**Mobile (`mobile/`)**
- Welcome / sign in / sign up (email + password)
- Home with featured + popular restaurants
- Search (live filter by name, cuisine, address)
- Favorites (heart toggle on restaurant page)
- Restaurant detail with **Book a table**
- Booking flow: party size → date → time → notes
  - Instant restaurants → status `confirmed`
  - Request restaurants → status `pending`

**Dashboard (`dashboard/`)**
- Landing page
- Sign in / sign up (also creates the restaurant on first signup)
- Overview (pending / confirmed / today counts)
- **Bookings** page with **realtime** updates, tabs, search, accept/decline/complete actions
- Settings — edit your restaurant profile and booking policy

## Database

A single migration (`init_v1_schema`) was applied via the Supabase MCP server. Tables:
`profiles`, `restaurants`, `restaurant_staff`, `bookings`, `favorites`.
RLS policies are enabled; the `bookings` table is published to `supabase_realtime`.
A trigger auto-creates a `profiles` row on every `auth.users` insert.

A second migration (`seed_demo_data`) seeds 6 demo restaurants for browsing.
These have no owner, so booking them won't show up in any dashboard — for a full
end-to-end test, create a restaurant via the dashboard signup (see below).

---

## Run it

### 1. Dashboard

```powershell
cd dashboard
copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

### 2. Mobile

```powershell
cd mobile
copy .env.example .env.local
npm install
npx expo start
```

Press `w` for web, scan the QR for iOS/Android Expo Go, or `a`/`i` for emulators.

### Disable email confirmation (for fast local testing)

In the Supabase dashboard → **Authentication → Sign In / Up** → turn off
"Confirm email". This lets sign-up flows immediately have a session.

---

## End-to-end test (mobile booking → dashboard receives it live)

1. **Dashboard** → http://localhost:3000 → **Sign up**.
   Fill in your name, a restaurant name (e.g. *Le Test Bistro*), email, password.
   You'll land on `/dashboard`. Go to **Settings** and set a `Main image URL` (paste
   any image link) and adjust `Booking policy` if you want auto-confirm.
2. **Mobile** → open the app → **Sign up** with a *different* email
   (this is a diner, not the restaurant owner).
3. On Home, scroll until you see *Le Test Bistro* (or search for it).
4. Tap it → **Book a table** → pick party size / date / time → confirm.
5. Switch back to the dashboard's **Bookings** page — the booking appears in
   real time with a toast. Click **Accept** (or **Decline**).
6. (Optional) Tap the heart on the restaurant page in mobile and verify it shows
   up in the **Favorites** tab.

---

## Project layout

```
mobile/
├─ app/
│  ├─ _layout.tsx              root layout + auth gate
│  ├─ index.tsx                redirect → /welcome
│  ├─ welcome.tsx              landing
│  ├─ sign-in.tsx
│  ├─ sign-up.tsx
│  └─ (protected)/
│     ├─ _layout.tsx
│     ├─ (tabs)/
│     │  ├─ _layout.tsx        tab bar
│     │  ├─ index.tsx          Home
│     │  ├─ search.tsx
│     │  ├─ favorites.tsx
│     │  └─ profile.tsx
│     ├─ restaurant/[id].tsx
│     └─ booking/
│        ├─ create.tsx
│        └─ success.tsx
├─ components/restaurant-card.tsx
├─ context/auth-provider.tsx
├─ lib/{supabase.ts, types.ts}
└─ tailwind.config.js, metro.config.js, babel.config.js

dashboard/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                 landing
│  ├─ sign-in/page.tsx
│  ├─ sign-up/page.tsx
│  └─ dashboard/
│     ├─ layout.tsx            sidebar + auth gate
│     ├─ page.tsx              overview
│     ├─ bookings/
│     │  ├─ page.tsx           server: fetch initial
│     │  └─ bookings-client.tsx  client: realtime + actions
│     └─ settings/
│        ├─ page.tsx
│        └─ settings-client.tsx
├─ components/sign-out-button.tsx
├─ lib/{utils.ts, types.ts, supabase/{client.ts, server.ts}}
├─ middleware.ts               auth + redirects
└─ next.config.js, postcss.config.js
```

---

## What's intentionally **not** in v1 (ready to add next)

- Google / Apple / phone OAuth (we used the existing email auth helpers as the
  base; the auth context exposes one place to add `signInWithOAuth`)
- Maps view in mobile search
- Restaurant menu, reviews, photos
- Loyalty / offers / events / waitlists
- Floor-plan, table assignments, deposits, payments
- Push notifications (OneSignal)

The mobile project's `package.json` is intentionally lean — when you want maps,
add `react-native-maps` + `expo-location` again.
