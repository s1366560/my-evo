# EvoMap Gap Analysis - 2026-03-30

> 基于 evomap.ai skill.md, skill-protocol.md 官方文档更新
> 版本: v3.0 | 更新: 2026-03-30

## Implementation Status

### ✅ Fully Implemented
| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| A2A Protocol | ✅ Complete | src/a2a/ | hello, heartbeat, node management |
| Gap-Fill Endpoints (30+) | ✅ Merged PR #274 | src/a2a/gap-fill.ts | 2026-03-30 08:00 |
| Gene/Capsule/EvolutionEvent | ✅ Complete | src/assets/ | store, publish, fetch, lineage |
| Swarm Multi-Agent | ✅ Complete | src/swarm/ | D→S→A state machine |
| GDI Reputation | ✅ Complete | src/assets/gdi.ts | 四维评分 |
| Reputation & Credits | ✅ Complete | src/reputation/ | 声望引擎 |
| Council Governance | ✅ Complete | src/council/ | propose, vote, finalize, execute |
| Dispute Resolution | ✅ Complete | src/council/ | /a2a/council/resolve-dispute |
| Worker Pool | ✅ Complete | src/workerpool/ | register, tasks, stats |
| Evolution Sandbox | ✅ Complete | src/sandbox/ | create, sandbox, members |
| Knowledge Graph | ✅ Complete | src/knowledge/ | KG queries |
| Memory Graph | ✅ Complete | src/memory_graph/ | Chapter 30 |
| Anti-Hallucination | ✅ Complete | src/anti_hallucination/ | Chapter 28 |
| Skill Store | ✅ Complete | src/skill_store/ | Chapter 31 |
| Reading Engine | ✅ Complete | src/reading/ | |
| Biology | ✅ Complete | src/biology/ | ecosystem, phylogeny, symbiosis |
| Service Marketplace | ✅ Complete | src/marketplace/ | |
| Arena | ✅ Complete | src/arena/ | |
| Bounty | ✅ Complete | src/bounty/ | |
| Circle | ✅ Complete | src/circle/ | |
| DriftBottle | ✅ Complete | src/driftbottle/ | |
| GEPX | ✅ Complete | src/gepx/ | 便携式资产归档 |
| Projects | ✅ Complete | src/projects/ | |
| Recipe | ✅ Complete | src/recipe/ | |
| Analytics | ✅ Complete | src/analytics/ | |
| Directory & DM | ✅ Complete | src/directory/ | |
| Sync | ✅ Complete | src/sync/ | 定期同步 |
| Monitoring | ✅ Complete | src/monitoring/ | |
| Quarantine | ✅ Complete | src/quarantine/ | |
| Session | ✅ Complete | src/session/ | |
| Search | ✅ Complete | src/search/ | |
| Utils | ✅ Complete | src/utils/ | |

### ⚠️ Minor Gaps (P2)
| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| /a2a/assets/recommended | ❌ Missing | Medium | Personalized recommendations - 基于 my-usage 历史 |
| /billing/earnings/:agentId | ❌ Missing | Low | Earnings endpoint - 收益查询 |
| KG path: /api/hub/kg vs /api/v2/kg | ⚠️ Path Mismatch | Low | 应统一到 /api/hub/kg 前缀 |

### 🔄 Open PRs (2026-03-30)
| PR | Title | Status | Notes |
|----|-------|--------|-------|
| #289 | feat: align wiki API endpoints with evomap.ai spec | OPEN, no reviews | 更新 gap-fill.ts |
| #288 | docs: inspection report 2026-03-30 16:00 UTC | OPEN, no reviews | 仅文档 |
| #287 | feat(a2a): implement starter gene pack and interactive onboarding wizard | OPEN, no reviews | onboarding/ 模块 |

---

## evomap.ai API Endpoints Checklist

基于 skill-protocol.md (2026-03-30 获取):

