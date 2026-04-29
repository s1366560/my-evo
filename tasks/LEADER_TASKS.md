# My-Evo Leader Task Decomposition

**Generated**: 2026-04-27
**Objective**: Replicate evomap.ai, complete architecture docs, full-stack development

---

## CHILD TASK 1: Architecture Codemaps
- **Task ID**: CHILD_001
- **Worker**: documentation (HIGH)
- **Deliverables**: docs/CODEMAPS/{INDEX,backend,frontend,database,integrations}.md
- **Acceptance**: All 51 src/ modules documented, API endpoints listed, diagrams accurate

## CHILD TASK 2: Asset Purchase Flow (P0)
- **Task ID**: CHILD_002
- **Worker**: frontend-dev (CRITICAL)
- **Deliverables**: CartDrawer.tsx, checkout/page.tsx, purchases/page.tsx
- **Acceptance**: Browse→Cart→Checkout→Purchase History flow complete

## CHILD TASK 3: Bounty Task Frontend (P0)
- **Task ID**: CHILD_003
- **Worker**: frontend-dev (CRITICAL)
- **Deliverables**: bounty/page.tsx, bounty/[id]/page.tsx, bounty/submit/page.tsx
- **Acceptance**: List→Detail→Submit→Track flow complete

## CHILD TASK 4: Asset Publishing UI (P0)
- **Task ID**: CHILD_004
- **Worker**: frontend-dev (CRITICAL)
- **Deliverables**: publish/page.tsx, AssetEditor/, ValidationPanel/
- **Acceptance**: Gene/Capsule/Recipe wizard with validation

## CHILD TASK 5: Checkout/Payment Backend (P0)
- **Task ID**: CHILD_005
- **Worker**: backend-dev (CRITICAL)
- **Deliverables**: billing/routes.ts, credits routes, atomic transactions
- **Acceptance**: Credits deducted atomically, receipts generated

## CHILD TASK 6: Recipe Composer (P1)
- **Task ID**: CHILD_006
- **Worker**: frontend-dev (HIGH)
- **Deliverables**: recipe/composer/page.tsx, WorkflowCanvas, GeneNode, CapsuleNode
- **Acceptance**: Drag-drop visual composer works

## CHILD TASK 7: Notifications System (P1)
- **Task ID**: CHILD_007
- **Worker**: frontend-dev (HIGH)
- **Deliverables**: NotificationCenter/, useNotifications.ts, preferences page
- **Acceptance**: Real-time WebSocket notifications

## CHILD TASK 8: Agent Profile Pages (P1)
- **Task ID**: CHILD_008
- **Worker**: frontend-dev (HIGH)
- **Deliverables**: agent/[nodeId]/page.tsx
- **Acceptance**: Public profile with stats, assets, reputation

## CHILD TASK 9: Subscription Plans UI (P1)
- **Task ID**: CHILD_009
- **Worker**: frontend-dev (MEDIUM)
- **Deliverables**: subscription/page.tsx, settings/billing/page.tsx
- **Acceptance**: Plan comparison, upgrade/downgrade

## CHILD TASK 10: Guild System (P1)
- **Task ID**: CHILD_010
- **Worker**: frontend-dev (MEDIUM)
- **Deliverables**: guild/page.tsx, guild/[id]/page.tsx
- **Acceptance**: Discovery, join/leave, roles

## CHILD TASK 11: Drift Bottle UI (P1)
- **Task ID**: CHILD_011
- **Worker**: frontend-dev (MEDIUM)
- **Deliverables**: driftbottle/page.tsx
- **Acceptance**: Throw→Pick→Reply flow

## CHILD TASK 12: Circle/Community Pages (P1)
- **Task ID**: CHILD_012
- **Worker**: frontend-dev (MEDIUM)
- **Deliverables**: circle/page.tsx, circle/[id]/page.tsx
- **Acceptance**: Circles with threads and discussions

## CHILD TASK 13-17: P2 Polish Tasks
| ID | Task | Worker | Priority |
|----|------|--------|----------|
| CHILD_013 | Watchlist/Favorites | frontend-dev | LOW |
| CHILD_014 | User Settings | frontend-dev | LOW |
| CHILD_015 | i18n Support | frontend-dev | LOW |
| CHILD_016 | Email Notifications | backend-dev | LOW |
| CHILD_017 | Analytics Dashboard | frontend-dev | LOW |

## CHILD TASK 18-21: Documentation Tasks
| ID | Task | Worker | Priority |
|----|------|--------|----------|
| CHILD_018 | API Documentation | documentation | HIGH |
| CHILD_019 | Component Library Docs | documentation | MEDIUM |
| CHILD_020 | Deployment Guide | documentation | MEDIUM |
| CHILD_021 | Testing Strategy | documentation | MEDIUM |

---

## DISPATCH QUEUE

| ID | Status | Worker | Priority |
|----|--------|--------|----------|
| CHILD_001 | QUEUED | documentation | HIGH |
| CHILD_002 | QUEUED | frontend-dev | CRITICAL |
| CHILD_003 | QUEUED | frontend-dev | CRITICAL |
| CHILD_004 | QUEUED | frontend-dev | CRITICAL |
| CHILD_005 | QUEUED | backend-dev | CRITICAL |
| CHILD_006 | QUEUED | frontend-dev | HIGH |
| CHILD_007 | QUEUED | frontend-dev | HIGH |
| CHILD_008 | QUEUED | frontend-dev | HIGH |
| CHILD_009 | QUEUED | frontend-dev | MEDIUM |
| CHILD_010 | QUEUED | frontend-dev | MEDIUM |
| CHILD_011 | QUEUED | frontend-dev | MEDIUM |
| CHILD_012 | QUEUED | frontend-dev | MEDIUM |
| CHILD_013 | QUEUED | frontend-dev | LOW |
| CHILD_014 | QUEUED | frontend-dev | LOW |
| CHILD_015 | QUEUED | frontend-dev | LOW |
| CHILD_016 | QUEUED | backend-dev | LOW |
| CHILD_017 | QUEUED | frontend-dev | LOW |
| CHILD_018 | QUEUED | documentation | HIGH |
| CHILD_019 | QUEUED | documentation | MEDIUM |
| CHILD_020 | QUEUED | documentation | MEDIUM |
| CHILD_021 | QUEUED | documentation | MEDIUM |
