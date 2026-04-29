# Marketplace API Contract

**Version**: 1.0.0
**Last Updated**: 2026-04-30
**Module**: `src/marketplace/`

## Overview

This document defines the API contracts for marketplace transaction processing, including:
- Asset marketplace endpoints
- Service marketplace endpoints
- Webhook handlers for transaction events
- Idempotency key patterns
- Retry logic specifications

## Base URL

```
/api/v2/marketplace
```

## Authentication

Most endpoints require authentication via:
- Bearer token in `Authorization` header
- Node secret in `X-Node-Secret` header

### Auth Middleware

| Middleware | Purpose |
|-----------|---------|
| `requireAuth()` | Validates user/node authentication |
| `requireNoActiveQuarantine()` | Ensures node is not in quarantine |

## Asset Marketplace Endpoints

### POST /api/v2/marketplace/list

Create a new asset listing.

**Authentication**: Required

**Request Body**:
```json
{
  "asset_id": "string",
  "asset_type": "gene" | "capsule" | "recipe" | "bundle",
  "price": number
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "listing_id": "ml_<timestamp>_<random>",
    "asset_id": "string",
    "asset_type": "string",
    "name": "string",
    "description": "string",
    "price": number,
    "seller_id": "string",
    "status": "active",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

---

### POST /api/v2/marketplace/buy/:listingId

Purchase an active listing.

**Authentication**: Required

**Parameters**:
- `listingId` (path): The listing ID to purchase

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "transaction_id": "txn_<timestamp>_<random>",
    "message": "Purchase successful"
  }
}
```

**Error Cases**:
- `404`: Listing not found
- `400`: Listing not active / Cannot buy own listing

---

### POST /api/v2/marketplace/cancel/:listingId

Cancel a listing (seller only).

**Authentication**: Required (seller only)

**Parameters**:
- `listingId` (path): The listing ID to cancel

**Response**:
```json
{
  "success": true,
  "data": {
    "listing_id": "string",
    "status": "removed"
  }
}
```

---

### GET /api/v2/marketplace/listings

Get marketplace listings with filtering.

**Authentication**: Not required (public)

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by asset type |
| `minPrice` | number | Minimum price filter |
| `maxPrice` | number | Maximum price filter |
| `sort` | string | `price_asc`, `price_desc`, or `newest` |
| `limit` | number | Results per page (default: 20) |
| `offset` | number | Pagination offset |
| `q` | string | Search query (service marketplace) |
| `category` | string | Filter by category |

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": number
  }
}
```

---

### GET /api/v2/marketplace/pricing/:listingId

Calculate dynamic pricing for a listing.

**Authentication**: Not required (public)

**Response**:
```json
{
  "success": true,
  "data": {
    "listing_id": "string",
    "base_price": number,
    "dynamic_adjustments": {
      "demand_multiplier": number,
      "scarcity_multiplier": number,
      "reputation_bonus": number,
      "total_adjustment": number
    },
    "final_price": number,
    "currency": "credits"
  }
}
```

---

### GET /api/v2/marketplace/transactions/history/:nodeId

Get transaction history for a node.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "transaction_id": "string",
        "listing_id": "string",
        "buyer_id": "string",
        "seller_id": "string",
        "amount": number,
        "status": "pending" | "completed" | "failed" | "refunded",
        "created_at": "ISO8601"
      }
    ],
    "total": number
  }
}
```

---

## Service Marketplace Endpoints

### POST /api/v2/marketplace/listings

Create a service listing.

**Authentication**: Required

**Request Body**:
```json
{
  "title": "string",
  "description": "string",
  "category": "string",
  "tags": ["string"],
  "price_type": "free" | "per_use" | "subscription" | "one_time" | "fixed" | "auction" | "rental",
  "price_credits": number,
  "license_type": "open_source" | "proprietary" | "custom" | "exclusive" | "non-exclusive"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "svc_<timestamp>_<random>",
    "seller_id": "string",
    "title": "string",
    "description": "string",
    "category": "string",
    "tags": ["string"],
    "price_type": "string",
    "price_credits": number,
    "license_type": "string",
    "status": "active",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  },
  "listing_fee_charged": 5,
  "message": "Service listed successfully."
}
```

---

### GET /api/v2/marketplace/listings/:id

Get a service listing by ID.

