# Service Fee Implementation Documentation

## Overview
This document details the implementation of service fee percentage charges on deposit payments, no-show penalties, and cancellation fees across the restaurant booking system.

---

## Table of Contents
1. [Database Changes](#database-changes)
2. [Deposit Payments](#deposit-payments)
3. [No-Show & Cancellation Charges](#no-show--cancellation-charges)
4. [UI Components](#ui-components)
5. [Testing Guide](#testing-guide)

---     

## Database Changes

### 1. Restaurants Table
**Migration**: `20260114000000_add_restaurant_service_fee.sql`

Added column to `restaurants` table:
```sql
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS service_fee_percentage numeric DEFAULT 0 
CHECK (service_fee_percentage >= 0 AND service_fee_percentage <= 100);
```

**Purpose**: Store the service fee percentage (0-100%) that each restaurant charges on top of deposits and penalties.

### 2. RPC Function Update
**Migration**: `update_get_booking_guarantee_details_with_service_fee`

Updated `get_booking_guarantee_details()` function to:
- Fetch `service_fee_percentage` from restaurants table
- Calculate base fee separately
- Calculate service fee amount: `base_fee * (service_fee_percentage / 100)`
- Return total penalty amount: `base_fee + service_fee_amount`

**New Fields Returned**:
- `base_fee` - Original fee amount
- `service_fee_percentage` - Restaurant's service fee %
- `service_fee_amount` - Calculated service fee
- `potential_penalty_amount` - Total (base + service fee)

---

## Deposit Payments

### Files Modified

#### 1. Admin Panel - Restaurant Settings
**File**: `app/admin/restaurants/[id]/page.tsx`

**Changes**:
- Added `service_fee_percentage` to form state
- Added input field with percentage indicator
- Saves value to database on restaurant update

**UI**: Number input (0-100) with "%" symbol and help text "Added to deposit payments"

#### 2. Manual Booking Form
**File**: `components/basic/basic-manual-booking-form.tsx`

**Changes**:
- Added query to fetch restaurant's `service_fee_percentage`
- Calculate service fee when deposit amount is entered:
  ```typescript
  const serviceFeeAmount = depositAmount * (serviceFeePercentage / 100)
  const totalWithServiceFee = depositAmount + serviceFeeAmount
  ```
- Display breakdown card showing:
  - Deposit: $XX.XX
  - Service Fee (X%): $X.XX
  - **Total Charge: $XX.XX** (in green)

#### 3. Payment Link Generation
**File**: `components/basic/manual-booking-dialog.tsx`

**Changes**:
- Fetch restaurant's `service_fee_percentage` on dialog open
- Calculate total amount including service fee
- Update `checkoutPayload` sent to MontyPay:
  ```typescript
  {
    amount: String(totalAmount.toFixed(2)), // Total with service fee
    deposit_amount: String(depositAmount.toFixed(2)),
    service_fee_amount: String(serviceFeeAmount.toFixed(2)),
    service_fee_percentage: serviceFeePercentage,
    description: "Deposit $50.00 + Service Fee $2.50 (5%) for booking ABC123"
  }
  ```
- Store `payment_amount` in booking as total (deposit + service fee)

#### 4. Payment Link Dialog
**File**: `components/basic/payment-link-dialog.tsx`

**Changes**:
- Added service fee fields to interface
- Display breakdown when service fee > 0:
  ```
  Deposit Payment Required: $52.50
  
  ┌─────────────────────────┐
  │ Deposit:        $50.00  │
  │ Service Fee(5%): $2.50  │
  │ ─────────────────────── │
  │ Total Charge:   $52.50  │
  └─────────────────────────┘
  ```

---

## No-Show & Cancellation Charges

### Files Modified

#### 1. Charge Penalty Edge Function
**File**: `supabase/functions/charge-penalty/index.ts`

**Changes Made**:

1. **Fetch Service Fee Percentage** (after line 166):
```typescript
// Fetch restaurant's service fee percentage
const { data: restaurant } = await supabase
  .from("restaurants")
  .select("service_fee_percentage")
  .eq("id", booking.restaurant_id)
  .single();

const serviceFeePercentage = restaurant?.service_fee_percentage || 0;
```

2. **Calculate Charges with Service Fee**:
```typescript
// Calculate Base Fee Amount
const baseFee = body.reason === "no_show"
  ? (guarantee.fee_type === "per_cover"
    ? guarantee.no_show_fee * booking.party_size
    : guarantee.no_show_fee)
  : (guarantee.fee_type === "per_cover"
    ? guarantee.cancellation_fee * booking.party_size
    : guarantee.cancellation_fee);

// Calculate Service Fee
const serviceFeeAmount = serviceFeePercentage > 0 
  ? baseFee * (serviceFeePercentage / 100) 
  : 0;

// Total charge amount (base fee + service fee)
const chargeAmount = baseFee + serviceFeeAmount;
```

3. **Updated Notification Message**:
```typescript
let message: string;
if (serviceFeeAmount > 0) {
  message = `Your card was charged ${amountStr} USD for your reservation at ${restaurant.name} due to ${reason}. (Fee: $${baseFee.toFixed(2)} + Service Fee: $${serviceFeeAmount.toFixed(2)})`;
} else {
  message = `Your card was charged ${amountStr} USD for your reservation at ${restaurant.name} due to ${reason}.`;
}
```

4. **Enhanced Transaction Logging**:
```typescript
montypay_response: {
  ...result,
  fee_breakdown: {
    base_fee: baseFee,
    service_fee_percentage: serviceFeePercentage,
    service_fee_amount: serviceFeeAmount,
    total_amount: chargeAmount,
  },
}
```

5. **Updated Response**:
```typescript
return json(200, {
  success: true,
  charged: true,
  payment_id: result.payment_id,
  amount: chargeAmount,
  base_fee: baseFee,
  service_fee_percentage: serviceFeePercentage,
  service_fee_amount: serviceFeeAmount,
  order_id: orderNumber,
});
```

**Status**: ✅ Deployed to production

#### 2. Penalty Dialog Component
**File**: `components/bookings/penalty-dialog.tsx`

**Changes**:
- Display service fee breakdown in penalty details card
- Show base fee, service fee percentage, and service fee amount
- Update charge button text to indicate service fee inclusion

**UI Enhancement**:
```
┌─────────────────────────────────────┐
│ Potential Penalty: $26.25           │
│                                     │
│ Base Fee:              $25.00       │
│ Service Fee (5%):       $1.25       │
│ ─────────────────────────────────── │
│ Reason: Customer No-Show            │
└─────────────────────────────────────┘

○ Charge Penalty
  Charge the customer's card USD 26.25
  (incl. 5% service fee)

○ Waive Penalty
  Release the hold without charging
```

---

## Complete Flow Examples

### Example 1: Deposit Payment with Service Fee

**Scenario**: Restaurant has 5% service fee, manual booking requires $50 deposit

**Flow**:
1. Admin sets service fee to 5% in restaurant settings
2. Staff creates manual booking with $50 deposit requirement
3. Form shows:
   - Deposit: $50.00
   - Service Fee (5%): $2.50
   - Total Charge: **$52.50**
4. Payment link generated for $52.50
5. Customer pays $52.50 via MontyPay
6. Booking `payment_amount` stored as 52.50

### Example 2: No-Show Penalty with Service Fee

**Scenario**: Restaurant has 3% service fee, customer no-shows on $25 no-show fee booking

**Flow**:
1. Customer no-shows on booking with card guarantee
2. Staff opens "Mark as No Show" dialog
3. Dialog shows:
   - Potential Penalty: $25.75
   - Base Fee: $25.00
   - Service Fee (3%): $0.75
4. Staff clicks "Charge $25.75"
5. Edge function `charge-penalty`:
   - Fetches service fee: 3%
   - Calculates: $25.00 + $0.75 = $25.75
   - Charges customer $25.75
6. Customer receives notification:
   > "Your card was charged $25.75 USD for your reservation at Restaurant ABC due to no-show. (Fee: $25.00 + Service Fee: $0.75)"
7. Transaction logged with breakdown in `penalty_transactions.montypay_response`

### Example 3: Per-Cover Fee with Service Fee

**Scenario**: Restaurant has 2% service fee, $10/cover no-show fee, party of 4 no-shows

**Flow**:
1. Base fee: $10 × 4 guests = $40.00
2. Service fee: $40.00 × 2% = $0.80
3. Total charge: **$40.80**
4. Dialog shows breakdown
5. Customer charged $40.80

---

## Key Features

### Security
✅ Service fee calculated **server-side** in edge function (not client-provided)  
✅ All calculations use restaurant's database value  
✅ RLS policies prevent unauthorized changes  
✅ Amount validation in checkout process

### Transparency
✅ Service fee **always visible** to staff before charging  
✅ Breakdown shown in UI (Deposit form, Payment dialog, Penalty dialog)  
✅ Customer notifications include breakdown  
✅ Transaction logs store complete breakdown

### Flexibility
✅ Per-restaurant configuration (0-100%)  
✅ Works with both fixed and per-cover fees  
✅ Applies to deposits AND penalties  
✅ Service fee = 0 means no additional charges

---

## Testing Guide

### 1. Test Deposit Payments

**Steps**:
1. Go to Admin → Restaurants → Select restaurant → Edit
2. Set service fee percentage to 5%
3. Save settings
4. Go to Basic Dashboard → Create Manual Booking
5. Select "Deposit" payment type
6. Enter deposit amount: $100
7. **Verify**: Breakdown shows $100 + $5 (5%) = $105 total
8. Complete booking
9. **Verify**: Payment link shows $105 total with breakdown
10. **Verify**: Booking payment_amount = 105

### 2. Test No-Show Charges

**Steps**:
1. Ensure restaurant has service fee configured (e.g., 3%)
2. Create booking with card guarantee ($30 no-show fee)
3. Mark booking as "No Show"
4. **Verify**: Dialog shows:
   - Potential Penalty: $30.90
   - Base Fee: $30.00
   - Service Fee (3%): $0.90
5. Click "Charge"
6. **Verify**: Customer charged $30.90
7. **Verify**: Notification includes breakdown
8. **Verify**: Transaction log has fee_breakdown

### 3. Test Zero Service Fee

**Steps**:
1. Set restaurant service fee to 0%
2. Create deposit booking with $50 deposit
3. **Verify**: No service fee breakdown shown
4. **Verify**: Total = $50 (no additional charges)
5. Test no-show penalty
6. **Verify**: Only base fee charged, no service fee

---

## Database Queries for Verification

### Check Restaurant Service Fee
```sql
SELECT id, name, service_fee_percentage 
FROM restaurants 
WHERE id = 'restaurant-uuid';
```

### Check Booking Payment Amount
```sql
SELECT id, confirmation_code, payment_amount, payment_status
FROM bookings 
WHERE id = 'booking-uuid';
```

### Check Penalty Transaction with Breakdown
```sql
SELECT 
  id, 
  amount, 
  montypay_response->'fee_breakdown' as breakdown
FROM penalty_transactions 
WHERE booking_id = 'booking-uuid';
```

### Get All Restaurants with Service Fees
```sql
SELECT name, service_fee_percentage 
FROM restaurants 
WHERE service_fee_percentage > 0
ORDER BY service_fee_percentage DESC;
```

---

## Technical Notes

### Precision
- All amounts stored with 2 decimal precision
- Service fee calculated as: `base * (percentage / 100)`
- Final amounts use `.toFixed(2)` for consistency

### Edge Cases Handled
- Service fee = 0 → No breakdown shown
- Service fee = null → Treated as 0
- Per-cover fees → Service fee applied to total (base × party_size)
- Failed charges → Service fee breakdown included in logs

### Performance
- Service fee fetched once per booking creation
- Cached in component state during form interaction
- Single database query per penalty charge

---

## Future Enhancements

### Potential Additions
1. **Itemized Receipts**: Generate PDF receipts with service fee breakdown
2. **Reporting**: Service fee revenue tracking in analytics
3. **Variable Rates**: Different service fees for deposits vs penalties
4. **Tax Handling**: Separate tax calculation from service fees
5. **Refund Logic**: Proportional refunds including service fees

---

## Support & Troubleshooting

### Common Issues

**Issue**: Service fee not showing in manual booking form  
**Solution**: Verify restaurant has `service_fee_percentage` set in database

**Issue**: Wrong amount charged  
**Solution**: Check edge function logs, verify calculation server-side

**Issue**: Customer notification missing breakdown  
**Solution**: Verify edge function deployment, check notification message format

### Debug Queries
```sql
-- Check if service fee column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name = 'service_fee_percentage';

-- Test RPC function
SELECT * FROM get_booking_guarantee_details('booking-uuid');
```

---

## Version History

**Version 1.0** (January 15, 2026)
- Initial implementation
- Deposits: Service fee on manual booking deposits
- Penalties: Service fee on no-show and cancellation charges
- UI: Breakdown displays in all relevant components
- Edge Function: Updated charge-penalty to calculate service fees
- Database: Added service_fee_percentage column and updated RPC function

---

## Contact

For questions or issues regarding service fee implementation:
- Check logs: `supabase functions logs charge-penalty`
- Review transactions: `penalty_transactions` table
- Database schema: `/db/schema.sql`
- Edge functions: `/supabase/functions/charge-penalty/`
