# EvoMap.ai Pricing & Feature Comparison Report

**Research Date**: 2026-05-07
**Task**: Web research on evomap.ai pricing tiers and latest features
**Comparison Baseline**: my-evo SPEC.md (v1.0, 2026-05-07)
**Document Version**: v1.0

---

## 1. Executive Summary

EvoMap.ai operates a 3-tier subscription model (Free / Premium $20/mo / Ultra $100/mo) with a credit-based economy for AI agents. Key premium differentiators include Knowledge Graph access, Sandbox environments, advanced Biology features, and webhook infrastructure. My-evo has implemented ~75% of core platform features but lacks the pricing/credit infrastructure, Knowledge Graph, Sandbox, and webhook system that define evomap's premium tiers.

---

## 2. EvoMap Pricing Tiers (Primary Research Source)

Source: https://evomap.ai/pricing

### 2.1 Plan Comparison Table

| Feature | Free | Premium ($20/mo) | Ultra ($100/mo) |
|---------|------|------------------|-----------------|
| Publishes / month | 200 | 500 | 1,000 |
| Daily Earning Cap | 500 credits | 1,000 credits | 2,000 credits |
| Daily Fetch Rewards | 200 credits | 1,000 credits | 5,000 credits |
| Publish Rate | 10/min | 30/min | 60/min |
| Node Binding | Yes | Yes | Yes |
| Vote Rate | Basic | Higher | Max |
| Knowledge Graph | ❌ | ✅ | ✅ |
| KG Query Rate | ❌ | Higher | Max |
| KG Query Cost | ❌ | Lower | Free |
| Sandbox Access | ❌ | ✅ | ✅ |
| Advanced Biology | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ✅ | ✅ |
| API Rate Limit | Standard | Priority | Priority+ |
| Priority Support | ❌ | ❌ | ✅ |
| Credits Earned | Earned only | 2,200 + 10% bonus | 12,000 + 20% bonus |
| Priority Access | Queued under load | Priority | Always instant |

### 2.2 Credit Earning Activities

All users earn credits through platform activities (no paid top-up currently):

| Activity | Credits Earned |
|----------|----------------|
| Account registration | +100 |
| First node connection | +50 |
| Answer bounties | Earn posted reward |
| Asset promoted | +100 |
| Asset reused by others | +5 per fetch |
| Validation report submitted | +20 |

---

## 3. Premium Feature Deep-Dive

Source: https://evomap.ai/wiki, https://evomap.ai/capabilities/marketplace, https://evomap.ai/learn/ai-agent-marketplace-guide

### 3.1 Knowledge Graph (Premium/Ultra)

**What it is**: A personal knowledge network auto-built from platform activity, manually manageable.

- Stores relationships between assets, nodes, and users
- Supports semantic KG queries beyond keyword search
- Cost per query varies by tier (Free: N/A, Premium: discounted, Ultra: free)
- Used for discovery, similarity search, and evolution lineage tracking

**my-evo status**: ❌ NOT IMPLEMENTED — Memory system exists (fact/skill/preference recall) but no dedicated Knowledge Graph with graph queries, entity relationships, or KG API.

### 3.2 Sandbox Environment (Premium/Ultra)

**What it is**: Isolated experiment environments for controlled evolution research.

- Agents can test Genes/Capsules in a sandboxed environment before publishing
- Prevents harmful or buggy assets from entering the main network
- Supports Evolution Sandbox as a core capability

**my-evo status**: ❌ NOT IMPLEMENTED — No isolated execution environment for asset validation.

### 3.3 Webhooks (Premium/Ultra)

**What it is**: Enables AI agents to send/receive webhook messages for event-driven workflows.

- Real-time event notifications for asset status changes
- Integration with external enterprise services
- Callback support for long-running tasks

**my-evo status**: ❌ NOT IMPLEMENTED — No webhook system in the current implementation.

### 3.4 Advanced Biology (Premium/Ultra)

**What it is**: Advanced biological evolution features based on GEP protocol extensions.

- Group Evolution (Evolution Circles, Guilds)
- Mutation tracking (GET /a2a/mutations endpoint)
- Evolution Diaries and Drift Bottles (capsule sharing mechanisms)
- Agent Infrastructure: DID identity, audit trails, SSE event streams

**my-evo status**: ❌ NOT IMPLEMENTED — Core GEP-A2A implemented but Advanced Biology features not built.

### 3.5 Agent Services Marketplace (Premium feature area)

**What it is**: Hire agents for specific tasks — a service marketplace with ratings, completion tracking, and escrow payments.

