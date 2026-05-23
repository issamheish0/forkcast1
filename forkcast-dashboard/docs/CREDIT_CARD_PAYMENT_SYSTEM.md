# Credit Card Payment & Guarantee System

## Overview
   
The Plate app uses **MontyPay** as its payment gateway to implement a **credit card guarantee system** for restaurant bookings. This system allows restaurants to:
- Hold a card on file during booking
- Charge cancellation penalties for late cancellations or no-shows
- Protect against revenue loss from unreliable bookings

**Last Updated:** December 30, 2025
    
---     
      
## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CARD TOKENIZATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User taps "Add Payment Card"                                         │
│          │                                                               │
│          ▼                                                               │
│  2. montypay-checkout Edge Function                                      │
│     • Creates MontyPay hosted session                                    │
│     • Sets req_token: true, recurring_init: true                         │
│     • Creates "pending:TOKEN-xxx" payment_methods record                 │
│          │                                                               │
│          ▼                                                               │
│  3. User redirected to MontyPay hosted checkout                          │
│     • Enters card details on secure PCI-compliant page                   │
│     • MontyPay validates and processes $1.00 verification                │
│          │                                                               │
│          ▼                                                               │
│  4. MontyPay sends TWO callbacks (for 3DS transactions):                 │
│                                                                          │
│     ┌─────────────────────────────────────────────────────────────┐      │
│     │ CALLBACK #1: type=3ds, order_status=3ds                     │      │
│     │ • Contains: card_token (64-char hash)                       │      │
│     │ • Missing: recurring_token                                  │      │
│     │ → Saves payment method with card_token as fallback          │      │
│     └─────────────────────────────────────────────────────────────┘      │
│                       │                                                  │
│                       ▼                                                  │
│     ┌─────────────────────────────────────────────────────────────┐      │
│     │ CALLBACK #2: type=sale, order_status=settled                │      │
│     │ • Contains: recurring_token (UUID format)                   │      │
│     │ • Contains: recurring_init_trans_id                         │      │
│     │ → Updates payment method with REAL recurring_token          │      │
│     └─────────────────────────────────────────────────────────────┘      │
│          │                                                               │
│          ▼                                                               │
│  5. montypay-redirect Edge Function                                      │
│     • Deep links user back to app                                        │
│     • App refreshes payment methods list                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         PENALTY CHARGE FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Trigger: Late cancellation or No-show detected                       │
│          │                                                               │
│          ▼                                                               │
│  2. charge-penalty Edge Function                                         │
│     • Retrieves booking_guarantee + payment_method                       │
│     • Validates recurring_token + recurring_init_trans_id exist          │
│     • Calculates penalty amount                                          │
│          │                                                               │
│          ▼                                                               │
│  3. Compute Recurring Hash                                               │
│     SHA1(MD5(UPPER(                                                      │
│       recurring_init_trans_id +                                          │
│       recurring_token +                                                  │
│       order_number +                                                     │
│       amount +                                                           │
│       description +                                                      │
│       PASSWORD                                                           │
│     )))                                                                  │
│          │                                                               │
│          ▼                                                               │
│  4. POST to /api/v1/payment/recurring                                    │
│     {                                                                    │
│       "merchant_key": "xxx",                                             │
│       "recurring_init_trans_id": "uuid",                                 │
│       "recurring_token": "uuid",                                         │
│       "hash": "sha1hex",                                                 │
│       "order": { "number", "amount", "description" }                     │
│     }                                                                    │
│          │                                                               │
│          ▼                                                               │
│  5. MontyPay Response: { "status": "settled" }                           │
│          │                                                               │
│          ▼                                                               │
│  6. Update booking_guarantees.status = "charged"                         │
│     Record in penalty_transactions                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `payment_methods` Table

Stores tokenized card credentials for users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | References `profiles.id` |
| `card_token` | TEXT | 64-char token from MontyPay (for display/identification) |
| `recurring_token` | TEXT | **UUID token for recurring charges** (different from card_token!) |
| `recurring_init_trans_id` | TEXT | Initial transaction ID for recurring reference |
| `card_mask` | TEXT | Masked card number (e.g., `411111****1111`) |
| `card_brand` | TEXT | Card brand (visa, mastercard, etc.) |
| `expiry_month` | INT | Card expiry month (1-12) |
| `expiry_year` | INT | Card expiry year (4-digit) |
| `is_active` | BOOL | Whether the card is active |
| `is_default` | BOOL | Whether this is the default card |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `last_used_at` | TIMESTAMP | Last usage timestamp |

