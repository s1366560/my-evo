# My Evo System Architecture

**Version**: v1.0 | **Updated**: 2026-05-08 | **Status**: Complete

## Overview

My Evo is an AI Self-Evolution Infrastructure platform based on GEP (Genome Evolution Protocol).

### Core Modules

| Module | Description |
|--------|-------------|
| A2A Protocol | Agent node registration, heartbeat, asset publishing |
| Marketplace | Gene/Capsule assets with GDI scoring |
| Bounty System | Task creation, claiming, submission, review |
| Map Visualization | Interactive node/edge graph |
| Authentication | JWT-based user auth |
| Memory System | Cross-session learning |

---

## Technology Stack

### Frontend (Next.js 14 + TypeScript)

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS + CSS Variables |
| Components | shadcn/ui (Radix) |
| State | Zustand |
| Ports | 3002 (dev) / 3000 (prod) |

### Backend (Express + Prisma + SQLite)

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Express 4.x (Note: SPEC.md says Fastify but impl uses Express) |
| ORM | Prisma 5.x |
| Database | SQLite (dev) |
| Validation | Zod |
| Auth | JWT |
| Port | 3001 |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │   Browser    │   │  Mobile App  │   │   CLI/SDK    │       │
│  │  (Next.js)   │   │   (React)    │   │              │       │
│  │  Port 3002   │   │              │   │              │       │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘       │
└─────────┼───────────────────┼───────────────────┼──────────────┘
          │                   │                   │
          └───────────────────┴───────────────────┘
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GATEWAY / PROXY LAYER                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          Next.js API Route Handlers                     │   │
│  │     (frontend/src/app/api/frontend/**)                  │   │
│  │            Proxies to Backend :3001                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICE                            │
│                     (Express.js :3001)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Route Layer                            │   │
│  │  /auth ─ /a2a ─ /bounty ─ /map ─ /marketplace          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Controller Layer                         │   │
│  │  authController, a2aController, assetController,          │   │
│  │  bountyController, mapController, memoryController,       │   │
│  │  statsController                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                          │   │
│  │  gdiScoringService (GDI scoring algorithm)              │   │
│  │  statsService (Marketplace statistics)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Middleware Layer                          │   │
│  │  auth (JWT), validation (Zod), errorLogger, healthCheck  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌───────────┐  ┌─────────────────┐
│   SQLite DB     │  │  Prisma   │  │  External APIs  │
│   (dev.db)      │  │   ORM     │  │   (OpenAI)      │
└─────────────────┘  └───────────┘  └─────────────────┘
```

---

## Component Hierarchy

### Backend Components

```
backend/src/
├── index.ts                    # Entry point
├── config/index.ts            # Environment config
├── db/prisma.ts               # Prisma client
├── auth/jwt.ts                # JWT utilities
├── middleware/
│   ├── auth.ts                # JWT + Node auth
│   ├── validation.ts          # Zod validation
│   ├── errorLogger.ts         # Error logging
│   └── healthCheck.ts         # Health endpoint
├── models/schemas.ts           # Zod schemas
├── controllers/
│   ├── authController.ts      # Auth handlers
│   ├── a2aController.ts       # A2A protocol
│   ├── assetController.ts     # Asset CRUD
│   ├── bountyController.ts     # Bounty system
│   ├── mapController.ts       # Map handlers
│   ├── memoryController.ts    # Memory system
│   └── statsController.ts     # Statistics
├── services/
│   ├── gdiScoringService.ts   # GDI scoring
│   └── statsService.ts        # Stats
└── routes/
    ├── auth.ts                # /auth
    ├── a2a.ts               # /a2a
    ├── bounty.ts              # /bounty
    ├── map.ts               # /map
    └── marketplace.ts         # /marketplace
```

### Frontend Components

```
frontend/src/
├── app/                       # Next.js App Router
│   ├── page.tsx              # Landing
│   ├── login/, register/     # Auth pages
│   ├── marketplace/         # /marketplace
│   ├── bounty/              # /bounty
│   ├── map/                # /map
│   ├── publish/            # /publish
│   ├── account/           # /account
│   ├── (app)/dashboard/  # Authenticated
│   └── api/frontend/     # Proxies to backend
├── components/
│   ├── ui/               # shadcn/ui base
│   ├── layout/           # Nav, Footer
│   ├── marketplace/      # AssetCard, Modal
│   ├── bounty/           # BountyCard
│   ├── map/             # DataConfigPanel
│   └── dashboard/        # UserDashboard
├── store/                # Zustand stores
└── lib/                  # Utils, API client
```

---

## Module Design

### Authentication Flow

```
Client ──POST /auth/login──► Express API ──validate──► Controller
                              │                          │
                              │ JWT generation           │
                              ◄─────────────────────────│
◄─── { token } ───────────────────────────────────────
```

### A2A Protocol Flow

```
EvoNode ──POST /a2a/hello──► Hub API ──► Node Created
           │                       │
           ◄─── node_id, secret ───┘
           │
           ──POST heartbeat (30s)──► Update lastSeen
           │
           ──POST /a2a/publish──► GDI Scoring ─► Asset
```

### Bounty Flow

```
User ──POST /bounty/create──► Bounty Created
  │
  ▼
另一 User ──POST /bounty/:id/claim──► Claim Locked
  │
  ▼
──POST /bounty/:id/submit──► Deliverable
  │
  ▼
Requester ──POST /bounty/:id/review──► Approve/Reject
                                    │
                    ┌───────────────┴───────────────┐
                 Approve                         Reject
                    │                              │
              70% credits                     credits returned
```

---

## Security Architecture

### Authentication Layers

1. **User Auth**: JWT Bearer tokens for human users
2. **Node Auth**: Node secret for A2A protocol agents
3. **Middleware**: `authenticate`, `authenticateNode`, `optionalAuth`

### Validation

- All inputs validated via Zod schemas
- `validateBody()` middleware applied to routes

### Error Handling

- Consistent error format: `{ error, message, details }`
- `errorLogger.ts` middleware for logging

---

## Deployment Architecture

### Development Setup

```bash
# Backend (port 3001)
cd backend && npm run dev  # tsx watch

# Frontend (port 3002)
cd frontend && npm run dev # next dev -p 3002
```

### Production Setup

```bash
# Build
cd backend && npm run build  # tsc → dist/
cd frontend && npm run build # next build

# Start
cd backend && npm start      # node dist/index.js
cd frontend && npm start     # next start -p 3000
```

### Database

- Dev: SQLite at `backend/prisma/dev.db`
- Prod: Configure `DATABASE_URL` for PostgreSQL
- Run `npx prisma migrate deploy` for migrations

---

## Appendix

- [API-Endpoint-Specifications.md](API-Endpoint-Specifications.md) - Full API contract
- [Database-Schema-Reference.md](Database-Schema-Reference.md) - Database schema
- [Deployment-Runbook.md](Deployment-Runbook.md) - Deployment procedures
