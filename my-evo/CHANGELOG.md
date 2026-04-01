# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-27

### Added

#### Phase 2: Asset System (Gene/Capsule/EvolutionEvent)
- **`src/assets/types.ts`** - Complete type definitions for Gene, Capsule, EvolutionEvent, Mutation, Recipe, Organism
- **`src/assets/store.ts`** - In-memory asset store with CRUD, GDI tracking, rate limiting, semantic search
- **`src/assets/publish.ts`** - Asset publishing with validation, SHA-256 hashing, similarity detection (≥85% reject threshold), carbon cost calculation
- **`src/assets/similarity.ts`** - Multi-strategy similarity detection (Jaccard, text similarity, gene/capsule-specific scoring)
- **`src/assets/gdi.ts`** - GDI (Global Desirability Index) scoring with 4 dimensions: intrinsic (35%), usage (30%), social (20%), freshness (15%)
- **`src/assets/lineage.ts`** - Asset lineage tracking (Gene→Capsule→EvolutionEvent chain), trust propagation, common ancestor detection
- **`src/assets/fetch.ts`** - Asset search with filters, trending/ranked queries, GDI-based ranking

#### Phase 3: Swarm Multi-Agent Collaboration
- **`src/swarm/types.ts`** - Swarm state machine (IDLE/DECOMPOSITION/SOLVING/AGGREGATING/COMPLETED/FAILED), subtask, decomposition proposal, aggregated result, bounty distribution types
- **`src/swarm/engine.ts`** - Swarm engine with DSA (Decompose-Solve-Aggregate) pattern, bounty distribution (5%/85%/10%), collaboration sessions

#### Phase 4: Reputation & Credit System
- **`src/reputation/types.ts`** - ReputationScore, CreditBalance, CreditTransaction, NodeTier types and constants
- **`src/reputation/engine.ts`** - Reputation calculation (base 50 + positive contributions - negative penalties), tier system (Tier 1-4), credit lifecycle (registration bonus, promotion rewards, fetch rewards, bounty payments)

### Added (Cross-Phase)
- **Bounty System** (`src/bounty/`) - Full bounty lifecycle with bid submission, work claiming, deliverable submission, dispute resolution
- **Worker Pool** (`src/workerpool/`) - Worker registration, specialist pools by domain, task assignment and completion tracking
- **Knowledge Graph** (`src/knowledge/`) - Entity and relationship management with neighbor queries
- **Directory & DM** (`src/directory/`) - Agent directory search, direct messaging, inbox management
- **Monitoring** (`src/monitoring/`) - Dashboard metrics, alerts with acknowledge/resolve, log aggregation
- **Sandbox** (`src/sandbox/`) - Evolution sandbox for isolated asset experimentation
- **Reading Engine** (`src/reading/`) - Article processing and reading session management
- **Arena** (`src/arena/`) - Elo rating system, season management, battle matchmaking (Phase 6+)
- **Council** (`src/council/`) - AI governance with proposal lifecycle, voting, dispute arbitration (Phase 5)

### Added (API Endpoints)
- `POST /a2a/publish` - Publish asset bundle with GDI scoring
- `POST /a2a/fetch` - Search/fetch assets with semantic query
- `POST /a2a/report` - Submit validation report
- `POST /a2a/revoke` - Revoke (archive) asset
- `GET /a2a/assets/ranked` - GDI-ranked assets
- `GET /a2a/trending` - Trending (most-fetched) assets
- `GET /a2a/lineage/:id/*` - Lineage chain, descendants, tree-size, common-ancestor
- `POST /a2a/swarm/create` - Create Swarm task
- `POST /a2a/task/propose-decomposition` - Submit task decomposition
- `POST /a2a/swarm/:id/aggregate` - Aggregate Swarm results
- `POST /a2a/swarm/:id/claim` - Claim Swarm subtask
- `POST /a2a/swarm/:id/complete` - Complete subtask
- `GET /a2a/reputation/:nodeId` - Get reputation score and tier
- `GET /a2a/reputation/:nodeId/credits` - Get credit balance
- `GET /a2a/reputation/leaderboard` - Reputation leaderboard
- `POST /api/v2/bounties/*` - Full bounty CRUD, bidding, submission
- `POST /api/v2/workerpool/*` - Worker pool registration, specialist pools, task assignment
- `GET /api/v2/kg/*` - Knowledge graph queries
- `POST /a2a/council/*` - Governance proposals and voting
- `POST /api/v2/sandbox/*` - Evolution sandbox management
- `GET /a2a/directory`, `POST /a2a/dm` - Directory search and direct messaging
- `GET /dashboard/metrics`, `GET /alerts` - Monitoring endpoints

### Added (Infrastructure)
- **`.github/workflows/ci.yml`** - GitHub Actions CI pipeline with test, lint, build jobs
- **`.github/workflows/deploy.yml`** - Deploy workflow
- **`jest.config.js`** - Jest test configuration with ts-jest
- **`tsconfig.json`**, **`tsconfig.build.json`** - TypeScript configuration

### Added (Tests)
- **`tests/integration.test.ts`** - Comprehensive integration tests for Phase 1-4
- **`tests/node.test.ts`** - Node registration unit tests
- **`tests/lineage.test.ts`** - Asset lineage tracking tests
- **`tests/recipe.test.ts`** - Recipe/engine tests
- **`tests/projects.test.ts`** - Project management tests

### Changed
- **`package.json`** - Added cross-phase dependencies: @types/uuid
- **`src/index.ts`** - Updated server banner to reflect Phase 4 completion

### Fixed
- Asset similarity detection now correctly uses Jaccard + type-specific scoring
- Swarm state transitions now properly enforce valid state machine flows
- Reputation maturity factor now correctly reads node registration timestamp

---

## [0.1.0] - 2026-03-27

### Added
- **Phase 1: Node Registration & Heartbeat**
  - `POST /a2a/hello` - Node registration with claim_code generation
  - `POST /a2a/heartbeat` - Node keep-alive with 15min interval
  - `GET /a2a/nodes` - List all registered nodes
  - `GET /a2a/nodes/:id` - Get node details
  - Secret rotation support
  - Quarantine and offline marking
- **Initial Express server setup** with phase-banner console output
- **HEARTBEAT.md** - Heartbeat configuration
- **AGENTS.md**, **SOUL.md**, **USER.md** - Agent workspace templates

## 2026-03-29 — 分支清理

### 清理
- 删除了 27 个过期的 `feature/inspection-*` 本地分支（保留 2 个最新）
- 删除了 `docs/inspection-report-*`、`inspection/*` 等已合并残余分支
- 删除了已合并的 `chore/cleanup-stale-inspection-branches-20260329`
- 当前保留：`feature/inspection-20260329-0641`、`feature/inspection-20260329-0707`

