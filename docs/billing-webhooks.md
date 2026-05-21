# Billing Infrastructure Documentation

**Module**: `src/billing/`
**Status**: Implemented
**Updated**: 2026-04-30

## Overview

The billing infrastructure provides subscription billing webhooks, invoice generation, and proration calculation logic for the EvoMap Hub platform. It integrates with Stripe for payment processing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Billing Module                           │
├─────────────────────────────────────────────────────────────┤
│  routes.ts          │  HTTP endpoints (webhook, invoices)   │
│  service.ts         │  Business logic (webhooks, proration)│
│  types.ts           │  TypeScript interfaces               │
│  service.test.ts    │  Unit tests (25 tests)               │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌────────────┐     ┌────────────┐     ┌────────────┐
   │   Stripe   │     │ Subscription│     │  Invoice   │
   │  Webhooks  │     │   Service  │     │  Generator │
   └────────────┘     └────────────┘     └────────────┘
```

## Stripe Webhook Handlers

### Supported Event Types

| Event Type | Handler | Description |
|------------|---------|-------------|
| `customer.subscription.created` | `handleSubscriptionCreated` | New subscription activated |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Subscription modified |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Subscription cancelled |
| `invoice.paid` | `handleInvoicePaid` | Payment successful |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Payment failed |
| `invoice.finalized` | `handleInvoiceFinalized` | Invoice ready |
| `checkout.session.completed` | `handleCheckoutCompleted` | Checkout done |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` | Trial ending soon |

### Webhook Processing Flow

```typescript
1. Receive webhook payload from Stripe
2. Verify signature (if webhook secret configured)
3. Check idempotency (skip duplicate events)
4. Route to appropriate handler based on event type
5. Execute handler logic
6. Record webhook event for audit trail
7. Return processing result
```

### Signature Verification

```typescript
// Located in: src/billing/service.ts
verifyStripeSignature(payload: string, signature: string, secret?: string): boolean
```

**Verification Steps**:
1. Parse signature header (`t=<timestamp>,v1=<signature>`)
2. Check timestamp age (reject if older than 5 minutes)
3. Compute HMAC-SHA256 of `${timestamp}.${payload}`
4. Compare using timing-safe comparison

### Idempotency

Events are tracked in `processedEvents` Set to prevent duplicate processing:

```typescript
if (processedEvents.has(eventId)) {
  return { success: true, processed: false, actions_taken: ['duplicate_event_skipped'] };
}
```

## Invoice Generation

### Invoice Structure

```typescript
interface Invoice {
  id: string;
  subscription_id: string;
  node_id: string;
  stripe_invoice_id?: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  amount: number;          // Total including tax
  amount_paid: number;
  amount_due: number;
  amount_remaining: number;
  currency: string;
  status: InvoiceStatus;    // 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  period_start: Date;
  period_end: Date;
  line_items: InvoiceLineItem[];
}
```

### Line Item Types

| Type | Description |
|------|-------------|
| `subscription` | Base subscription charge |
| `proration` | Pro-rated adjustment for plan changes |
| `one_time` | One-time charges |
| `tax` | Tax calculations |
| `discount` | Discounts/coupons |

### Generate Invoice Function

```typescript
generateInvoice(
  subscriptionId: string,
  nodeId: string,
  plan: PlanTier,
  billingCycle: BillingCycle,
  periodStart: Date,
  periodEnd: Date,
  options?: {
    stripeInvoiceId?: string;
    includeProration?: boolean;
    prorationAmount?: number;
    taxRate?: number;
  }
): Invoice
```

### Example Invoice Flow

```typescript
// 1. Generate initial invoice
const invoice = generateInvoice(
  'sub_123',
  'node_abc',
  'premium',
  'monthly',
  new Date('2024-01-01'),
  new Date('2024-02-01')
);

// 2. Mark as paid
const paidInvoice = updateInvoiceStatus(invoice.id, 'paid', new Date());

// 3. Retrieve for display
const formattedAmount = formatCurrency(invoice.amount); // "$29.00"
```

## Proration Calculation

### Overview

Proration calculates the fair cost when a user changes plans mid-cycle:

- **Credit**: Unused portion of the old plan (given to user)
- **Charge**: Cost for the new plan's remaining period
- **Net**: `charge - credit` (positive = user owes, negative = user gets credit)

### Simple Proration (Immediate)

```typescript
calculateImmediateProration(
  fromPlan: PlanTier,
  toPlan: PlanTier,
  billingCycle: BillingCycle,
  changeDate: Date,
  periodStart: Date,
  periodEnd: Date
): {
  credit: number;      // Credit amount in cents
  charge: number;     // Charge amount in cents
  net: number;        // Net amount (positive = owe, negative = credit)
  daysUsed: number;   // Days used on old plan
  daysRemaining: number;
  description: string;
}
```

