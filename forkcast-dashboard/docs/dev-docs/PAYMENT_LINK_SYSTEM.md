# Payment Link System - How It Works

## Overview

The system generates payment links that redirect customers to payment provider checkout pages. There are two payment providers and two types of payment links:

### Payment Providers
1. **MontyPay** - Credit/Debit card payments (Visa, Mastercard, Amex)
2. **Whish Money** - Mobile wallet payments (popular in Lebanon)

### Payment Types
1. **Deposit Links** - Customer pays an actual amount (e.g., $50 deposit)
2. **Card Guarantee Links** - Customer verifies their card with a $1 charge that gets voided immediately (MontyPay only)

---

## The Flow

### Step 1: Create Booking with Payment Requirement

When staff creates a manual booking that requires payment:
- Booking is created with `status: 'pending_payment'`
- This status **hides the booking from the restaurant** until payment completes
- A `payment_expires_at` timestamp is set (10 minutes from creation)

### Step 2: Generate Payment Links

For **deposit payments**, the system generates **BOTH** MontyPay and Whish links in parallel:

**MontyPay Deposit:**
- `is_event_payment: true`
- `amount: "52.50"` (deposit + MontyPay service fee)
- `description: "Deposit $50 + Service Fee $2.50 (5%)"`

**Whish Deposit:**
- `source: "manual"`
- `amount: "50.50"` (deposit + Whish service fee)  
- `deposit_amount: "50.00"`
- `service_fee_amount: "0.50"`
- `service_fee_percentage: 1`

**For Card Guarantees (MontyPay only):**
- `is_widget_guarantee: true`
- `no_show_fee: 25`
- `cancellation_fee: 15`
- `fee_type: "per_cover"`
- `party_size: 4`

### Step 3: Edge Function Creates Payment Sessions

**MontyPay (`montypay-checkout`):**

1. **Generates a unique order number** based on payment type:
   - `MANUAL-DEPOSIT-{bookingId}-{timestamp}` for deposits
   - `MANUAL-GUARANTEE-{bookingId}-{timestamp}` for guarantees
   - `WIDGET-GUARANTEE-{bookingId}-{timestamp}` for widget bookings
   - `TOKEN-{userId}-{timestamp}` for app user card additions

2. **Computes a security hash**:
   ```
   SHA1(MD5(UPPER(orderNumber + amount + currency + description + PASSWORD)))
   ```

3. **Calls MontyPay API** to create a hosted checkout session with:
   - Order details (number, amount, currency, description)
   - Success/cancel redirect URLs
   - Callback webhook URL
   - `req_token: true` and `recurring_init: true` (for guarantees only)
   - `custom_data` containing booking_id, fee amounts, etc.

4. **Returns the redirect URL** to the app

### Step 4: Customer Completes Payment