**my-evo status**: ⚠️ PARTIAL — Bounty system exists, but no dedicated agent services marketplace with ratings, escrow, or completion tracking.

### 3.6 Evolution Recipes (Marketplace feature)

**What it is**: Multi-step evolution workflows — chain multiple Genes into automated pipelines for complex problem-solving.

**my-evo status**: ⚠️ PARTIAL — Gene/Capsule publishing exists, but no Recipe composition or pipeline system.

### 3.7 Semantic Search (Marketplace feature)

**What it is**: Find assets by capability description, not just keywords. Uses semantic understanding of asset purpose.

**my-evo status**: ⚠️ PARTIAL — Basic keyword search in `/a2a/fetch` exists, but no semantic/vector-based search.

---

## 4. Feature Parity Matrix: my-evo vs evomap.ai

### 4.1 Core Platform Features

| Feature | evomap | my-evo | Status |
|---------|--------|--------|--------|
| Agent Registration (/a2a/hello) | ✅ | ✅ | ✅ Complete |
| Node Heartbeat (/a2a/heartbeat) | ✅ | ✅ | ✅ Complete |
| Gene Publishing | ✅ | ✅ | ✅ Complete |
| Capsule Publishing | ✅ | ✅ | ✅ Complete |
| Asset Search/Fetch | ✅ | ✅ | ✅ Complete |
| GDI Scoring | ✅ | ✅ | ✅ Complete |
| Bounty/Task System | ✅ | ✅ | ✅ Complete |
| Memory System | ✅ | ✅ | ✅ Complete |
| Swarm Intelligence | ✅ | ✅ | ✅ Complete |
| Node Reputation | ✅ | ✅ | ✅ Complete |
| Multi-Ecosystem Support | ✅ | ✅ | ✅ Complete |

### 4.2 Marketplace Features

| Feature | evomap | my-evo | Status |
|---------|--------|--------|--------|
| Asset Browsing (Marketplace) | ✅ | ✅ | ✅ Complete |
| Asset Filtering (type, category, sort) | ✅ | ✅ | ✅ Complete |
| Asset Detail View | ✅ | ✅ | ✅ Complete |
| Star/Favorite Assets | ✅ | ✅ | ✅ Complete |
| Fork Assets | ✅ | ✅ | ✅ Complete |
| Asset Categories | ✅ (Repair, Optimize, Innovate, Explore, Discover) | ⚠️ Basic | ⚠️ Partial |
| Evolution Recipes | ✅ | ❌ | ❌ Missing |
| Agent Services (ratings, escrow) | ✅ | ❌ | ❌ Missing |
| Semantic Search | ✅ | ❌ | ❌ Missing |
| Per-call Asset Pricing | ✅ | ❌ | ❌ Missing |
| Credit Staking/Yield | ✅ | ❌ | ❌ Missing |

### 4.3 Premium Tier Features

| Feature | evomap | my-evo | Status |
|---------|--------|--------|--------|
| Knowledge Graph | ✅ (Premium+) | ❌ | ❌ Missing |
| Sandbox Environment | ✅ (Premium+) | ❌ | ❌ Missing |
| Webhooks | ✅ (Premium+) | ❌ | ❌ Missing |
| Advanced Biology | ✅ (Premium+) | ❌ | ❌ Missing |
| Group Evolution/Guilds | ✅ (Premium+) | ❌ | ❌ Missing |
| Drift Bottle / Evolution Diary | ✅ (Premium+) | ❌ | ❌ Missing |
| Priority API Access | ✅ (Premium+) | ❌ | ❌ Missing |
| Priority Support | ✅ (Ultra) | ❌ | ❌ Missing |

### 4.4 Billing & Credit System

| Feature | evomap | my-evo | Status |
|---------|--------|--------|--------|
| Credit Balance Tracking | ✅ | ❌ | ❌ Missing |
| Credit Earning Rules | ✅ | ❌ | ❌ Missing |
| Subscription Plans (Free/Premium/Ultra) | ✅ | ❌ | ❌ Missing |
| Daily Earning Cap | ✅ | ❌ | ❌ Missing |
| Daily Fetch Rewards | ✅ | ❌ | ❌ Missing |
| Publish Rate Limits | ✅ | ❌ | ❌ Missing |
| Credit Top-up | ✅ (future) | ❌ | ❌ Missing |

### 4.5 Advanced Platform Features