### Detailed Proration (Subscription-Aware)

```typescript
calculateProration(
  subscriptionId: string,
  nodeId: string,
  fromPlan: PlanTier,
  toPlan: PlanTier,
  billingCycle: BillingCycle,
  effectiveDate: Date,
  currentPeriodEnd: Date
): ProrationPreview
```

### Proration Calculation Logic

```typescript
// Calculate daily rates
const daysInPeriod = billingCycle === 'monthly' ? 30 : 365;
const fromDailyRate = fromPrice / daysInPeriod;
const toDailyRate = toPrice / daysInPeriod;

// Calculate time remaining
const daysRemaining = Math.max(1, daysInPeriod - daysUsed);

// Credit for unused old plan
const credit = Math.round(fromDailyRate * daysRemaining);

// Charge for new plan
const charge = Math.round(toDailyRate * daysRemaining);

// Net amount
const net = charge - credit;
```

### Example Scenarios

**Upgrade (Premium → Ultra mid-cycle)**:
```
Plan: premium → ultra, Monthly
Days remaining: 15
Premium daily rate: $29/30 = $0.97
Ultra daily rate: $99/30 = $3.30

Credit: 15 * $0.97 = $14.50
Charge: 15 * $3.30 = $49.50
Net: $49.50 - $14.50 = $35.00 (user owes)
```

**Downgrade (Ultra → Premium mid-cycle)**:
```
Plan: ultra → premium, Monthly
Days remaining: 15
Ultra daily rate: $99/30 = $3.30
Premium daily rate: $29/30 = $0.97

Credit: 15 * $3.30 = $49.50
Charge: 15 * $0.97 = $14.50
Net: $14.50 - $49.50 = -$35.00 (user gets $35 credit)
```

**Same Plan (No Change)**:
```
Plan: premium → premium
Returns { credit: 0, charge: 0, net: 0 }
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/billing/webhook` | Stripe webhook endpoint |
| GET | `/billing/invoices/:invoiceId` | Get invoice by ID |
| GET | `/billing/invoices/node/:nodeId` | Get all invoices for node |
| GET | `/billing/subscriptions/:subscriptionId/invoices` | Get subscription invoices |
| POST | `/billing/invoices` | Generate new invoice |
| PATCH | `/billing/invoices/:invoiceId/status` | Update invoice status |
| GET | `/billing/proration` | Quick proration preview |
| POST | `/billing/proration/detailed` | Detailed proration calculation |
| GET | `/billing/webhooks` | List webhook events |
| GET | `/billing/webhooks/:eventId` | Get webhook event details |
| GET | `/billing/plans` | Get available plans |
| POST | `/billing/checkout` | Create checkout session |
| GET | `/billing/subscription/status` | Get subscription status |

## Configuration

```typescript
interface BillingConfig {
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_price_pro?: string;
  stripe_price_team?: string;
  stripe_price_enterprise?: string;
  default_currency: string;
  tax_rate: number;
  enable_proration: boolean;
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification secret |
| `STRIPE_PRICE_PRO` | Premium plan price ID |
| `STRIPE_PRICE_TEAM` | Ultra plan price ID |

## Error Handling

### Webhook Errors

```typescript
interface WebhookProcessingResult {
  success: boolean;
  event_id: string;
  event_type: StripeEventType;
  processed: boolean;
  actions_taken: string[];
  error?: string;
}
```

All webhook processing errors are logged and recorded for audit purposes.

### Signature Verification Failures

Invalid signatures return HTTP 400:

```json
{
  "success": false,
  "error": "INVALID_SIGNATURE"
}
```

## Testing

### Test Coverage

| Test Suite | Tests | Status |
|------------|-------|--------|
| Stripe Signature Verification | 3 | ✅ Passing |
| Invoice Generation | 4 | ✅ Passing |
| Invoice Retrieval | 3 | ✅ Passing |
| Proration Calculation | 5 | ✅ Passing |
| Currency Formatting | 1 | ✅ Passing |
| Webhook Event Processing | 5 | ✅ Passing |
| Integration Scenarios | 3 | ✅ Passing |
| **Total** | **25** | **✅ All Passing** |

### Run Tests

```bash
# Run billing service tests
npx vitest run src/billing/service.test.ts

# Run all billing-related tests
npx vitest run src/billing/ src/subscription/ src/webhook/
```

## Related Modules

| Module | Path | Purpose |
|--------|------|---------|
| Subscription | `src/subscription/` | Subscription management |
| Webhook | `src/webhook/` | Generic webhook subscriptions |
| Credits | `src/credits/` | Credits economy |

## Changelog

- **2026-04-30**: Fixed same-plan proration handling, improved test coverage
- **2026-04-29**: Initial implementation with Stripe webhook handlers, invoice generation, and proration calculation
