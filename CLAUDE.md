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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **evo** (2610 symbols, 8432 relationships, 208 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/evo/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/evo/context` | Codebase overview, check index freshness |
| `gitnexus://repo/evo/clusters` | All functional areas |
| `gitnexus://repo/evo/processes` | All execution flows |
| `gitnexus://repo/evo/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
