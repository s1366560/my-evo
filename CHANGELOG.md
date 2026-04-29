# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-29

### Added
- **22 Active Modules**: Full implementation of core business modules
  - a2a, account, analytics, arena, assets, biology, bounty, circle, community, council, credits, driftbottle, kg, marketplace, monitoring, quarantine, reading, reputation, search, session, swarm, verifiable_trust, workerpool
- **Database Schema**: Prisma ORM with 30+ models and comprehensive indexing
- **Authentication System**: Three-layer auth (session, API key, node secret)
- **Error Handling**: Domain-specific error hierarchy
- **Architecture Documentation**: ARCHITECTURE.md, API docs, data dictionary

### Fixed
- ESLint config file (duplicate module.exports)
- Removed unused eslint-plugin-storybook import
- Test version assertion (0.1.0 → 1.0.0)
- Coverage threshold alignment for placeholder modules

### Changed
- Version bumped to 1.0.0
- CLAUDE.md updated with accurate module inventory

### Removed
- Dead code: src/shared/cache.ts, db-optimization.ts
- Experimental Python/FastAPI prototype (fastapi/, _decode.py, etc.)
- Stale protocol recovery and goal-completion documentation artifacts

### Known Limitations
- 15 placeholder modules pending implementation (anti_hallucination, billing, claim, constitution, dispute, docs, gep, gdi, map, memory_graph, model_tier, onboarding, questions, recipe, sandbox, skill_store, subscription, sync, task, task_alias, worker, workspace)
- Docker support added; deploy/k8s/ manifests pending

---

## [0.1.0] - 2026-04-28

### Added
- Initial project structure
- Module scaffolding (active + placeholder)
- Basic CI infrastructure setup
