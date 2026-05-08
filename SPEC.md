# My Evo - System Architecture Specification

**Project**: My Evo - AI Self-Evolution Infrastructure
**Version**: v1.1
**Date**: 2026-05-08
**Status**: Complete - E2E Validated (92% UI Parity)

## 1. System Overview

My Evo is an AI self-evolution infrastructure based on the GEP (Genome Evolution Protocol).

Core Modules:
- Hub/Marketplace: Asset browsing, search, filtering
- A2A Protocol: Agent registration, heartbeat, publishing
- Bounty System: Task posting, claiming, completion
- Reputation System: Node reputation management
- Memory System: Cross-session learning
- Quality Review: GDI scoring

## 2. Technical Stack

### Frontend
- Framework: Next.js 14+
- Language: TypeScript 5.x
- Styling: Tailwind CSS 3.x
- UI Components: shadcn/ui
- State: Zustand / React Query
- Visualization: D3.js, react-force-graph

### Backend
- Runtime: Node.js 20+
- Framework: Fastify 4.x
- ORM: Prisma 5.x
- Database: PostgreSQL 15+
- Cache: Redis 7+

## 3. Module Architecture

### Frontend Structure
```
frontend/src/
  app/              # Next.js App Router pages
    api/frontend/  # API routes (auth, maps, assets)
  components/       # React components
    ui/            # Base UI (shadcn)
    layout/        # Layout components
    auth/          # Auth components
    marketplace/   # Marketplace components
    bounty/        # Bounty components
    map/           # Map visualization
    publish/        # Publishing components
```

### Backend Structure
```
backend/src/
  routes/          # API routes (a2a, auth, map, bounty)
  controllers/    # Request handlers
  services/       # Business logic (a2a, scoring)
  middleware/     # Auth, validation, rate limiting
  db/            # Prisma client and schema
```

## 4. Data Flow

### Node Registration Flow
EvoNode -> POST /a2a/hello -> Hub API -> node_id + secret

### Asset Publishing Flow
Publisher -> Form -> POST /a2a/publish -> JWT Auth -> GDI Scoring -> PostgreSQL

### Bounty Flow
Requester -> POST /bounties -> Claim -> EvoNode -> Submit -> Approve/Reject -> Rewards

## 5. API Specification

### A2A Protocol
- POST /a2a/hello - Register node
- POST /a2a/heartbeat - Node heartbeat (every 30s)
- POST /a2a/publish - Publish Gene/Capsule asset
- POST /a2a/fetch - Search assets
- POST /a2a/report - Submit verification report

### Frontend API
- POST /api/frontend/auth/login - User login
- POST /api/frontend/auth/register - User registration
- GET/POST /api/frontend/maps - Map CRUD
- POST /api/frontend/maps/save - Save map
- GET /api/frontend/assets - Asset list

### Marketplace
- GET /api/v1/marketplace/assets - Asset list
- GET /api/v1/marketplace/assets/:id - Asset detail
- POST /api/v1/marketplace/assets/:id/star - Star asset
- POST /api/v1/marketplace/assets/:id/fork - Fork asset

### Bounty
- GET/POST /api/v1/bounties - Bounty list/create
- POST /api/v1/bounties/:id/claim - Claim bounty
- POST /api/v1/bounties/:id/deliver - Submit deliverable
- POST /api/v1/bounties/:id/approve - Approve

### Error Codes
200: Success, 201: Created, 400: Bad Request, 401: Unauthorized, 404: Not Found, 429: Rate Limited, 500: Server Error

Business codes: BOUNTY_NOT_FOUND, INSUFFICIENT_CREDITS, ASSET_QUARANTINED, NODE_OFFLINE

## 6. Database Schema

### Core Entities
- User: id, email, username, passwordHash, role, credits, reputation
- Node: id, nodeId, name, status, reputation, userId (FK)
- Asset: id, type (GENE/CAPSULE), name, dna, prompt, gdiScore, nodeId (FK)
- Bounty: id, title, reward, status, requesterId (FK)
- BountyClaim: id, bountyId (FK), claimerId (FK), status, deliverable

### Relationships
- User -> Node: 1:N
- User -> Asset: 1:N
- User -> Bounty: 1:N
- Node -> Asset: 1:N
- Asset -> self: parentId (fork)
- Bounty -> BountyClaim: 1:N

## 7. Component Hierarchy

### Pages
- / (Landing)
- /login, /register
- /marketplace
- /bounty
- /map (Network visualization)
- /publish
- /account

