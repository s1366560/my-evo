# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

This repository is in **pre-implementation / design phase**. The only file is `evomap-architecture-v5.md`, a comprehensive 42-chapter architecture design document (~15K lines) that defines the entire platform. No source code, build configuration, or dependencies exist yet.

## Project Overview

EvoMap is an **AI Agent self-evolution infrastructure** by AutoGame Limited. The platform uses biological evolution metaphors (DNA/gene/organism) applied to AI Agent capability iteration. Think of it as "Git + GitHub for AI Agent capabilities."

**Two components:**
- **Evolver** (open-source client) -- local evolution engine, signal detection, gene execution, capsule generation. Published as `@evomap/gep-sdk` and `@evomap/gep-mcp-server` on npm. Repo: `EvoMap/evolver`.
- **EvoMap Hub** (cloud platform) -- central hub at `api.evomap.ai`. Gene registry, GDI scoring, Arena, Council governance, Swarm coordination, marketplace.

## Planned Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js / TypeScript (ES2022) |
| API | Fastify (REST, 插件体系, Schema 校验) |
| ORM | Prisma |
| Database | PostgreSQL + Neo4j (Knowledge Graph) |
| Cache/Queue | Redis + BullMQ |
| Frontend | Next.js |
| Testing | Jest |
| Deployment | Vercel (Serverless) + Kubernetes (Kustomize) |

## Planned Commands

- **Install**: `npm ci`
- **Build**: `npm run build` (TypeScript -> `dist/`)
- **Test**: `npm test` (Jest, 128+ planned test cases)
- **Lint**: `npm run lint`
- **Start**: `node dist/index.js` (port 3000)
- **Docker**: `docker build -t evomap/evomap:latest .`

## Architecture Key Concepts

**GEP-A2A Protocol** -- All inter-node communication uses a JSON message envelope with 7 required fields: `protocol`, `protocol_version`, `message_type`, `message_id`, `sender_id`, `timestamp`, `payload`. Content-addressable identity via SHA-256. Append-only evolution (immutable history).

**Asset Types**: Gene (unit of capability), Capsule (executable package), Recipe (composition blueprint), Organism (living agent instance).

**GDI Scoring**: Four-dimension quality score (0-100): usefulness (0.30), novelty (0.25), rigor (0.25), reuse (0.20).

**Credits Economy**: Nodes start with 500 credits. Publishing costs 5/10/20 credits (Gene/Capsule/Recipe). Decay: 5%/month after 90 days inactivity.

**Reputation**: 0-100 score with 6 tiers. Starts at 50. Publishing: +2, Promotion: +50, Revocation: -100.

**Trust Tiers**: unverified / verified / trusted.

**Quarantine**: L1 (24h warning) / L2 (7d strict) / L3 (30d hard).

## Planned Module Structure

All modules under `src/`:

| Module | Path | Purpose |
|--------|------|---------|
| A2A Protocol | `src/a2a/` | Types, heartbeat, node management |
| Assets | `src/assets/` | Similarity detection, publishing, store, GDI scoring |
| Swarm | `src/swarm/` | Multi-agent collaboration (6 modes) |
| Council | `src/council/` | AI governance (proposals, voting) |
| Reputation | `src/reputation/` | Reputation engine |
| Worker Pool | `src/workerpool/` | Expert marketplace |
| Quarantine | `src/quarantine/` | Node isolation service |
| Search | `src/search/` | Semantic search |
| Knowledge Graph | `src/kg/` | Neo4j graph queries |
| Arena | `src/arena/` | Elo ranking and seasons |
| Biology | `src/biology/` | Core evolution metaphors |
| Memory Graph | `src/memory_graph/` | Agent memory with confidence decay |
| Skill Store | `src/skill_store/` | Skill distillation |
| Anti-Hallucination | `src/anti_hallucination/` | Hallucination detection |
| Marketplace | `src/marketplace/` | Asset trading |
| Community | `src/community/` | Guilds and groups |
| Circle | `src/circle/` | Evolution Circle competitions |

**API Routes**: Phase 1 under `/a2a/` prefix, v2 modules under `/api/v2/`.

## Documentation Language

The architecture document is written in Chinese (Simplified). When implementing, follow the Chinese-language specifications exactly. API field names, TypeScript interfaces, and code identifiers use English as defined in the spec.

## Key Configuration Parameters

Reference `evomap-architecture-v5.md` Chapter 34 for the full parameter table. Critical values are defined per-module (e.g., `HEARTBEAT_INTERVAL_MS = 900000` in `src/a2a/heartbeat.ts`, `SIMILARITY_THRESHOLD = 0.85` in `src/assets/similarity.ts`). Constants should be exported from their respective module files, not centralized.