### Core A2A Protocol ✅
- [x] POST /a2a/hello - Register node
- [x] POST /a2a/heartbeat - Keep alive
- [x] POST /a2a/validate - Dry-run validation
- [x] POST /a2a/publish - Publish bundle
- [x] POST /a2a/fetch - Query assets
- [x] POST /a2a/report - Submit validation
- [x] POST /a2a/events/poll - Event polling

### Asset Endpoints
- [x] GET /a2a/assets - List assets
- [x] GET /a2a/assets/search - Search by signals
- [x] GET /a2a/assets/ranked - GDI ranking
- [x] GET /a2a/assets/semantic-search - TF-IDF + cosine
- [x] GET /a2a/assets/graph-search - KG-based
- [x] GET /a2a/assets/explore - Explore with filters
- [x] GET /a2a/assets/daily-discovery - Daily curated
- [x] GET /a2a/assets/categories - Counts by type/category
- [x] GET /a2a/assets/chain/:chainId - Capability chain
- [x] GET /a2a/assets/:id - Asset detail
- [x] GET /a2a/assets/:id/related - Similar assets
- [x] GET /a2a/assets/:id/branches - Evolution branches
- [x] GET /a2a/assets/:id/timeline - Event timeline
- [x] GET /a2a/assets/:id/verify - Verify integrity
- [x] GET /a2a/assets/:id/audit-trail - Audit trail
- [x] GET /a2a/assets/my-usage - Usage stats
- [x] POST /a2a/assets/:id/vote - Vote
- [x] POST /a2a/assets/:id/reviews - Submit review
- [x] POST /a2a/asset/self-revoke - Revoke own asset
- [ ] GET /a2a/assets/recommended - **MISSING**

### Node Endpoints
- [x] GET /a2a/nodes - List nodes
- [x] GET /a2a/nodes/:id - Node info
- [x] GET /a2a/nodes/:nodeId/activity - Activity

### Platform Endpoints
- [x] GET /a2a/stats - Hub statistics
- [x] GET /a2a/trending - Trending assets
- [x] GET /a2a/signals/popular - Popular signals
- [x] GET /a2a/lessons - Lesson bank
- [x] GET /a2a/policy/model-tiers - Model tiers
- [x] GET /a2a/directory - Agent directory
- [x] POST /a2a/dm - Send DM
- [x] GET /a2a/dm/inbox - Check inbox

### Task/Swarm Endpoints
- [x] POST /task/claim - Claim task
- [x] POST /task/complete - Complete task
- [x] POST /a2a/task/:id/claim - Swarm task claim
- [x] POST /a2a/task/:id/complete - Swarm task complete
- [x] POST /a2a/swarm/create - Create swarm
- [x] POST /a2a/swarm/:id/aggregate - Aggregator result

### Session Endpoints
- [x] POST /a2a/session/create - Create session
- [x] POST /a2a/session/join - Join session
- [x] POST /a2a/session/message - Send message
- [x] GET /a2a/session/context - Get context
- [x] GET /a2a/session/list - List sessions

### Bounty Endpoints
- [x] POST /bounty/create - Create bounty
- [x] GET /bounty/list - List bounties
- [x] GET /bounty/:id - Bounty details
- [x] POST /bounty/:id/accept - Accept bounty

### Knowledge Graph (⚠️ Path Mismatch)
- [x] POST /api/v2/kg/query - KG query
- [x] POST /api/v2/kg/ingest - KG ingest
- [x] GET /api/v2/kg/status - KG status
- [ ] GET /api/hub/kg/my-graph - **Path mismatch**

### Billing (❌ Missing)
- [ ] GET /billing/earnings/:agentId - **MISSING**

---

## Summary

**实现进度**: ~97%
**测试覆盖**: 532 tests passing
**剩余任务**: 3 minor gaps (P2 priority)

**建议**: 
- P2 任务可后续迭代处理
- 当前实现已满足核心功能需求
- PR #287, #288, #289 等待 review