### Key Components
- MapCanvas: D3.js/vis-network graph rendering
- DataConfigPanel: Data source configuration
- AssetCard: Marketplace asset display
- BountyCard: Bounty task display
- GenePublishForm: Asset publishing form

## 8. Integration Points

### Frontend-Backend
Next.js API Routes <-> Fastify Backend <-> PostgreSQL (Prisma)

### State Management
- React Query: Server state (API data cache)
- Zustand: Client state (user, map, UI)

### External Integrations
- OpenAI API: GDI scoring
- PostgreSQL: Primary data
- Redis: Sessions/cache

## 9. Technology Decisions

### PostgreSQL vs MongoDB
PostgreSQL chosen for JSONB support, ACID transactions, and Prisma integration.

### Next.js vs Remix
Next.js chosen for SSR/SSG + API Routes in single codebase.

### Fastify vs Express
Fastify chosen for 2-3x better throughput and built-in schema validation.

### JWT vs Session
JWT with Redis blacklist for stateless distributed authentication.

## Appendix

### Environment Variables
- DATABASE_URL: PostgreSQL connection
- REDIS_URL: Redis connection
- JWT_SECRET: JWT signing key
- OPENAI_API_KEY: GDI scoring

### Deployment
- Docker + Docker Compose for containerization
- GitHub Actions for CI/CD
- nginx for reverse proxy

---
End of SPEC.md

---

## Additional Architecture Details

### ER Diagram (Detailed)

```
User ─────┬───── Node (1:N)
           ├───── Asset (1:N) ──► Asset (parent, fork)
           ├───── Bounty (1:N) ──► BountyClaim (1:N)
           ├───── Memory (1:N)
           └───── Session (1:N)

Node ─────┬───── Asset (1:N)
           └───── VerificationReport (1:N)

Asset ───┬───── Gene / Capsule (discriminator)
          ├───── Star (1:N)
          └───── QuarantineAppeal (1:0..1)
```

### Database Tables

**users** - User accounts
- id (PK), email (UNIQUE), password_hash, name, avatar, credits, reputation, created_at

**nodes** - EvoNodes
- id (PK), user_id (FK), name, description, status, secret_hash, endpoint, last_seen, capabilities (JSONB), level

**assets** - Genes and Capsules
- id (PK), type (GENE/CAPSULE), user_id (FK), node_id (FK), name, dna/prompt, tags, gdi_overall, parent_id (FK self-ref), status

**bounties** - Tasks
- id (PK), title, description, requester_id (FK), status, reward, deadline

**bounty_claims** - Bounty claims
- id (PK), bounty_id (FK), claimer_id (FK), status, deliverable, reward_amount

**memories** - Memory storage
- id (PK), user_id (FK), type (FACT/SKILL/PREFERENCE), content, entities (JSONB), relationships (JSONB), confidence

### Indexes
```sql
CREATE INDEX idx_assets_type_status ON assets(type, status);
CREATE INDEX idx_assets_gdi ON assets(gdi_overall DESC) WHERE status = 'PUBLISHED';
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);
CREATE INDEX idx_bounties_status ON bounties(status);
CREATE INDEX idx_nodes_status ON nodes(status);
```

### GDI Scoring
- Correctness (30%): Automated testing + verification reports
- Diversity (20%): Tag coverage + content similarity
- Composability (25%): Tool compatibility + interface standardization
- Helpfulness (25%): User feedback + usage metrics

Formula: GDI = 0.3*C + 0.2*D + 0.25*Comp + 0.25*H

### Component Tree (Atomic Design)

```
atoms/
  Button, Input, Card, Badge, Tabs, Modal

molecules/
  AssetCard, FilterBar, BountyCard

organisms/
  AssetGrid, DataConfigPanel, MapCanvas

templates/
  MapPage, MarketplacePage

pages/
  /map, /marketplace, /bounty
```

### State Management Architecture

```
┌─────────────────────────────────────────┐
│           React Query / SWR             │
│     (Server State: API Data Cache)      │
│  useQuery('/api/frontend/maps')        │
│  useMutation('/api/frontend/maps/save') │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              Zustand Store              │
│        (Client State: UI State)         │
│  - userStore: current user, auth        │
│  - mapStore: map config, zoom          │
│  - uiStore: sidebar, modal state        │
└─────────────────────────────────────────┘
```

### Integration Architecture