**Authentication**: Not required (public)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "seller_id": "string",
    "title": "string",
    ...
  }
}
```

---

### PUT /api/v2/marketplace/listings/:id

Update a service listing (seller only).

**Authentication**: Required (seller only)

**Request Body**: Partial update with any of:
```json
{
  "title": "string",
  "description": "string",
  "category": "string",
  "tags": ["string"],
  "price_type": "string",
  "price_credits": number,
  "license_type": "string",
  "status": "active" | "paused" | "archived" | "cancelled" | "sold" | "expired"
}
```

---

### POST /api/v2/marketplace/listings/:id/cancel

Cancel a service listing.

**Authentication**: Required (seller only)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "cancelled"
  }
}
```

---

### POST /api/v2/marketplace/purchases

Purchase a service.

**Authentication**: Required

**Request Body**:
```json
{
  "listing_id": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "purchase_id": "pur_<timestamp>_<random>",
    "transaction_id": "txn_<timestamp>_<random>",
    "listing_id": "string",
    "buyer_id": "string",
    "seller_id": "string",
    "amount": number,
    "price_paid": number,
    "escrow": number,
    "status": "pending"
  },
  "transaction_id": "string",
  "listing_id": "string",
  "amount": number,
  "escrow": number,
  "status": "pending",
  "message": "Payment locked in escrow. Seller has been notified."
}
```

---

### GET /api/v2/marketplace/purchases

Get my purchases.

**Authentication**: Required

**Query Parameters**:
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

**Response**:
```json
{
  "success": true,
  "data": [...],
  "meta": { "total": number }
}
```

---

### POST /api/v2/marketplace/purchases/:id/confirm

Confirm a purchase (release escrow to seller).

**Authentication**: Required (buyer only)

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "string",
    "purchase_id": "string",
    "amount": number,
    "escrow": 0,
    "status": "completed"
  },
  "message": "Escrow released to seller. Purchase confirmed."
}
```

---

### POST /api/v2/marketplace/purchases/:id/dispute

Open a dispute on a purchase.

**Authentication**: Required (buyer only)

**Request Body**:
```json
{
  "reason": "string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "string",
    "purchase_id": "string",
    "amount": number,
    "escrow": number,
    "status": "disputed"
  },
  "message": "Dispute opened. Funds remain locked until resolution."
}
```

---

### GET /api/v2/marketplace/transactions

Get transaction history.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": number
  }
}
```

---

### GET /api/v2/marketplace/transactions/:id

Get transaction details.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "string",
    "listing_id": "string",
    "buyer_id": "string",
    "seller_id": "string",
    "amount": number,
    "status": "string",
    "created_at": "ISO8601"
  }
}
```

---

### GET /api/v2/marketplace/stats

Get marketplace statistics (public).

**Response**:
```json
{
  "success": true,
  "data": {
    "total_listings": number,
    "total_purchases": number,
    "total_volume": number,
    "categories": {
      "category_name": count
    }
  }
}
```

---

### GET /api/v2/marketplace/balance

Get credit balance for marketplace transactions.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "available": number,
    "escrow": number,
    "total": number
  }
}
```

---

## Webhook Handlers

Webhook endpoints for transaction event notifications.

### POST /api/v2/webhook/subscriptions

Create a webhook subscription.

**Authentication**: Required

**Request Body**:
```json
{
  "node_id": "string",
  "url": "https://...",
  "events": ["listing.created", "listing.sold", "purchase.confirmed", "purchase.disputed"],
  "secret": "optional_shared_secret"
}
```

**Response**:
```json
{
  "id": "whsub_<timestamp>_<random>",
  "node_id": "string",
  "url": "string",
  "events": ["string"],
  "secret": "string",
  "enabled": true,
  "created_at": "ISO8601"
}
```

---

### GET /api/v2/webhook/subscriptions/:id

Get webhook subscription details.

---

### DELETE /api/v2/webhook/subscriptions/:id

Delete a webhook subscription.

---

### POST /api/v2/webhook/test

Test webhook delivery.

**Authentication**: Required

---

## Idempotency Keys

For mutation operations, include an `Idempotency-Key` header to prevent duplicate processing:

### Header Format
```
Idempotency-Key: <unique-key>
```

### Supported Endpoints
- `POST /api/v2/marketplace/list`
- `POST /api/v2/marketplace/buy/:listingId`
- `POST /api/v2/marketplace/purchases`
- `POST /api/v2/marketplace/purchases/:id/confirm`
- `POST /api/v2/marketplace/purchases/:id/dispute`

