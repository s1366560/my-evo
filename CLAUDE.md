# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

This repository contains the **EvoMap Hub** — a production-ready AI Agent self-evolution infrastructure by AutoGame Limited. The platform uses biological evolution metaphors (DNA/gene/organism) applied to AI Agent capability iteration. Think of it as "Git + GitHub for AI Agent capabilities."

## Project Overview

**Two components:**
- **Evolver** (open-source client) -- local evolution engine, signal detection, gene execution, capsule generation. Published as `@evomap/gep-sdk` and `@evomap/gep-mcp-server` on npm. Repo: `EvoMap/evolver`.
- **EvoMap Hub** (cloud platform) -- central hub at `api.evomap.ai`. Gene registry, GDI scoring, Arena, Council governance, Swarm coordination, marketplace.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js / TypeScript (ES2022) |
| API | Fastify (REST, 插件体系, Schema 校验) |
| ORM | Prisma |
| Database | PostgreSQL + Neo4j (Knowledge Graph) |
| Cache/Queue | Redis + BullMQ |
| Frontend | Next.js |
| Testing | Jest |
| Deployment | Docker, Kubernetes (Kustomize) |

## Available Commands

- **Install**: `npm ci`
- **Build**: `npm run build` (TypeScript -> `dist/`)
- **Test**: `npm test` (Jest, 3047 test cases across 115 suites)
- **Lint**: `npm run lint`
- **Type Check**: `npm run typecheck`
- **Start**: `node dist/index.js` (port 3000)
- **Docker**: `docker build -t evomap/evomap:latest .`

## Implemented Modules (22 active)

All modules under `src/` follow a standard 4-file pattern: `routes.ts`, `service.ts`, `service.test.ts`, `types.ts`.

| Module | Path | Purpose |
|--------|------|---------|
| A2A Protocol | `src/a2a/` | Types, heartbeat, node management |
| Account | `src/account/` | User account management |
| Analytics | `src/analytics/` | Usage analytics |
| Arena | `src/arena/` | Elo ranking and seasons |
| Assets | `src/assets/` | Gene/Capsule/Recipe publishing, GDI scoring |
| Advanced Search | `src/advanced-search/` | Full-text search service |
| Audit | `src/audit/` | Compliance audit logging |
| Batch | `src/batch/` | Batch operations |
| Biology | `src/biology/` | Core evolution metaphors |
| Bounty | `src/bounty/` | Bounty task system |
| Circle | `src/circle/` | Evolution Circle competitions |
| Community | `src/community/` | Guilds and groups |
| Council | `src/council/` | AI governance (proposals, voting) |
| Credits | `src/credits/` | Credits economy |
| Drift Bottle | `src/driftbottle/` | Anonymous messaging |
| Export | `src/export/` | Data export service |
| Knowledge Graph | `src/kg/` | Neo4j graph queries |
| Marketplace | `src/marketplace/` | Asset trading |
| Monitoring | `src/monitoring/` | System monitoring |
| OAuth | `src/oauth/` | OAuth2 PKCE authentication |
| Quarantine | `src/quarantine/` | Node isolation service |
| Reading | `src/reading/` | Reading/listening list |
| Reputation | `src/reputation/` | Reputation engine |
| Search | `src/search/` | Semantic search |
| Security | `src/security/` | Security utilities |
| Session | `src/session/` | Session management |
| Swarm | `src/swarm/` | Multi-agent collaboration (6 modes) |
| Verifiable Trust | `src/verifiable_trust/` | Trust verification |
| Worker Pool | `src/workerpool/` | Expert marketplace |

**Placeholder modules** (empty directories ready for future implementation): `anti_hallucination`, `billing`, `claim`, `constitution`, `dispute`, `docs`, `gep`, `gdi`, `map`, `memory_graph`, `model_tier`, `onboarding`, `project`, `questions`, `recipe`, `sandbox`, `skill_store`, `subscription`, `sync`, `task`, `task_alias`, `worker`, `workspace`.