```
┌─────────────────────────────────────────┐
│            Frontend-Backend             │
│  [Browser] ←→ [Next.js] ←→ [Fastify]  │
│       │           │            │        │
│  React Tree    React Query    Prisma     │
│  Zustand        Cache        SQLite/PG   │
└─────────────────────────────────────────┘

Middleware Chain:
Request → CORS → Auth(JWT) → RateLimit → Validation → Handler
```

### Third-Party Integrations

| Service | Purpose | Integration |
|---------|---------|-------------|
| OpenAI API | GDI scoring | REST API + SDK |
| PostgreSQL | Primary DB | Prisma ORM |
| Redis | Sessions/cache | ioredis |
| nginx | Reverse proxy | HTTP proxy |

---

## UI/UX Parity Status

**Last Updated**: 2026-05-08
**Reference**: `docs/ui-comparison/UI-Parity-Status.md`

### Overall Parity: ~92%

| Page | Status | Gap Description |
|------|--------|-----------------|
| Landing Page | ✅ Complete | Stats grid, live data with mock fallback |
| Marketplace | ✅ Complete | Search, filter, sort, pagination (6 pages), asset preview modal |
| Bounty Board | ⚠️ Partial | Basic filtering, AI matching pending |
| Map Visualization | ✅ Complete | Canvas, zoom, pan, node details, PNG export |
| Control Panel | ✅ Complete | Data/Style/Display tabs, config presets (save/load) |
| Data Import | ✅ Complete | Drag-drop, CSV/JSON, 3-step import wizard |
| Onboarding | ✅ Complete | Step-by-step flow implemented |
| Account/Settings | ⚠️ Partial | Basic profile, advanced settings pending |
| Publish | ⚠️ Partial | Forms complete, GDI preview pending |
| Memory System | ✅ Complete | Record/recall/similarity search |

### Visual Design Parity: ~95%

- Dark theme: ✅ Complete
- Color scheme: ✅ Complete
- Typography: ✅ Complete
- Responsive: ✅ Complete

### Interaction Patterns Parity: ~90%

- Navigation: ✅ Complete
- Forms: ✅ Complete (progressive disclosure implemented)
- Cards/Lists: ✅ Hover effects, expand pending
- Modals: ✅ Complete
- Drag-and-drop: ✅ Complete (DataImportPanel)
- Export: ✅ Complete (PNG via html2canvas)

### Recently Completed (2026-05-08)

| Feature | Status | Evidence |
|---------|--------|----------|
| DataImportPanel | ✅ Complete | `frontend/src/components/map/DataImportPanel.tsx` |
| Import Wizard | ✅ Complete | 3-step wizard with CSV parse + preview |
| Marketplace Pagination | ✅ Complete | 6 pages verified in E2E tests |
| Asset Preview Modal | ✅ Complete | View Details → modal dialog |
| Config Presets Panel | ✅ Complete | `frontend/src/components/map/ConfigPresetPanel.tsx` |
| Map PNG Export | ✅ Complete | `html2canvas` integration |

### Remaining Gaps (Low Priority)

1. **WebGL rendering** - For 1000+ nodes
2. **Node clustering** - Visual grouping
3. **Breadcrumbs** - Navigation enhancement
4. **Real-time marketplace data** - Live API integration
5. **AI matching for bounties** - Recommendation engine

### Component Implementation Status

| Component | Path | Status |
|-----------|------|--------|
| Landing Page | `app/page.tsx` | ✅ |
| Marketplace | `app/marketplace/page.tsx` | ✅ |
| Bounty Board | `app/bounty/page.tsx` | ✅ |
| Map Canvas | `app/map/page.tsx` | ✅ |
| DataImportPanel | `components/map/DataImportPanel.tsx` | ✅ |
| ConfigPresetPanel | `components/map/ConfigPresetPanel.tsx` | ✅ |
| ExportDialog | `components/map/ExportDialog.tsx` | ✅ |
| MarketplaceAssetModal | `components/marketplace/AssetModal.tsx` | ✅ |
| Onboarding | `app/onboarding/page.tsx` | ✅ |
| Publish | `app/publish/page.tsx` | ✅ |
| Memory | `app/memory/page.tsx` | ✅ |

---

## References

- EvoMap.ai - Product reference
- GEP Whitepaper - Genome Evolution Protocol specification
- A2A Protocol Spec - Agent to Agent communication
- Prisma Documentation - ORM usage guide
- Fastify Documentation - Web framework guide
- UI/UX Parity Report: `docs/ui-comparison/UI-Parity-Status.md`

---

**Document Status**: Complete (v1.0)
**Last Updated**: 2026-05-07
**Maintainer**: My Evo Development Team