> **Important:** The `recurring_token` and `card_token` are DIFFERENT values. MontyPay sends them in separate callbacks.

### `booking_guarantees` Table

Links bookings to payment methods for guarantee tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `booking_id` | UUID | References `bookings.id` |
| `payment_method_id` | UUID | References `payment_methods.id` |
| `status` | TEXT | `held`, `released`, `charged`, `failed`, `waived` |
| `charge_reason` | TEXT | `late_cancellation`, `no_show` |
| `charged_amount` | DECIMAL | Amount charged (if any) |
| `charged_at` | TIMESTAMP | When charge occurred |
| `fee_type` | TEXT | `flat` or `per_cover` |
| `no_show_fee` | DECIMAL | No-show penalty amount |
| `cancellation_fee` | DECIMAL | Late cancellation penalty amount |
| `party_size` | INT | Party size for per-cover calculations |

### `penalty_transactions` Table

Audit log of all penalty charge attempts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `booking_guarantee_id` | UUID | References `booking_guarantees.id` |
| `booking_id` | UUID | References `bookings.id` |
| `restaurant_id` | UUID | References `restaurants.id` |
| `user_id` | UUID | User being charged |
| `transaction_type` | TEXT | `charge` or `waiver` |
| `amount` | DECIMAL | Charge amount |
| `currency` | TEXT | Currency code (USD) |
| `reason` | TEXT | `no_show` or `late_cancellation` |
| `initiated_by` | UUID | Staff who initiated |
| `montypay_status` | TEXT | MontyPay response status |
| `montypay_trans_id` | TEXT | MontyPay transaction ID |
| `montypay_response` | JSONB | Full MontyPay response |

---

## Edge Functions

### 1. `montypay-checkout`

**Purpose:** Creates a MontyPay hosted checkout session for card tokenization.

**Location:** `supabase/functions/montypay-checkout/index.ts`

**Endpoint:** `POST /functions/v1/montypay-checkout`

**Request Body:**
```json
{
  "booking_id": "uuid (optional)",
  "return_path": "string (optional)"
}
```

**Key Configuration:**
```typescript
{
  merchant_key: MERCHANT_KEY,
  operation: "purchase",          // Required for tokenization
  order: {
    number: "TOKEN-{userId.slice(0,8)}-{timestamp}",
    amount: "1.00",               // Minimum verification amount
    currency: "USD",
    description: "Card verification for Plate"
  },
  req_token: true,                // Request card_token
  recurring_init: true,           // Enable recurring charges
  success_url: "https://xxx/montypay-redirect?status=success",
  cancel_url: "https://xxx/montypay-redirect?status=cancelled",
  notification_url: "https://xxx/montypay-callback"
}
```

**Hash Formula (Session Creation):**
```
SHA1(MD5(UPPER(order.number + order.amount + order.currency + order.description + PASSWORD)))
```

**Response:**
```json
{
  "redirect_url": "https://checkout.montypay.com/...",
  "order_number": "TOKEN-abc12345-1234567890"
}
```

---

### 2. `montypay-callback`

**Purpose:** Webhook handler for MontyPay payment notifications.

**Location:** `supabase/functions/montypay-callback/index.ts`

**Endpoint:** `POST /functions/v1/montypay-callback`

**Supported Formats:**
- `application/x-www-form-urlencoded` (Checkout Integration - most common)
- `application/json`

**Callback Types Handled:**

| Callback | `type` | `order_status` | Contains | Action |
|----------|--------|----------------|----------|--------|
| 3DS Verification | `3ds` | `3ds` | `card_token` | Create payment method |
| Final Settlement | `sale` | `settled` | `recurring_token` | Update with real token |
| Recurring Charge | `recurring` | varies | varies | Ignored (handled by charge-penalty response) |
| Test Callbacks | varies | varies | `order_number: "123"` | Acknowledged, not processed |

**Dual Callback Handling (3DS Flow):**
```
1st Callback (3DS):
  - order_status: "3ds", type: "3ds"
  - card_token: "4f5271fa8f7195a1..." (64-char hash)
  - NO recurring_token
  → Creates payment_methods record, uses card_token as fallback recurring_token

2nd Callback (Settled):
  - order_status: "settled", type: "sale"  
  - recurring_token: "a26a188a-e582-11f0-89b0-..." (UUID format)
  - recurring_init_trans_id: "a25b3504-e582-11f0-..."
  → Finds existing record by recurring_init_trans_id, updates with REAL recurring_token
```