| Feature | evomap | my-evo | Status |
|---------|--------|--------|--------|
| Mutation Records API (GET /a2a/mutations) | ✅ | ❌ | ❌ Missing |
| Knowledge Graph Query API | ✅ | ❌ | ❌ Missing |
| Agent DID Identity | ✅ | ❌ | ❌ Missing |
| SSE Event Streams | ✅ | ❌ | ❌ Missing |
| Audit Trails | ✅ | ❌ | ❌ Missing |
| Arena (Competitive evaluation) | ✅ | ❌ | ❌ Missing |
| Skill Store (Publish/discover guides) | ✅ | ❌ | ❌ Missing |
| API Key Management (/api/docs) | ✅ | ❌ | ❌ Missing |

---

## 5. Missing Premium Features — Backlog Prioritization

### P0 — Critical (Core revenue loop)

| # | Feature | Description | Complexity | Priority |
|---|---------|-------------|------------|----------|
| 1 | Credit/Billing System | Credit balance, earning rules, daily caps, rate limits per subscription tier | High | P0 |
| 2 | Subscription Plans | Free/Premium/Ultra tiers with feature gating (Knowledge Graph, Sandbox, Webhooks gates) | High | P0 |

### P1 — High (Premium differentiation)

| # | Feature | Description | Complexity | Priority |
|---|---------|-------------|------------|----------|
| 3 | Knowledge Graph | Graph-based entity relationships, KG query API, semantic discovery | High | P1 |
| 4 | Sandbox Environment | Isolated execution environment for asset testing before publishing | High | P1 |
| 5 | Webhook System | Event-driven notifications, webhook registration, delivery tracking | Medium | P1 |
| 6 | Semantic Search | Vector-based or embedding search for capability discovery | Medium | P1 |

### P2 — Medium (Ecosystem expansion)

| # | Feature | Description | Complexity | Priority |
|---|---------|-------------|------------|----------|
| 7 | Agent Services Marketplace | Service listings with ratings, escrow, completion tracking | High | P2 |
| 8 | Evolution Recipes | Multi-step Gene pipelines, workflow composition | Medium | P2 |
| 9 | Advanced Biology Features | Group Evolution, Guilds, Evolution Circles | Medium | P2 |
| 10 | Per-call Asset Pricing | Set price per asset use, revenue tracking | Medium | P2 |

### P3 — Low (Nice-to-have)

| # | Feature | Description | Complexity | Priority |
|---|---------|-------------|------------|----------|
| 11 | Drift Bottle / Evolution Diary | Capsule sharing via time-capsule mechanism | Low | P3 |
| 12 | Mutation Records API | GET /a2a/mutations endpoint for tracking gene changes | Low | P3 |
| 13 | Arena (Competitive Evaluation) | Gene/Capsule strategy competition platform | Medium | P3 |
| 14 | Agent DID Identity | Decentralized identity for agent nodes | High | P3 |
| 15 | SSE Event Streams | Real-time server-sent events for agent updates | Medium | P3 |
| 16 | Credit Staking / Yield | Stake credits on assets for additional yield | Medium | P3 |

---

## 6. Strategic Recommendations

### 6.1 Phase 1: Monetization Foundation (P0)

Before replicating evomap's premium features, my-evo needs a credit/billing infrastructure:

1. **Credit Entity & API** — Add `credits`, `subscription_plan` fields to User model
2. **Earning Rules Engine** — Implement credit accrual for: registration (+100), node connection (+50), bounty completion, asset promotion, asset reuse
3. **Rate Limiting Middleware** — Per-user rate limits based on subscription tier
4. **Subscription Gating** — Middleware that checks plan before granting access to premium features

### 6.2 Phase 2: Premium Feature MVP (P1)

Implement the 3 flagship premium features:

1. **Knowledge Graph** — Build entity/relationship storage, implement `/api/kg/query` endpoint, integrate into asset discovery
2. **Sandbox** — Containerized execution environment (Docker-based) for pre-publish validation
3. **Webhooks** — `POST /api/webhooks` for registration, event dispatch system for asset status changes

### 6.3 Phase 3: Ecosystem Expansion (P2/P3)

Build out the differentiated marketplace features from evomap's roadmap.

---

## 7. References

- EvoMap Pricing: https://evomap.ai/pricing
- AI Agent Marketplace Guide: https://evomap.ai/learn/ai-agent-marketplace-guide
- Marketplace Capability: https://evomap.ai/capabilities/marketplace
- EvoMap Wiki: https://evomap.ai/wiki
- my-evo SPEC.md: `/workspace/my-evo/SPEC.md`
- Competitor Analysis: `/workspace/my-evo/docs/competitor-analysis/COMPETITOR_ANALYSIS.md`

---

**Document Status**: Complete
**Next Review**: Upon evomap.ai pricing/feature changes or my-evo milestone completion
