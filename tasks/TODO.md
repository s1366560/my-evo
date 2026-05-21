# My-Evo Implementation Todo List

## Meta
- **Generated**: 2025-04-27
- **Objective**: Complete EvoMap clone feature parity, architecture docs, full-stack implementation
- **Workspace**: /workspace/my-evo

---

## P0 CRITICAL TASKS

### [TODO] TASK_P0_01: Asset Purchase Flow
- **Worker Type**: frontend-dev
- **Priority**: CRITICAL
- **Description**: Implement complete asset purchase flow - shopping cart with add/remove/quantity, checkout with credit validation, transaction confirmation with receipt, purchase history in dashboard
- **Files**: 
  - `frontend/src/components/CartDrawer.tsx`
  - `frontend/src/app/checkout/page.tsx`
  - `frontend/src/app/dashboard/purchases/page.tsx`
- **Acceptance Criteria**:
  - Shopping cart with add/remove/update quantity
  - Checkout flow with credit balance validation
  - Transaction confirmation and receipt
  - Purchase history in dashboard
- **Dependencies**: Backend credits endpoint `POST /api/credits/deduct`, Assets endpoint `GET /api/assets/:id`

### [TODO] TASK_P0_02: Bounty Task Frontend
- **Worker Type**: frontend-dev
- **Priority**: CRITICAL
- **Description**: Build bounty system UI - bounty list with filters, detail page with submission form, submission tracking, reward distribution
- **Files**:
  - `frontend/src/app/bounty/page.tsx`
  - `frontend/src/app/bounty/[id]/page.tsx`
  - `frontend/src/app/bounty/submit/page.tsx`
- **Acceptance Criteria**:
  - Bounty list page with filters (category, reward range, status)
  - Bounty detail page with requirements and submission form
  - Submission tracking and status updates
  - Reward distribution UI
- **Dependencies**: Backend bounty service `/api/bounty/*`

### [TODO] TASK_P0_03: Asset Publishing UI
- **Worker Type**: frontend-dev
- **Priority**: CRITICAL
- **Description**: Create multi-step asset creation wizard for Gene/Capsule/Recipe with code editor, preview and validation
- **Files**:
  - `frontend/src/app/publish/page.tsx`
  - `frontend/src/components/AssetEditor/`
  - `frontend/src/components/ValidationPanel/`
- **Acceptance Criteria**:
  - Multi-step asset creation wizard (Gene/Capsule/Recipe)
  - Code/content editor with syntax highlighting
  - Preview and validation before publish
  - Draft management
- **Dependencies**: Backend assets service `POST /api/assets`, Anti-hallucination service `POST /api/validate`

### [TODO] TASK_P0_04: Checkout/Payment Integration
- **Worker Type**: backend-dev
- **Priority**: CRITICAL
- **Description**: Implement payment processing with atomic credit deduction, transaction recording, refund handling, receipt generation
- **Files**:
  - `packages/state/src/services/billing/checkout.ts`
  - `packages/state/src/services/credits/transaction.ts`
- **Acceptance Criteria**:
  - Atomic credit deduction with transaction logging
  - Payment confirmation flow
  - Refund handling
  - Invoice/receipt generation
- **Dependencies**: Credits service, Assets service

---

## P1 HIGH PRIORITY TASKS

### [TODO] TASK_P1_01: Asset Detail Page Enhancements
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Description**: Enhance asset detail page with reviews, ratings, version history, download options, related assets
- **Files**: `frontend/src/app/browse/[assetId]/page.tsx`
- **Acceptance Criteria**:
  - User reviews and ratings system
  - Version history viewer
  - Download asset content button
  - Related assets recommendations

### [TODO] TASK_P1_02: Recipe Composer
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Description**: Visual workflow builder for composing multi-step recipes with drag-drop interface
- **Files**: `frontend/src/app/recipe/composer/page.tsx`
- **Acceptance Criteria**:
  - Visual workflow canvas with drag-drop
  - Gene/capsule node connection
  - Step ordering and configuration
  - Save and publish recipe

### [TODO] TASK_P1_07: Notifications System
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Description**: Build notification center with real-time alerts via WebSocket, notification preferences
- **Files**:
  - `frontend/src/components/NotificationCenter/`
  - `frontend/src/hooks/useNotifications.ts`
- **Acceptance Criteria**:
  - Notification bell with badge count
  - Real-time notifications via WebSocket
  - Notification preferences settings
  - Mark as read/archived

### [TODO] TASK_P1_08: Agent Profile Pages
- **Worker Type**: frontend-dev
- **Priority**: HIGH
- **Description**: Create public agent/node profiles with stats, assets portfolio, reputation history
- **Files**: `frontend/src/app/agent/[nodeId]/page.tsx`
- **Acceptance Criteria**:
  - Public profile page with avatar and bio
  - Assets portfolio listing
  - Reputation and rating display
  - Activity history

### [TODO] TASK_P1_04: Circle/Community Pages
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Description**: Interest circles with topic threads and discussions
- **Files**:
  - `frontend/src/app/circle/page.tsx`
  - `frontend/src/app/circle/[id]/page.tsx`
- **Acceptance Criteria**:
  - Circle discovery/browse page
  - Circle detail with threads
  - Thread creation and replies
  - Circle membership management

### [TODO] TASK_P1_05: Subscription Plans UI
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Description**: Plan comparison, upgrade/downgrade flow, billing management
- **Files**:
  - `frontend/src/app/subscription/page.tsx`
  - `frontend/src/app/settings/billing/page.tsx`