**Hash Validation (Callback Signature):**
```
SHA1(MD5(UPPER(id + order_number + order_amount + order_currency + order_description + PASSWORD)))
```

**Order Number Format:**
- `TOKEN-{userId.slice(0,8)}-{timestamp}` - Card tokenization (processed)
- Other formats (e.g., `123`, `order-1234`) - Test/external callbacks (acknowledged, not processed)

---

### 3. `montypay-redirect`

**Purpose:** Handles redirect from MontyPay back to app via deep links.

**Location:** `supabase/functions/montypay-redirect/index.ts`

**Endpoint:** `GET /functions/v1/montypay-redirect`

**Query Parameters:**
- `status`: `success` or `cancelled`
- `path`: Optional deep link path

**Response:** HTML page that triggers app deep link:
```html
<script>
  window.location.href = "plate://payment-methods?payment_status=success";
</script>
```

---

### 4. `charge-penalty`

**Purpose:** Charges penalty fees for late cancellations or no-shows.

**Location:** `supabase/functions/charge-penalty/index.ts`

**Endpoint:** `POST /functions/v1/charge-penalty`

**Request Body:**
```json
{
  "booking_guarantee_id": "uuid",
  "reason": "no_show" | "late_cancellation",
  "waive": false,
  "waiver_reason": "string (if waiving)",
  "initiated_by": "uuid (optional)"
}
```

**MontyPay Recurring API:**
```
POST https://checkout.montypay.com/api/v1/payment/recurring
Content-Type: application/json

{
  "merchant_key": "40a6d78e-d680-11f0-...",
  "recurring_init_trans_id": "1ac0cc56-e584-11f0-...",
  "recurring_token": "1acfd21e-e584-11f0-...",
  "hash": "56e2fa78ca3cd59626799d4560516d8ab91f1288",
  "order": {
    "number": "PENALTY-{confirmationCode}-{timestamp}",
    "amount": "20.00",
    "description": "Late cancellation penalty"
  },
  "customer": {
    "name": "Customer Name",
    "email": "customer@email.com"
  }
}
```

**Hash Formula (Recurring Charge):**
```
SHA1(MD5(UPPER(recurring_init_trans_id + recurring_token + order.number + order.amount + order.description + PASSWORD)))
```

**Important:** The MD5 output must be lowercase hex before passing to SHA1.

**Success Response from MontyPay:**
```json
{
  "status": "settled",
  "payment_id": "77a874a0-e584-11f0-...",
  "date": "2025-12-30 13:35:56",
  "order": {
    "number": "PENALTY-36DF18-1767101754687",
    "amount": "20.00",
    "currency": "USD"
  }
}
```

---

## MontyPay Integration Details

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `https://checkout.montypay.com/api/v1/session` | Create hosted checkout session |
| `https://checkout.montypay.com/api/v1/payment/recurring` | Process recurring charges |

### Token Types

| Token | Format | Purpose |
|-------|--------|---------|
| `card_token` | 64-char hex hash | Display/identification only |
| `recurring_token` | UUID | **Required for charges** |
| `recurring_init_trans_id` | UUID | Links to initial transaction |

> ⚠️ **Critical:** `card_token` and `recurring_token` are DIFFERENT. You MUST have the real `recurring_token` for penalty charges to work.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MONTYPAY_MERCHANT_KEY` | Merchant identifier (UUID format) |
| `MONTYPAY_PASSWORD` | Secret password for hash computation |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for DB operations |

### Test Cards

| Card Number | Behavior |
|-------------|----------|
| 4111111111111111 | Success |
| 4000000000000002 | Declined |
| 2223000000000007 | Mastercard Success |

---

## React Native Integration

### `usePaymentMethods` Hook

**Location:** `hooks/usePaymentMethods.ts`

```typescript
const {
  paymentMethods,           // PaymentMethod[]
  defaultPaymentMethod,     // PaymentMethod | null
  isLoading,
  isRefreshing,
  fetchPaymentMethods,      // () => Promise<void>
  openCheckout,             // (options?) => Promise<void>
  deletePaymentMethod,      // (id) => Promise<void>
  setDefaultPaymentMethod,  // (id) => Promise<void>
  expiringCards,            // Cards expiring within 2 months
} = usePaymentMethods();
```

**`openCheckout` Flow:**
1. Creates checkout session via `montypay-checkout`
2. Opens WebBrowser with MontyPay URL
3. User enters card details
4. MontyPay redirects back via `montypay-redirect`
5. Deep link triggers app with `?payment_status=success`
6. Hook refetches payment methods

### `CardGuaranteeSheet` Component

**Location:** `components/booking/CardGuaranteeSheet.tsx`

Displays during booking when restaurant requires card guarantee:
- Shows fee breakdown (no-show fee, cancellation fee)
- Lists user's saved payment methods
- Allows adding new card via `openCheckout`
- Returns selected `payment_method_id` for booking creation

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing recurring token` | `recurring_token` is null/undefined | Ensure both callbacks are processed |
| `Invalid hash signature` | Hash computation mismatch | Check PASSWORD env var, verify formula |
| `Could not identify user` | User ID prefix not found in profiles | Check order number format |
| `No card_token or recurring_token` | Callback missing both tokens | Shouldn't happen for valid transactions |

