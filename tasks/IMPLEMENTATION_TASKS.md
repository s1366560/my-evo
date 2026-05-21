# My-Evo Implementation Tasks

## Executive Summary
Objective: Complete EvoMap feature parity for my-evo project, including:
1. Frontend/backend feature development
2. Architecture documentation updates
3. Full-stack feature implementation

---

## 🚨 Phase 1: MVP Critical (P0) - Blockers

### TASK_P0_01: Asset Purchase Flow
- **Worker Type**: frontend-dev
- **Priority**: CRITICAL
- **Status**: PENDING
- **Acceptance Criteria**:
  - [ ] Shopping cart component with add/remove/update quantity
  - [ ] Checkout flow with credit balance validation
  - [ ] Transaction confirmation and receipt
  - [ ] Purchase history in dashboard
- **Files to Create/Modify**:
  - `frontend/src/components/CartDrawer.tsx`
  - `frontend/src/app/checkout/page.tsx`
  - `frontend/src/app/dashboard/purchases/page.tsx`
- **Dependencies**: 
  - Backend credits endpoint: `POST /api/credits/deduct`
  - Backend assets endpoint: `GET /api/assets/:id`

### TASK_P0_02: Bounty Task Frontend
- **Worker Type**: frontend-dev
- **Priority**: CRITICAL
- **Status**: PENDING
- **Acceptance Criteria**:
  - [ ] Bounty list page with filters (category, reward range, status)
  - [ ] Bounty detail page with requirements and submission form
  - [ ] Submission tracking and status updates
  - [ ] Reward distribution UI
- **Files to Create/Modify**:
  - `frontend/src/app/bounty/page.tsx`
  - `frontend/src/app/bounty/[id]/page.tsx`
  - `frontend/src/app/bounty/submit/page.tsx`
- **Dependencies**:
  - Backend bounty service: `/api/bounty/*`

### TASK_P0_03: Asset Publishing UI
- **Worker Type**: frontend-dev
- **Priority**: CRITICAL
- **Status**: PENDING
- **Acceptance Criteria**:
  - [ ] Multi-step asset creation wizard (Gene/Capsule/Recipe)
  - [ ] Code/content editor with syntax highlighting
  - [ ] Preview and validation before publish
  - [ ] Draft management
- **Files to Create/Modify**:
  - `frontend/src/app/publish/page.tsx`
  - `frontend/src/components/AssetEditor/`
  - `frontend/src/components/ValidationPanel/`
- **Dependencies**:
  - Backend assets service: `POST /api/assets`
  - Anti-hallucination service: `POST /api/validate`

### TASK_P0_04: Checkout/Payment Integration
- **Worker Type**: backend-dev
- **Priority**: CRITICAL
- **Status**: PENDING
- **Acceptance Criteria**:
  - [ ] Atomic credit deduction with transaction logging
  - [ ] Payment confirmation flow
  - [ ] Refund handling
  - [ ] Invoice/receipt generation
- **Files to Create/Modify**:
  - `packages/state/src/services/billing/checkout.ts`
  - `packages/state/src/services/credits/transaction.ts`
- **Dependencies**: Credits service, Assets service

---

## 📋 Phase 2: Core Experience (P1)

### TASK_P1_01: Asset Detail Page Enhancements
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Status**: PENDING
- **Acceptance Criteria**: Reviews, ratings, version history, download options

### TASK_P1_02: Recipe Composer
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Status**: PENDING
- **Acceptance Criteria**: Visual workflow builder with drag-drop gene/capsule connection

### TASK_P1_03: Guild System
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Status**: PENDING
- **Acceptance Criteria**: Guild discovery, join flow, member management

### TASK_P1_04: Circle/Community Pages
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Status**: PENDING
- **Acceptance Criteria**: Interest circles with threads and discussions

### TASK_P1_05: Subscription Plans UI
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Status**: PENDING
- **Acceptance Criteria**: Plan comparison, upgrade/downgrade, billing management

### TASK_P1_06: Drift Bottle UI
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Status**: PENDING
- **Acceptance Criteria**: Throw/pick/reply to anonymous messages

### TASK_P1_07: Notifications System
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Status**: PENDING
- **Acceptance Criteria**: Real-time notifications via WebSocket, preferences

### TASK_P1_08: Agent Profile Pages
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Status**: PENDING
- **Acceptance Criteria**: Public agent profiles with portfolio and stats

---

## 🎨 Phase 3: Polish (P2)

### TASK_P2_01: Watchlist/Favorites
- **Worker Type**: frontend-dev
- **Status**: PENDING

### TASK_P2_02: User Settings Enhancements
- **Worker Type**: frontend-dev
- **Status**: PENDING

### TASK_P2_03: i18n Support
- **Worker Type**: frontend-dev
- **Status**: PENDING

### TASK_P2_04: Email Notifications
- **Worker Type**: backend-dev
- **Status**: PENDING

### TASK_P2_05: Analytics Dashboard
- **Worker Type**: frontend-dev
- **Status**: PENDING

---

## 📚 Documentation Tasks

### TASK_DOC_01: Update API Documentation
- **Worker Type**: documentation
- **Status**: PENDING
- **Generate OpenAPI spec from current codebase**

### TASK_DOC_02: Component Library Docs
- **Worker Type**: documentation
- **Status**: PENDING

### TASK_DOC_03: Deployment Guide
- **Worker Type**: documentation
- **Status**: PENDING

### TASK_DOC_04: Testing Strategy
- **Worker Type**: documentation
- **Status**: PENDING

---

## Dispatch Log
| Task ID | Dispatched To | Status | Worker Report |
|---------|--------------|--------|---------------|
| TASK_P0_01 | frontend-dev | QUEUED | - |
| TASK_P0_02 | frontend-dev | QUEUED | - |
| TASK_P0_03 | frontend-dev | QUEUED | - |
| TASK_P0_04 | backend-dev | QUEUED | - |
| TASK_P1_* | TBD | PENDING | - |
| TASK_DOC_* | documentation | PENDING | - |
