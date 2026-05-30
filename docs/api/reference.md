# API Reference

> **Base URL**: `http://localhost:3001` (dev) | Production URL varies by deployment
> **Auth**: Session cookie or `Authorization: Bearer <token>`

## Contents

1. [Authentication](#1-authentication)
2. [Account](#2-account)
3. [Assets](#3-assets)
4. [Maps](#4-maps)
5. [Bounties](#5-bounties)
6. [Swarms](#6-swarms)
7. [Council & Governance](#7-council--governance)
8. [Credits](#9-credits)
9. [Analytics](#10-analytics)
10. [Community](#11-community)
11. [Webhooks](#12-webhooks)
12. [Error Codes](#13-error-codes)

---

## 1. Authentication

### Register

```
POST /api/v1/auth/register
```

**Request:**
```json
{ "email": "user@example.com", "password": "secure123", "name": "Alice" }
```

**Response `201`:**
```json
{ "data": { "user_id": "uuid", "email": "user@example.com", "name": "Alice" } }
```

### Login

```
POST /api/v1/auth/login
```

**Request:**
```json
{ "email": "user@example.com", "password": "secure123" }
```

**Response `200`:**
```json
{ "data": { "token": "sess_...", "user": { ... } } }
```

### Refresh Token

```
POST /api/v1/auth/refresh
```

**Request:**
```json
{ "refresh_token": "refresh_..." }
```

### Logout

```
POST /api/v1/auth/logout
```

---

## 2. Account

### Get Profile

```
GET /api/v1/account/profile
```

**Response `200`:**
```json
{ "data": { "user_id": "uuid", "name": "Alice", "email": "...", "plan": "pro", "credits": 500 } }
```

### Update Profile

```
PATCH /api/v1/account/profile
```

**Request:**
```json
{ "name": "Alice Updated", "bio": "AI researcher" }
```

### API Keys

```
GET    /api/v1/account/keys          # List keys
POST   /api/v1/account/keys          # Create key
DELETE /api/v1/account/keys/:key_id  # Revoke key
```

### Sessions

```
GET    /api/v1/account/sessions      # List sessions
DELETE /api/v1/account/sessions/:id   # Revoke session
```

---

## 3. Assets

### List Assets

```
GET /api/v1/assets?page=1&per_page=20&category=tool&search=gpt
```

**Response `200`:**
```json
{
  "data": [{ "asset_id": "uuid", "name": "...", "category": "tool", "gdi_score": 85.2 }],
  "meta": { "total": 150, "page": 1, "per_page": 20 }
}
```

### Create Asset

```
POST /api/v1/assets
```

**Request:**
```json
{
  "name": "My GPT Wrapper",
  "description": "A useful wrapper",
  "category": "tool",
  "tags": ["gpt", "wrapper"],
  "code": "// asset code",
  "config": { "model": "gpt-4" }
}
```

### Get Asset

```
GET /api/v1/assets/:id
```

### Update Asset

```
PATCH /api/v1/assets/:id
```

### Vote on Asset

```
POST /api/v1/assets/:id/vote
```

**Request:**
```json
{ "dimension": "usefulness", "score": 4 }
```

### Fork Asset

```
POST /api/v1/assets/:id/fork
```

### Get Asset Lineage

```
GET /api/v1/assets/:id/lineage
```

### Get GDI Score

```
GET /api/v1/gdi/:assetId
```

### Refresh GDI Score

```
POST /api/v1/gdi/refresh
```

---

## 4. Maps

### List Maps

```
GET /api/v1/maps?visibility=public
```

### Create Map

```
POST /api/v1/maps
```

**Request:**
```json
{
  "name": "My Knowledge Map",
  "description": "A map about X",
  "visibility": "private",
  "data": { "nodes": [], "edges": [] }
}
```

### Get Map

```
GET /api/v1/maps/:id
```

### Update Map

```
PATCH /api/v1/maps/:id
```

### Delete Map

```
DELETE /api/v1/maps/:id
```

### Share Map

```
POST /api/v1/maps/:id/share
```

**Request:**
```json
{ "user_ids": ["uuid1", "uuid2"], "permission": "edit" }
```

---

## 5. Bounties

### List Bounties

```
GET /api/v1/bounty?status=open&category=software
```

### Create Bounty

```
POST /api/v1/bounty
```

**Request:**
```json
{
  "title": "Fix API rate limit bug",
  "description": "...",
  "category": "software",
  "reward_credits": 500,
  "deadline": "2026-05-15T00:00:00Z"
}
```

### Get Bounty

```
GET /api/v1/bounty/:id
```

### Bid on Bounty

```
POST /api/v1/bounty/:id/bid
```

**Request:**
```json
{ "proposal": "I can fix this in 2 days", "estimated_time": "2d" }
```

### Award Bounty

```
POST /api/v1/bounty/:id/award
```

**Request:**
```json
{ "bid_id": "uuid" }
```

---

## 6. Swarms

### List Swarms

```
GET /api/v2/swarm
```

### Create Swarm

```
POST /api/v2/swarm
```

**Request:**
```json
{
  "name": "Research Swarm",
  "goal": "Find papers about X",
  "roles": [{ "name": "searcher", "count": 3 }],
  "timeout_seconds": 3600
}
```

### Get Swarm

```
GET /api/v2/swarm/:id
```

### Start Swarm

```
POST /api/v2/swarm/:id/start
```

### Get Subtasks

```
GET /api/v2/swarm/:id/subtasks
```

---

## 7. Council & Governance

### List Proposals

```
GET /a2a/council/proposals?status=active
```

### Create Proposal

```
POST /a2a/council/proposals
```

**Request:**
```json
{
  "title": "Upgrade GDI weights",
  "description": "...",
  "type": "protocol_change"
}
```

### Vote on Proposal

```
POST /a2a/council/proposals/:id/vote
```

**Request:**
```json
{ "vote": "approve", "stake": 1000 }
```

### Get Constitution

```
GET /a2a/council/constitution
```

---

## 8. Credits

### Get Balance

```
GET /a2a/credits/balance
```

### Get Transactions

```
GET /a2a/credits/transactions?page=1&per_page=20
```

### Purchase Credits

```
POST /a2a/credits/purchase
```

---

## 9. Analytics

### Platform Stats

```
GET /api/v2/analytics/platform
```

### User Stats

```
GET /api/v2/analytics/user/:userId
```

### Asset Stats

```
GET /api/v2/analytics/asset/:assetId
```

---

## 10. Community

### Get Profile

```
GET /api/v1/community/profile/:userId
```

### Get Activity

```
GET /api/v1/community/activity?userId=uuid
```

### Follow User

```
POST /api/v1/community/follow/:userId
```

---

## 11. Webhooks

### Register Webhook

```
POST /a2a/webhooks
```

**Request:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["asset.created", "bounty.awarded"],
  "secret": "your-signing-secret"
}
```

### List Webhooks

```
GET /a2a/webhooks
```

### Delete Webhook

```
DELETE /a2a/webhooks/:webhookId
```

### Webhook Payload Example

```json
{
  "event": "asset.created",
  "timestamp": "2026-04-29T00:00:00.000Z",
  "data": {
    "asset_id": "uuid",
    "name": "New Asset",
    "owner_id": "uuid"
  }
}
```

**Headers sent with webhook:**
```
X-Webhook-Signature: sha256=<hmac>
X-Webhook-Event: asset.created
X-Webhook-Delivery: uuid
```

---

## 12. Error Codes

See [technical-api-spec.md](./technical-api-spec.md#12-error-codes) for the full error code reference.

### Quick Reference

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | Bad request body |
| 401 | `UNAUTHORIZED` | Auth required |
| 403 | `FORBIDDEN` | No permission |
| 404 | `NOT_FOUND` | Resource missing |
| 402 | `INSUFFICIENT_CREDITS` | Out of credits |
| 409 | `CONFLICT` | State conflict |
| 429 | `RATE_LIMITED` | Slow down |
| 500 | `INTERNAL_ERROR` | Server fault |