Customer is redirected to MontyPay's hosted checkout page where they:
- Enter card details (on MontyPay's PCI-compliant page - card data never touches our servers)
- Complete 3DS verification if required
- Get redirected to success/failure page

### Step 5: MontyPay Sends Webhook Callbacks

MontyPay sends POST requests to `montypay-callback` edge function.

**For 3DS transactions, TWO callbacks are sent:**

| Callback | Type | Contains | Action |
|----------|------|----------|--------|
| First | `3ds` | `card_token` (64-char) | Creates initial records |
| Second | `sale` | `recurring_token` (UUID) | Updates with real token, triggers void |

**CRITICAL:** `card_token` and `recurring_token` are DIFFERENT. The `recurring_token` is required to charge the card later.

### Step 6: Callback Handler Processes Payment

Based on the order number prefix, the callback handler:

**For Deposits (`MANUAL-DEPOSIT-*`, `EVENT-*`):**
- Updates booking: `status → 'confirmed'`, `payment_status → 'paid'`
- Booking becomes visible to restaurant

**For Guarantees (`MANUAL-GUARANTEE-*`, `WIDGET-GUARANTEE-*`):**
- Creates `payment_methods` record with card tokens
- Creates `booking_guarantees` record with fee snapshot
- Updates booking: `status → 'pending'`, `payment_status → 'pending'`
- **Voids the $1.00 verification charge**
- Booking becomes visible to restaurant with "Card Held" badge

### Step 7: Customer Redirected Back

Customer sees success page, which may deep-link back to the app.

---

## Charging a Penalty Later

When marking a booking as no-show or late cancellation:

1. Staff selects "Charge Penalty" in the app
2. App calls `charge-penalty` edge function with:
   - `booking_guarantee_id`
   - `reason: "no_show"` or `"late_cancellation"`

3. Edge function:
   - Fetches the stored `recurring_token` and `recurring_init_trans_id`
   - Calculates fee: `base_fee + (base_fee × service_fee_percentage)`
   - Computes recurring hash:
     ```
     SHA1(MD5(UPPER(recurring_init_trans_id + recurring_token + orderNumber + amount + description + PASSWORD)))
     ```
   - Calls MontyPay's recurring payment API
   - Updates `booking_guarantees.status → 'charged'`
   - Logs transaction in `penalty_transactions`
   - Sends push notification to customer

---

## Database Tables Involved

| Table | Purpose |
|-------|---------|
| `bookings` | Main booking record with `status`, `payment_status`, `payment_amount` |
| `payment_methods` | Stores card tokens (`card_token`, `recurring_token`, `recurring_init_trans_id`) |
| `booking_guarantees` | Links booking to payment method, stores fee snapshot, tracks charge status |
| `penalty_transactions` | Audit log of all penalty charges/waivers |
| `payment_transactions` | Audit log of all MontyPay callbacks |
| `whish_transactions` | Audit log of all Whish payment callbacks |
| `restaurants` | Contains `service_fee_percentage` (MontyPay) and `whish_service_fee_percentage` (Whish) |
| `card_guarantee_settings` | Per-restaurant guarantee configuration |

---

## Order Number Prefixes

| Prefix | Type | Amount Charged | Tokenization | Provider |
|--------|------|----------------|--------------|----------|
| `TOKEN-*` | App user adding card | $1.00 (voided) | Yes | MontyPay |
| `EVENT-*` | Widget event deposit | Full amount | No | MontyPay |
| `WIDGET-GUARANTEE-*` | Widget card guarantee | $1.00 (voided) | Yes | MontyPay |
| `MANUAL-DEPOSIT-*` | Manual booking deposit | Full amount | No | MontyPay |
| `MANUAL-GUARANTEE-*` | Manual booking guarantee | $1.00 (voided) | Yes | MontyPay |
| `PENALTY-*` | Penalty charge | Fee amount | No | MontyPay |
| `WHISH-DEPOSIT-*` | Whish deposit | Full amount | No | Whish |

---

## Service Fee Calculation

Each restaurant has **two separate service fee percentages**:
- `service_fee_percentage` (0-100%) - Applied to MontyPay payments
- `whish_service_fee_percentage` (0-100%, default 1%) - Applied to Whish payments

```
Service Fee = Base Amount × (service_fee_percentage / 100)
Total = Base Amount + Service Fee
```

**Example with different fees:**
- $50 deposit with 5% MontyPay fee = $50 + $2.50 = **$52.50** (MontyPay)
- $50 deposit with 1% Whish fee = $50 + $0.50 = **$50.50** (Whish)

The service fee is applied to:
- Deposit payments (both providers)
- No-show penalties (MontyPay only - charged via recurring token)
- Cancellation penalties (MontyPay only)

---

## Key Points for Implementation

1. **Payment links are URLs** - Open them in a WebView or external browser
2. **Booking starts hidden** - `pending_payment` status hides it until payment completes
3. **10-minute expiry** - Links expire, booking should be cleaned up if not paid
4. **Two tokens exist** - `card_token` (display) vs `recurring_token` (charging) - need the recurring one
5. **Callbacks update everything** - No polling needed, webhooks trigger all updates
6. **$1 gets voided** - For guarantees, the verification charge is automatically reversed
7. **Service fees are server-side** - Always calculated in edge functions, not client-provided
8. **Both links for deposits** - Staff receives BOTH MontyPay and Whish links to share with customer
9. **WhatsApp integration** - Both payment links are sent together via WhatsApp template

---

## Edge Functions

| Function | Purpose | Provider |
|----------|---------|----------|
| `montypay-checkout` | Creates MontyPay payment session | MontyPay |
| `montypay-callback` | Webhook handler for MontyPay | MontyPay |
| `whish-checkout` | Creates Whish payment session | Whish |
| `whish-callback` | Webhook handler for Whish | Whish |
| `charge-penalty` | Charges stored card for no-show/cancellation | MontyPay |
| `montypay-redirect` | Success/failure pages that deep-link back to app | Both |
| `send-payment-link-whatsapp` | Sends both payment links via WhatsApp | Both |

---

## Booking Status Flow

```
pending_payment  ──────────────────────────────────────────────────────────┐
      │                                                                    │
      │ (payment completed)                                    (expired)   │
      ▼                                                                    ▼
   pending  ───or───  confirmed                                      cancelled
   (guarantee)        (deposit paid)                              (payment failed)
      │                    │
      │ (restaurant confirms)
      ▼                    ▼
              confirmed
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
  arrived      no_show     cancelled
     │            │
     ▼            ▼
 completed    (penalty charged/waived)
(guarantee 
 released)
```