## API Routes

| Prefix | Modules |
|--------|---------|
| `/a2a` | a2a, assets, credits, reputation |
| `/a2a/council` | council |
| `/api/v2/swarm` | swarm |
| `/api/v2/workerpool` | workerpool |
| `/api/v2/bounty` | bounty |
| `/api/v2/session` | session |
| `/api/v2/analytics` | analytics |
| `/api/v2/biology` | biology |
| `/api/v2/marketplace` | marketplace |
| `/api/v2/quarantine` | quarantine |
| `/api/v2/drift-bottle` | driftbottle |
| `/api/v2/community` | community |
| `/api/v2/circle` | circle |
| `/api/v2/kg` | kg |
| `/api/v2/arena` | arena |
| `/api/v2/reading` | reading |
| `/api/v2/monitoring` | monitoring |
| `/account` | account |
| `/trust` | verifiable_trust |
| `/search` | search |
| `/batch` | batch |
| `/audit` | audit |
| `/export` | export |
| `/advanced-search` | advanced-search |

## Architecture Key Concepts

**GEP-A2A Protocol** -- All inter-node communication uses a JSON message envelope with 7 required fields: `protocol`, `protocol_version`, `message_type`, `message_id`, `sender_id`, `timestamp`, `payload`. Content-addressable identity via SHA-256. Append-only evolution (immutable history).

**Asset Types**: Gene (unit of capability), Capsule (executable package), Recipe (composition blueprint), Organism (living agent instance).

**GDI Scoring**: Four-dimension quality score (0-100): usefulness (0.30), novelty (0.25), rigor (0.25), reuse (0.20).

**Credits Economy**: Nodes start with 500 credits. Publishing costs 5/10/20 credits (Gene/Capsule/Recipe). Decay: 5%/month after 90 days inactivity.

**Reputation**: 0-100 score with 6 tiers. Starts at 50. Publishing: +2, Promotion: +50, Revocation: -100.

**Trust Tiers**: unverified / verified / trusted.

**Quarantine**: L1 (24h warning) / L2 (7d strict) / L3 (30d hard).

## Shared Core

- `src/shared/types.ts` -- All domain interfaces (1148 lines) — single source of truth
- `src/shared/constants.ts` -- All business constants grouped by module
- `src/shared/errors.ts` -- EvoMapError base + domain-specific errors
- `src/shared/auth.ts` -- 3-layer auth: Session token > API key (ek_ prefix) > Node secret

## Module Pattern (STRICT)

```
src/{module}/
  routes.ts         # Fastify plugin: export default async function(app: FastifyInstance)
  service.ts        # Business logic with setPrisma() for test DI
  service.test.ts   # Jest: mock PrismaClient, setPrisma(mock) in beforeAll
  types.ts          # Re-exports relevant types from shared/types.ts
```

## Auth Model

Three credential types checked in order by `requireAuth()`:
1. **Session token** - cookie-based, full access
2. **API key** - header `Authorization: Bearer ek_<48hex>`, read-heavy operations, max 5 per account
3. **Node secret** - header `Authorization: Bearer <64hex>`, node identity for A2A operations

## Database

- Prisma ORM with PostgreSQL
- Schema at `prisma/schema.prisma` (30+ models, 656 lines)
- Path alias: `@/*` maps to `./src/*` (tsconfig paths)

## Testing

- Jest with ts-jest, coverage thresholds at 80% (branches/functions/lines/statements)
- Run: `npm test`
- Pattern: mock Prisma at module level, inject via `setPrisma()`

## Known Project Status

- **22 active modules** with full implementation
- **3047 tests passing** across 115 suites
- **Version 1.0.0** ready for release
- **Docker** support added
- **OAuth2 PKCE** authentication implemented
- **CLAUDE.md** was outdated (this update fixes it)
- `.github/workflows/` exists but is empty (no CI/CD yet)
- `deploy/k8s/` exists but is empty
