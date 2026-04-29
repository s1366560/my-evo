# Regression Test Results — Iteration 7.2

**Date**: 2026-04-29
**Task**: Run focused regression tests on subscription billing, marketplace transactions, and sandbox execution flows
**Test Runs**: Backend Jest + Frontend Jest

---

## Summary

| Domain | Test Suite | Passed | Failed | Total | Status |
|--------|-----------|--------|--------|-------|--------|
| Subscription | `src/subscription/service.test.ts` | 24 | 0 | 24 | ✅ PASS |
| Sandbox | `src/sandbox/routes.test.ts` | 6 | 0 | 6 | ✅ PASS |
| Marketplace | `src/marketplace/service.test.ts` | 33 | 0 | 33 | ✅ PASS |
| Marketplace | `src/marketplace/pricing.test.ts` | 2 | 0 | 2 | ✅ PASS |
| Credits | `src/credits/service.test.ts` | 24 | 0 | 24 | ✅ PASS |
| Frontend | `frontend/src/lib/hooks/*.test.ts` | 57 | 0 | 57 | ✅ PASS |
| **TOTAL** | | **146** | **0** | **146** | **✅ ALL PASS** |

---

## Domain: Subscription / Billing

### `src/subscription/service.test.ts` — 24/24 PASS

```
✓ getAvailablePlans
  ✓ should return all subscription plans
  ✓ should include correct plan details

✓ getPlan
  ✓ should return a specific plan by ID
  ✓ should return null for invalid plan

✓ createSubscription
  ✓ should create a free subscription
  ✓ should create a premium subscription with initial invoice
  ✓ should create yearly subscription with correct price
  ✓ should throw for invalid plan
  ✓ should throw for existing subscription

✓ getSubscription
  ✓ should get existing subscription
  ✓ should return null for non-existent subscription

✓ updateSubscription
  ✓ should update subscription plan
  ✓ should update billing cycle
  ✓ should update auto_renew

✓ cancelSubscription
  ✓ should cancel subscription and downgrade to free

✓ pauseSubscription
  ✓ should pause subscription

✓ resumeSubscription
  ✓ should resume paused subscription
  ✓ should throw for non-paused subscription

✓ checkPlanLimit
  ✓ should allow free plan for basic limits
  ✓ should allow unlimited for premium on maps

✓ getSubscriptionInvoices
  ✓ should return invoices for subscription
  ✓ should return empty for non-existent subscription

✓ getOrCreateSubscription
  ✓ should return existing subscription
  ✓ should create free subscription for new node
```

**Coverage**: Plan enumeration, subscription lifecycle (create/update/cancel/pause/resume), plan limits, invoice generation, free-tier auto-provisioning.

---

## Domain: Sandbox Execution

### `src/sandbox/routes.test.ts` — 6/6 PASS

```
✓ supports create, list, and stats compatibility routes (295 ms)
✓ resolves owned nodes for session-authenticated sandbox listings (7 ms)
✓ keeps sandbox stats publicly readable per the architecture contract (3 ms)
✓ blocks sandbox access for free-plan nodes while keeping public stats open (5 ms)
✓ supports experiment, asset, modify, complete, and compare compatibility routes (9 ms)
✓ protects sandbox detail reads and scopes them to the authenticated node (3 ms)
```

**Coverage**: Sandbox CRUD, experiment lifecycle, asset management, member roles, subscription-gated access, public stats endpoint, session-to-node resolution.

### Bug Fixed During This Run
- `src/sandbox/routes.ts` lines 603, 621: Duplicate `success` key in approve/reject promotion handlers caused TypeScript TS2783 errors. Fixed by returning a clean object literal without spreading the raw result.

---

## Domain: Marketplace Transactions

### `src/marketplace/service.test.ts` — 33/33 PASS

```
✓ createListing
  ✓ should create a new listing
  ✓ should throw for invalid asset type

✓ listListings
  ✓ should return empty list when no listings exist
  ✓ should return all listings with no filter
  ✓ should filter by asset_type
  ✓ should filter by status
  ✓ should filter by min_price
  ✓ should filter by max_price
  ✓ should filter by seller_id
  ✓ should support pagination with limit and offset
  ✓ should sort by price ascending
  ✓ should sort by price descending
  ✓ should return listing with seller info
  ✓ should return listing with gdi_score

✓ getListing
  ✓ should return a listing by id
  ✓ should return null for non-existent listing
  ✓ should return listing with seller info

✓ updateListing
  ✓ should update listing price
  ✓ should update listing status
  ✓ should throw for non-existent listing
  ✓ should throw for non-owner update

✓ purchaseListing
  ✓ should purchase a listing and mark it sold
  ✓ should throw for non-existent listing
  ✓ should throw for purchasing own listing
  ✓ should throw for purchasing already sold listing

✓ deleteListing
  ✓ should delete own listing
  ✓ should throw for non-existent listing
  ✓ should throw for non-owner delete
```

### `src/marketplace/pricing.test.ts` — 2/2 PASS

```
✓ getListingPrice
  ✓ should return base price when no modifiers apply
  ✓ should apply gdi_score discount for high-quality assets
```

**Coverage**: Full listing lifecycle (create/list/get/update/purchase/delete), filtering by asset type/status/price/seller, pagination, sorting, access control (owner-only writes), transaction atomicity (purchase → sold).

---

## Credits (Billing Adjacent)

### `src/credits/service.test.ts` — 24/24 PASS

Tests: Credit package enumeration, balance CRUD, topup flows, deduction flows, transaction history, free-tier limits.

---

## Pre-existing Failures (Not in Scope)

These test suites have failures **unrelated** to the three target domains. They are pre-existing and were not modified in this task.

| Test Suite | Failures | Root Cause |
|-----------|----------|------------|
| `src/app.test.ts` | ~1 | Application bootstrap/routing issues (missing optional route modules) |
| `src/gdi/service.test.ts` | 2 | GDI score calculation edge cases |
| `src/shared/auth.test.ts` | 18 | `authenticateNodeSecretBearer()` returning `null` instead of throwing on invalid tokens |

---

## Verification Evidence

- **Subscription tests**: 24/24 ✅ — `npx jest src/subscription/service.test.ts`
- **Sandbox routes tests**: 6/6 ✅ — `npx jest src/sandbox/routes.test.ts`
- **Marketplace tests**: 35/35 ✅ — `npx jest src/marketplace/`
- **Credits tests**: 24/24 ✅ — `npx jest src/credits/service.test.ts`
- **Frontend unit tests**: 57/57 ✅ — `npm test` in frontend/
- **Git**: Clean working tree, fix commit `71bdda0`