- **Acceptance Criteria**:
  - Plan comparison table (Free/Premium/Ultra)
  - Upgrade/downgrade flow
  - Payment method management
  - Billing history

### [TODO] TASK_P1_06: Drift Bottle UI
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Description**: Anonymous async messaging - throw, pick, reply to bottles
- **Files**: `frontend/src/app/driftbottle/page.tsx`
- **Acceptance Criteria**:
  - Throw new bottle with message
  - Pick random bottle
  - Reply to picked bottle
  - Bottle history

### [TODO] TASK_P1_03: Guild System
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Description**: Guild discovery, joining, management, member profiles and roles
- **Files**:
  - `frontend/src/app/guild/page.tsx`
  - `frontend/src/app/guild/[id]/page.tsx`
- **Acceptance Criteria**:
  - Guild discovery/browse page
  - Guild detail with members
  - Join/leave guild
  - Guild roles and permissions

### [TODO] TASK_P1_09: Skill Marketplace Install Flow
- **Worker Type**: frontend-dev
- **Priority**: MEDIUM
- **Description**: Skill discovery with install/use flow, installed skills management
- **Files**:
  - `frontend/src/app/skills/page.tsx`
  - `frontend/src/components/SkillInstallButton/`
- **Acceptance Criteria**:
  - Skill browser with categories
  - One-click install
  - Installed skills dashboard
  - Skill usage analytics

---

## P2 POLISH TASKS

### [TODO] TASK_P2_01: Watchlist/Favorites
- **Worker Type**: frontend-dev
- **Priority**: LOW
- **Description**: Save/bookmark assets to personal collection, share collections
- **Acceptance Criteria**: Save assets, view saved collection, manage list

### [TODO] TASK_P2_02: User Settings Enhancements
- **Worker Type**: frontend-dev
- **Priority**: LOW
- **Description**: Preferences, integrations, API keys management, privacy settings
- **Acceptance Criteria**: Full settings dashboard, API key generation, integration OAuth flows

### [TODO] TASK_P2_03: i18n Support
- **Worker Type**: frontend-dev
- **Priority**: LOW
- **Description**: Add internationalization with language switcher, Chinese translation
- **Acceptance Criteria**: Language switcher, Chinese translations, RTL support ready

### [TODO] TASK_P2_04: Email Notifications
- **Worker Type**: backend-dev
- **Priority**: LOW
- **Description**: Email templates for purchases, comments, mentions, digest emails
- **Acceptance Criteria**: Email templates, sendgrid/resend integration, unsubscribe

### [TODO] TASK_P2_05: Analytics Dashboard
- **Worker Type**: frontend-dev
- **Priority**: LOW
- **Description**: Detailed analytics views, charts, metrics, export functionality
- **Acceptance Criteria**: Charts library integration, export to CSV/PDF

---

## DOCUMENTATION TASKS

### [TODO] TASK_DOC_01: Update API Documentation
- **Worker Type**: documentation
- **Priority**: HIGH
- **Description**: Generate current API docs from OpenAPI spec, document all endpoints with examples
- **Files**: `docs/api/`, `frontend/public/docs/`
- **Acceptance Criteria**: Complete API reference with examples for all endpoints

### [TODO] TASK_DOC_02: Component Library Documentation
- **Worker Type**: documentation
- **Priority**: MEDIUM
- **Description**: Document reusable components with props, usage examples
- **Files**: `frontend/src/components/.mdx`
- **Acceptance Criteria**: Storybook-style docs for all shared components

### [TODO] TASK_DOC_03: Deployment/Ops Documentation
- **Worker Type**: documentation
- **Priority**: MEDIUM
- **Description**: Docker setup, environment variables, CI/CD pipeline, monitoring
- **Files**: `docs/deployment/`
- **Acceptance Criteria**: Complete ops guide for deployment and maintenance

### [TODO] TASK_DOC_04: Testing Strategy Document
- **Worker Type**: documentation
- **Priority**: MEDIUM
- **Description**: Testing pyramid, coverage goals, CI/CD integration, E2E tests
- **Files**: `docs/testing/`
- **Acceptance Criteria**: Clear testing strategy document with implementation guidelines

---

## Dispatch Queue

| Task ID | Status | Worker |
|---------|--------|--------|
| TASK_P0_01 | QUEUED | frontend-dev |
| TASK_P0_02 | QUEUED | frontend-dev |
| TASK_P0_03 | QUEUED | frontend-dev |
| TASK_P0_04 | QUEUED | backend-dev |
| TASK_P1_01 | QUEUED | frontend-dev |
| TASK_P1_02 | QUEUED | frontend-dev |
| TASK_P1_03 | QUEUED | frontend-dev |
| TASK_P1_04 | QUEUED | frontend-dev |
| TASK_P1_05 | QUEUED | frontend-dev |
| TASK_P1_06 | QUEUED | frontend-dev |
| TASK_P1_07 | QUEUED | frontend-dev |
| TASK_P1_08 | QUEUED | frontend-dev |
| TASK_P1_09 | QUEUED | frontend-dev |
| TASK_P2_01 | QUEUED | frontend-dev |
| TASK_P2_02 | QUEUED | frontend-dev |
| TASK_P2_03 | QUEUED | frontend-dev |
| TASK_P2_04 | QUEUED | backend-dev |
| TASK_P2_05 | QUEUED | frontend-dev |
| TASK_DOC_01 | QUEUED | documentation |
| TASK_DOC_02 | QUEUED | documentation |
| TASK_DOC_03 | QUEUED | documentation |
| TASK_DOC_04 | QUEUED | documentation |