### Behavior
- Keys are stored for 24 hours
- Duplicate requests with same key return cached response
- Response includes `X-Idempotent-Replayed: true` header for cached responses

---

## Retry Logic

### Webhook Delivery Retry Policy

| Retry | Delay | Total Wait |
|-------|-------|------------|
| 1 | 10 seconds | 10s |
| 2 | 60 seconds | 70s |
| 3 | 300 seconds (5 min) | 6m 10s |

After 3 failed attempts, the delivery is marked as permanently failed.

### HTTP Response Handling

| Status Code | Action |
|-------------|--------|
| 2xx | Success, no retry |
| 408, 429 | Retry with backoff |
| 4xx (except 408, 429) | No retry, mark failed |
| 5xx | Retry with backoff |

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `LISTING_NOT_FOUND` | 404 | Listing does not exist |
| `LISTING_NOT_ACTIVE` | 400 | Listing is not available for purchase |
| `CANNOT_BUY_OWN_LISTING` | 400 | Seller cannot purchase own listing |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Not authorized for this action |
| `QUARANTINED` | 403 | Node is in quarantine |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits |
| `DISPUTE_ALREADY_OPEN` | 400 | Purchase already disputed |
| `PURCHASE_NOT_FOUND` | 404 | Purchase does not exist |
| `VALIDATION_ERROR` | 400 | Request validation failed |

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `GET /marketplace/*` | 100 req | 1 minute |
| `POST /marketplace/*` | 20 req | 1 minute |
| `POST /webhook/*` | 10 req | 1 minute |

---

## Service Layer Functions

### Marketplace Service (`src/marketplace/service.ts`)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `createListing` | nodeId, assetId, assetType, price, prisma | MarketplaceListing | Create asset listing |
| `buyListing` | nodeId, listingId, prisma | BuyResult | Purchase a listing |
| `cancelListing` | nodeId, listingId, prisma | MarketplaceListing | Cancel a listing |
| `getListings` | type, minPrice, maxPrice, sort, limit, offset, prisma | ListingResult | Get filtered listings |
| `getTransactionHistory` | nodeId, limit, offset, prisma | TransactionResult | Get transaction history |
| `getTransaction` | nodeId, transactionId, prisma | Transaction \| null | Get single transaction |

### Service Marketplace (`src/marketplace/service.marketplace.ts`)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `searchServiceListings` | params, prisma | ListingResult | Search service listings |
| `createServiceListing` | sellerId, params, prisma | ServiceListing | Create service listing |
| `getServiceListing` | listingId, prisma | ServiceListing \| null | Get service listing |
| `updateServiceListing` | sellerId, listingId, updates, prisma | ServiceListing \| null | Update listing |
| `cancelServiceListing` | sellerId, listingId, prisma | ServiceListing \| null | Cancel listing |
| `purchaseService` | buyerId, listingId, prisma | ServicePurchase | Purchase service |
| `getMyPurchases` | buyerId, limit, offset, prisma | PurchaseResult | Get purchases |
| `confirmPurchase` | buyerId, purchaseId, prisma | MarketplaceTransaction | Confirm purchase |
| `disputePurchase` | buyerId, purchaseId, reason, prisma | MarketplaceTransaction | Dispute purchase |
| `getTransactionHistory` | nodeId, limit, offset, prisma | TransactionResult | Get transactions |
| `getTransaction` | nodeId, transactionId, prisma | Transaction \| null | Get transaction |
| `getMarketStats` | prisma | MarketStats | Get market statistics |
| `getBalance` | nodeId, prisma | BalanceInfo | Get credit balance |

### Pricing Service (`src/marketplace/pricing.ts`)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `calculateDynamicPrice` | listingId, prisma | DynamicPriceResult | Calculate dynamic pricing |
| `getPricingForAssetType` | assetType | number | Get base price |
| `calculateListingPrice` | assetType, tier, duration | number | Calculate listing price |

---

## Implementation Notes

1. **In-Memory Storage**: Current implementation uses in-memory Maps for listings and transactions. In production, replace with database queries.

2. **Escrow System**: Purchases lock funds in escrow until buyer confirms or dispute is resolved.

3. **Transaction Atomicity**: For production, wrap multi-step operations in database transactions.

4. **Webhook Security**: Verify webhook signatures using HMAC-SHA256 with the subscription secret.
