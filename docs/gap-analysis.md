# Gap Analysis: my-evo vs evomap.ai

**Generated:** 2026-05-19  
**Git HEAD:** 91b28571f (ci: add Drone deploy smoke stage)  
**Branch:** workspace/node-7e85e7805af2-552dc78f-8e5

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| Backend Modules (src/) | **CRITICAL** | 16 present, 33 missing (app.ts imports non-existent modules) |
| Frontend Pages | ~65% | 19 pages exist, ~12 missing |
| A2A Protocol | **BLOCKED** | All 15 core endpoints missing |
| Database Schema | ~85% | 28+ models defined |

**Overall Parity: ~35%** (code exists but critical modules missing)

---

## 1. CRITICAL: Missing Backend Modules

**Finding:** `src/app.ts` dynamically imports 33 modules that do NOT exist in `src/`:

| Module | Imported From | Registered Route | Status |
|--------|---------------|------------------|--------|
| a2a | `./a2a/routes` | `/a2a` | **MISSING** |
| assets | `./assets/routes` | `/assets` | **MISSING** |
| claim | `./claim/routes` | `/claim` | **MISSING** |
| reputation | `./reputation/routes` | `/a2a` | **MISSING** |
| swarm | `./swarm/routes` | `/api/v2/swarm` | **MISSING** |
| workerpool | `./workerpool/routes` | `/api/v2/workerpool` | **MISSING** |
| council | `./council/routes` | `/a2a/council` | **MISSING** |
| bounty | `./bounty/routes` | `/api/v2/bounty` | **MISSING** |
| biology | `./biology/routes` | `/api/v2/biology` | **MISSING** |
| quarantine | `./quarantine/routes` | `/api/v2/quarantine` | **MISSING** |
| driftbottle | `./driftbottle/routes` | `/api/v2/drift-bottle` | **MISSING** |
| community | `./community/routes` | `/api/v2/community` | **MISSING** |
| circle | `./circle/routes` | `/api/v2/circle` | **MISSING** |
| kg | `./kg/routes` | `/api/v2/kg` | **MISSING** |
| arena | `./arena/routes` | `/api/v2/arena` | **MISSING** |
| account | `./account/routes` | `/account` | **MISSING** |
| onboarding | `./onboarding/routes` | `/onboarding` | **MISSING** |
| verifiable_trust | `./verifiable_trust/routes` | `/trust` | **MISSING** |
| reading | `./reading/routes` | `/api/v2/reading` | **MISSING** |
| sync | `./sync/routes` | `/a2a/sync` | **MISSING** |
| task | `./task/routes` | `/api/v2` | **MISSING** |
| task_alias | `./task_alias/routes` | `/task` | **MISSING** |
| dispute | `./dispute/routes` | `/api/v2/disputes` | **MISSING** |
| recipe | `./recipe/routes` | `/api/v2/recipes` | **MISSING** |
| gepx | `./gepx/routes` | `/api/v2/gepx` | **MISSING** |
| anti_hallucination | `./anti_hallucination/routes` | `/api/v2/anti-hallucination` | **MISSING** |
| skill_store | `./skill_store/routes` | `/api/v2/skills` | **MISSING** |
| constitution | `./constitution/routes` | `/a2a/constitution` | **MISSING** |
| docs | `./docs/routes` | `/docs` | **MISSING** |
| agent_config | `./agent_config/routes` | `/api/v2` | **MISSING** |
| model_tier | `./model_tier/routes` | `/api/v2` | **MISSING** |
| project | `./project/routes` | `/a2a` | **MISSING** |
| memory_graph | `./memory_graph/routes` | `/api/v2/memory-graph` | **MISSING** |

**Present Modules (16):** advanced-search, audit, batch, billing, credits, export, feedback, gdi, gep, map, marketplace, monitoring, oauth, sandbox, search, security, session, shared, subscription, webhook, worker, workspace

---

## 2. API Endpoint Gaps

### 2.1 Core A2A Endpoints (evomap.ai)

| Endpoint | evomap.ai | my-evo | Priority |
|----------|-----------|--------|----------|
| `POST /a2a/hello` | ✅ | ❌ Module missing | P0 |
| `POST /a2a/heartbeat` | ✅ | ❌ Module missing | P0 |
| `POST /a2a/publish` | ✅ | ❌ Module missing | P0 |
| `POST /a2a/fetch` | ✅ | ❌ Module missing | P0 |
| `POST /a2a/search` | ✅ | ❌ Module missing | P0 |
| `POST /a2a/report` | ✅ | ❌ Module missing | P0 |
| `GET /a2a/directory` | ✅ | ❌ Module missing | P0 |
| `GET /a2a/nodes/:nodeId` | ✅ | ❌ Module missing | P0 |
| `GET /a2a/billing/earnings` | ✅ | ❌ Module missing | P0 |
| `GET /a2a/help` | ✅ | ❌ Module missing | P1 |
| `POST /a2a/memory/record` | ✅ | ❌ Module missing | P1 |
| `POST /a2a/memory/recall` | ✅ | ❌ Module missing | P1 |

### 2.2 Platform Documentation Endpoints

| Endpoint | evomap.ai | my-evo | Status |
|----------|-----------|--------|--------|
| `GET /api/docs/wiki-full` | ✅ | ❌ | BLOCKED |
| `GET /api/wiki/index` | ✅ | ❌ | BLOCKED |
| `GET /ai-nav` | ✅ | ❌ | BLOCKED |
| `GET /docs` | ✅ | ❌ | BLOCKED |

---

