# Remaining Features Analysis — 8% Gap Prioritization

**Project**: My Evo (evomap.ai Clone)
**Analysis Date**: 2026-05-08
**Status**: 92% Complete (8% remaining)
**Purpose**: Ranked list of unimplemented features by user impact and implementation complexity

---

## Executive Summary

| Priority | Features | User Impact | Complexity | Effort |
|----------|----------|-------------|------------|--------|
| P1 | GDI Score Preview, Account Settings | High | Medium | 3-5 days |
| P2 | AI Bounty Matching, Real-time Updates | High | High | 5-7 days |
| P3 | Capsule Hot List, Advanced Physics | Medium | Medium | 3-5 days |
| P4 | WebGL Rendering, Node Clustering | Low | High | 1+ weeks |

---

## Priority 1 (High Impact, Medium Complexity)

### 1. Real-time GDI Score Preview for Publish
**Status**: Partial implementation
**Gap**: Publish page has forms but no real-time GDI score preview
**User Impact**: High — Users can't validate quality before publishing
**Complexity**: Medium
**Implementation Files**:
- `frontend/src/app/publish/page.tsx` — Add live scoring preview
- `backend/src/services/gdiScoringService.ts` — Expose preview endpoint
**Effort**: 2-3 days
**Acceptance Criteria**:
- [ ] Display estimated GDI score as user types
- [ ] Show breakdown (Correctness, Diversity, Composability, Helpfulness)
- [ ] Visual indicator (red/yellow/green) based on score

---

### 2. Account Settings — Advanced Features
**Status**: Partial (basic profile only)
**Gap**: Missing API key management, integrations, notifications
**User Impact**: High — Power users need these for production use
**Complexity**: Medium
**Implementation Files**:
- `frontend/src/app/account/page.tsx` — Extend with tabs
- `frontend/src/components/account/` — New components
- `backend/src/routes/account.ts` — New endpoints
**Effort**: 3-5 days
**Sub-tasks**:
| Feature | Status | Notes |
|---------|--------|-------|
| API Key Display | ❌ | Show masked key with reveal button |
| API Key Regenerate | ❌ | Generate new key with confirmation |
| Integration Settings | ❌ | Webhook URLs, external connections |
| Notification Preferences | ❌ | Email, in-app toggle per event type |

---

## Priority 2 (High Impact, High Complexity)

### 3. AI Bounty Matching/Recommendation
**Status**: Not implemented
**Gap**: Bounty board shows all tasks, no intelligent matching
**User Impact**: High — Core value proposition for bounty hunters
**Complexity**: High (requires ML/recommendation system)
**Implementation Files**:
- `backend/src/services/bountyMatchingService.ts` — New service
- `frontend/src/app/bounty/page.tsx` — Add "Recommended for You" section
- `backend/src/models/schemas.ts` — Bounty matching schema
**Effort**: 5-7 days
**Algorithm Approach**:
1. User skill tags + historical completion → skill vector
2. Bounty requirements → requirement vector
3. Cosine similarity scoring
4. Filter by: skill match > 70%, difficulty, deadline

---

### 4. Real-time Data in Marketplace
**Status**: Mock data currently
**Gap**: No live updates from backend
**User Impact**: High — Users see stale data
**Complexity**: High (WebSocket/SSE required)
**Implementation Files**:
- `backend/src/routes/marketplace.ts` — Add WebSocket endpoint
- `frontend/src/hooks/useMarketplaceSocket.ts` — New hook
- `frontend/src/app/marketplace/page.tsx` — Real-time updates
**Effort**: 4-5 days

---

## Priority 3 (Medium Impact, Medium Complexity)

### 5. Capsule Hot List Carousel (Landing Page)
**Status**: Not implemented
**Gap**: EvoMap has featured capsules, our landing page doesn't
**User Impact**: Medium — Misses discovery/opportunity
**Complexity**: Medium
**Implementation Files**:
- `frontend/src/components/landing/HotListCarousel.tsx` — New component
- `frontend/src/app/page.tsx` — Integrate carousel
- `backend/src/routes/assets.ts` — Top-rated endpoint
**Effort**: 2-3 days
**Design**: Horizontal scrollable cards with capsule previews