### Debugging Commands

```bash
# View callback logs
npx supabase functions logs montypay-callback --project-ref xsovqvbigdettnpeisjs

# View charge-penalty logs
npx supabase functions logs charge-penalty --project-ref xsovqvbigdettnpeisjs

# Deploy updated function
npx supabase functions deploy montypay-callback --project-ref xsovqvbigdettnpeisjs
```

---

## Security Considerations

1. **PCI Compliance:** Card details never touch our servers. All card data is handled by MontyPay's PCI-compliant hosted checkout.

2. **Hash Validation:** All callbacks are validated using cryptographic signatures with server-side secret.

3. **Service Role:** Edge Functions use `SERVICE_ROLE_KEY` for database operations.

4. **RLS Policies:** Users can only view/modify their own payment methods.

5. **Pending Record Cleanup:** Orphaned `pending:` records are cleaned up after timeout.

---

## Monitoring & Diagnostics

### Database Queries

```sql
-- Check payment methods with proper tokens
SELECT 
  id,
  user_id,
  LEFT(card_token, 20) || '...' as card_token,
  LEFT(recurring_token, 20) || '...' as recurring_token,
  recurring_init_trans_id,
  card_mask,
  is_active
FROM payment_methods
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 10;

-- Verify recurring_token differs from card_token
SELECT 
  id,
  card_token = recurring_token as tokens_match,
  card_token,
  recurring_token
FROM payment_methods
WHERE is_active = true
  AND recurring_token IS NOT NULL;

-- Recent guarantee activity
SELECT 
  bg.status,
  bg.charge_reason,
  bg.charged_amount,
  pm.card_mask,
  pm.recurring_token IS NOT NULL as has_recurring_token,
  bg.created_at
FROM booking_guarantees bg
JOIN payment_methods pm ON pm.id = bg.payment_method_id
ORDER BY bg.created_at DESC
LIMIT 20;

-- Failed charges
SELECT 
  pt.*,
  pm.card_mask,
  pm.recurring_token IS NOT NULL as has_token
FROM penalty_transactions pt
LEFT JOIN booking_guarantees bg ON bg.id = pt.booking_guarantee_id
LEFT JOIN payment_methods pm ON pm.id = bg.payment_method_id
WHERE pt.montypay_status != 'SETTLED'
ORDER BY pt.created_at DESC;
```

### Cleanup Stale Records

```sql
-- Clean up pending records older than 1 hour
DELETE FROM payment_methods
WHERE card_token LIKE 'pending:%'
  AND created_at < NOW() - INTERVAL '1 hour';
```

---

## Troubleshooting Guide

### Issue: Penalty charge fails with "Missing recurring token"

**Cause:** The second callback (with `recurring_token`) wasn't processed.

**Solution:**
1. Check callback logs for the order number
2. Manually update the payment method:
```sql
UPDATE payment_methods
SET recurring_token = 'actual-recurring-token-uuid'
WHERE recurring_init_trans_id = 'the-trans-id';
```

### Issue: Callback returns 400 error

**Check these in order:**
1. Order number format (must be `TOKEN-*` for processing)
2. Hash validation (matches expected formula)
3. User identification (can find user by ID prefix)
4. Token presence (either card_token or recurring_token)

### Issue: "Invalid hash signature" error

**Debug steps:**
1. Log the hash components (without password)
2. Verify all values are uppercase before hashing
3. Ensure MD5 output is lowercase hex
4. Check PASSWORD environment variable

---

## Version History

| Date | Changes |
|------|---------|
| 2025-12-30 | Fixed dual callback handling for 3DS transactions |
| 2025-12-30 | Fixed recurring_token update detection logic |
| 2025-12-30 | Changed non-TOKEN callbacks to return OK instead of error |
| 2025-12-30 | Added comprehensive debugging logs |