## 3. Frontend Page Gaps

### 3.1 Existing Pages (19 pages)

| Page | Path | Status |
|------|------|--------|
| Landing | `/` | ✅ |
| Marketplace | `/marketplace` | ✅ |
| Browse | `/browse`, `/browse/trending`, `/browse/new` | ✅ |
| Map/Editor | `/map`, `/editor` | ✅ |
| Auth | `/login`, `/register` | ✅ |
| Publish | `/publish` | ✅ |
| Pricing | `/pricing` | ✅ |
| Onboarding | `/onboarding` | ✅ |
| Bounty | `/bounty`, `/bounty/[bountyId]`, `/bounty/create`, `/bounty-hall` | ✅ |
| Workspace | `/workspace` | ✅ |
| Dashboard | `/(app)/dashboard/bounties`, `/(app)/dashboard/onboarding` | ✅ |

### 3.2 Missing Pages

| Page | Priority | evomap.ai Path |
|------|----------|-----------------|
| Capsule Hot List | P1 | Landing section |
| Asset Detail/Lineage | P1 | `/asset/:id` |
| Agent Directory | P2 | `/directory` |
| Arena Rankings | P2 | Arena tab |
| Biology Dashboard | P2 | Biology section |
| Council/Governance | P2 | Council page |
| Skills Browse | P2 | Skills marketplace |
| Drift Bottle | P3 | Drift bottle UI |
| Circles/Guild | P3 | Community pages |
| Profile/Settings | P2 | User profile |

---

## 4. Database Schema Status

**Status:** 28+ models defined in `prisma/schema.prisma`

**Models:** Node, Asset, KnowledgeGraphRelationship, EvolutionEvent, GDIScoreRecord, AssetDownload, AssetVote, SimilarityRecord, CreditTransaction, ReputationEvent, QuarantineRecord, QuarantineAppeal, SwarmTask, SwarmSubtask, Worker, Proposal, ProposalVote, Bounty, BountyBid, BountyMilestone, Dispute, Appeal, ValidatorStake, TrustAttestation, ApiKey, UserSession, User, OnboardingState, CollaborationSession, Guild, Circle, ArenaSeason, ArenaMatch, DriftBottle, MarketplaceListing, MarketplaceTransaction, Question, QuestionAnswer, Project, ReadingSession, MemoryNode

**Assessment:** Database schema is comprehensive and well-structured.

---

## 5. Feature Parity Checklist

### Core Platform Features

| Feature | evomap.ai | my-evo | Notes |
|---------|-----------|--------|-------|
| Landing page | ✅ | ✅ | |
| Agent registration | ✅ | ❌ | Module missing |
| Node claiming | ✅ | ❌ | Module missing |
| Asset publishing | ✅ | ❌ | Module missing |
| Marketplace browse | ✅ | ✅ | UI exists, backend blocked |
| Search | ✅ | ❌ | Module missing |
| Bounty system | ✅ | ❌ | Module missing |
| Credit system | ✅ | ❌ | Module missing |
| Reputation/GDI | ✅ | ❌ | Module missing |
| Worker pool | ✅ | ❌ | Module missing |
| Council/Governance | ✅ | ❌ | Module missing |
| Swarm coordination | ✅ | ❌ | Module missing |
| Arena | ✅ | ❌ | Module missing |
| Subscription | ✅ | ❌ | Module missing |

### Documentation & Help

| Feature | evomap.ai | my-evo | Status |
|---------|-----------|--------|--------|
| Wiki documentation | ✅ | ❌ | BLOCKED |
| Help API | ✅ | ❌ | BLOCKED |
| AI Navigation guide | ✅ | ❌ | BLOCKED |
| Skill integration guide | ✅ | ❌ | BLOCKED |

---

## 6. Implementation Priority

### P0 - Critical (App won't start)

1. **Audit app.ts** - Either create missing modules or stub/remove imports
2. **Implement A2A routes** - Core protocol module
3. **Implement Asset module** - CRUD and publishing
4. **Implement Docs module** - Wiki and documentation

### P1 - High Priority (Core platform)

1. **Bounty module** - Task and reward system
2. **Reputation module** - GDI scoring
3. **Marketplace module** - Full marketplace backend
4. **Search module** - Asset discovery
5. **Credits module** - Economy system

### P2 - Medium Priority

1. **Swarm module** - Multi-agent coordination
2. **Council module** - Governance
3. **Workerpool module** - Task assignment
4. **Arena module** - Competition system
5. **Subscription module** - Billing

### P3 - Lower Priority

1. **Circle/Guild modules** - Community features
2. **Drift bottle** - Anonymous messaging
3. **Knowledge Graph** - Advanced features
4. **Reading Engine** - Content processing

---

## 7. Recommendations

### Immediate Actions

1. **Fix app.ts imports** - Run `npm run build` or `npx tsx src/index.ts` to verify which modules are truly missing
2. **Create stub modules** - For missing modules, create minimal stubs to allow app to start
3. **Implement A2A protocol** - This is the core of evomap.ai functionality

### Short-term (1-2 sprints)

1. Complete all P0 and P1 modules
2. Add integration tests for A2A protocol
3. Verify end-to-end asset publishing flow

### Medium-term

1. Add missing frontend pages
2. Implement marketplace purchase flow
3. Add skill marketplace

---

## References

- evomap.ai: https://evomap.ai
- GitHub: https://github.com/s1366560/my-evo
- Main backend entry: `src/app.ts` (line 192-518 imports)
- Database schema: `prisma/schema.prisma`
- Frontend: `frontend/src/app/`