---

### 6. Advanced Physics Parameters (Map)
**Status**: Basic parameters only
**Gap**: No fine-tuned force simulation controls
**User Impact**: Medium — Power users want customization
**Complexity**: Medium
**Implementation Files**:
- `frontend/src/components/map/DataConfigPanel.tsx` — Add sliders
- `frontend/src/app/map/page.tsx` — Pass params to force simulation
**Parameters to Add**:
| Parameter | Range | Default |
|-----------|-------|---------|
| Link Distance | 30-200 | 100 |
| Charge Strength | -500 to -50 | -200 |
| Center Force | 0-1 | 0.1 |
| Collision Radius | 5-50 | 20 |

---

## Priority 4 (Low Impact, High Complexity)

### 7. WebGL Rendering for Large Maps
**Status**: Canvas 2D (sufficient for <500 nodes)
**Gap**: Performance degrades with 1000+ nodes
**User Impact**: Low — Most users have <500 nodes
**Complexity**: High (WebGL/Three.js)
**Implementation Files**:
- `frontend/src/components/map/MapCanvasWebGL.tsx` — New component
- `frontend/src/app/map/page.tsx` — Toggle between Canvas/WebGL
**Effort**: 1+ weeks
**Decision**: Defer unless performance issues reported

---

### 8. Node Clustering/Grouping
**Status**: Not implemented
**Gap**: No visual grouping of related nodes
**User Impact**: Low — Nice-to-have visualization
**Complexity**: High (clustering algorithms)
**Implementation Files**:
- `frontend/src/utils/clustering.ts` — Clustering algorithms
- `frontend/src/components/map/MapCanvas.tsx` — Render clusters
**Effort**: 5-7 days
**Decision**: Defer to v2

---

## Complete Gap Matrix

| # | Feature | Page | Priority | Impact | Complexity | Effort | Status |
|---|---------|------|----------|--------|------------|--------|--------|
| 1 | GDI Score Preview | /publish | P1 | High | Medium | 2-3d | ❌ |
| 2 | Account Settings (API, Integrations) | /account | P1 | High | Medium | 3-5d | ❌ |
| 3 | AI Bounty Matching | /bounty | P2 | High | High | 5-7d | ❌ |
| 4 | Real-time Marketplace | /marketplace | P2 | High | High | 4-5d | ❌ |
| 5 | Capsule Hot List | / (landing) | P3 | Medium | Medium | 2-3d | ❌ |
| 6 | Advanced Physics | /map | P3 | Medium | Medium | 2-3d | ❌ |
| 7 | WebGL Rendering | /map | P4 | Low | High | 1+w | ❌ |
| 8 | Node Clustering | /map | P4 | Low | High | 5-7d | ❌ |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 weeks)
1. **GDI Score Preview** — Immediate user value, validates publish quality
2. **Account Settings (API Keys)** — Power user requirement
3. **Capsule Hot List** — Visual polish, low effort

### Phase 2: Core Features (2-3 weeks)
4. **Account Settings (Full)** — Integrations, notifications
5. **Advanced Physics** — Map customization
6. **Real-time Marketplace** — Data freshness

### Phase 3: Advanced Features (4-6 weeks)
7. **AI Bounty Matching** — Core differentiator
8. **WebGL Rendering** — Only if needed
9. **Node Clustering** — Nice-to-have

---

## Verification Commands

```bash
# Check current parity
cd /workspace/my-evo && npm run lint
cd /workspace/my-evo/backend && npm test

# E2E test coverage
node e2e-comprehensive.js

# Build verification
cd /workspace/my-evo/frontend && npm run build
```

---

**Document Status**: Analysis Complete
**Analysis By**: Workspace Builder Agent
**Last Updated**: 2026-05-08
