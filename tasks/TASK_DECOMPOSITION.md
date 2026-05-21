# My-Evo Implementation Task Decomposition

Generated: 2025-04-27
Objective: Complete EvoMap clone feature parity and architecture documentation

## Phase 1: MVP Completion (P0) - Critical

### Task 1.1: Asset Purchase Flow
- **Worker Type**: frontend-dev
- **Description**: Implement complete asset purchase flow - cart, checkout, transaction confirmation
- **Files**: `frontend/src/app/marketplace/`, `frontend/src/components/Cart*`
- **Dependencies**: [Credits Service, Assets Service]
- **Acceptance**: User can browse assets, add to cart, complete purchase, see transaction in credits

### Task 1.2: Bounty Task Frontend  
- **Worker Type**: frontend-dev
- **Description**: Build bounty system UI - list page, detail page, submission flow, reward tracking
- **Files**: `frontend/src/app/bounty/`, `frontend/src/app/bounty/[id]/`
- **Dependencies**: [Bounty Service]
- **Acceptance**: Users can list bounties, view details, submit solutions, view rewards

### Task 1.3: Asset Publishing UI
- **Worker Type**: frontend-dev
- **Description**: Create gene/capsule/recipe editor and publisher UI with validation
- **Files**: `frontend/src/app/publish/`, `frontend/src/app/create/`
- **Dependencies**: [Assets Service, Anti-Hallucination Service]
- **Acceptance**: Authors can create, validate, preview and publish new assets

### Task 1.4: Checkout/Payment Integration
- **Worker Type**: backend-dev
- **Description**: Implement payment processing, transaction recording, credit deduction
- **Files**: `packages/state/src/services/billing/`, `packages/state/src/services/credits/`
- **Dependencies**: [Credits Service, Assets Service]
- **Acceptance**: Credits deducted atomically, transactions logged, receipts generated

---

## Phase 2: Core Experience (P1) - Important

### Task 2.1: Asset Detail Page Enhancements
- **Worker Type**: frontend-dev
- **Description**: Add reviews/ratings, version history, download options, related assets
- **Files**: `frontend/src/app/browse/[assetId]/`
- **Dependencies**: [Assets Service]
- **Acceptance**: Users can read reviews, view version history, download asset content

### Task 2.2: Recipe Composer
- **Worker Type**: frontend-dev
- **Description**: Visual workflow builder for composing multi-step recipes with drag-drop
- **Files**: `frontend/src/app/recipe/composer/`
- **Dependencies**: [Recipe Service]
- **Acceptance**: Users can visually compose recipes by connecting genes/capsules

### Task 2.3: Guild System
- **Worker Type**: frontend-dev
- **Description**: Guild discovery, joining, management, member profiles
- **Files**: `frontend/src/app/guild/`, `frontend/src/app/guild/[id]/`
- **Dependencies**: [Community Service]
- **Acceptance**: Users can discover, join, create guilds with roles and permissions

### Task 2.4: Circle/Community Pages
- **Worker Type**: frontend-dev
- **Description**: Interest circles with topics, threads, discussions
- **Files**: `frontend/src/app/circle/`, `frontend/src/app/circle/[id]/`
- **Dependencies**: [Circle Service]
- **Acceptance**: Users can browse circles, join discussions, create threads

### Task 2.5: Subscription Plans UI
- **Worker Type**: frontend-dev
- **Description**: Plan comparison, upgrade/downgrade flow, billing management
- **Files**: `frontend/src/app/subscription/`, `frontend/src/app/settings/billing/`
- **Dependencies**: [Subscription Service, Billing Service]
- **Acceptance**: Users can view plans, upgrade/downgrade, manage billing info

### Task 2.6: Drift Bottle UI
- **Worker Type**: frontend-dev
- **Description**: Anonymous async messaging - throw, pick, reply to bottles
- **Files**: `frontend/src/app/driftbottle/`
- **Dependencies**: [DriftBottle Service]
- **Acceptance**: Users can throw bottles with messages, pick random bottles, reply

### Task 2.7: Notifications System
- **Worker Type**: frontend-dev + backend-dev
- **Description**: Notification center, real-time alerts via WebSocket, notification preferences
- **Files**: `frontend/src/components/NotificationCenter/`, `packages/state/src/services/notifications/`
- **Dependencies**: [Session Service]
- **Acceptance**: Users receive real-time notifications for purchases, comments, mentions

### Task 2.8: Agent Profile Pages
- **Worker Type**: frontend-dev
- **Description**: Public agent/node profiles with stats, assets, reputation history
- **Files**: `frontend/src/app/agent/[nodeId]/`
- **Dependencies**: [Account Service, Reputation Service, Assets Service]
- **Acceptance**: Anyone can view agent public profiles with portfolio and ratings

---

## Phase 3: Polish (P2) - Nice-to-Have

### Task 3.1: Watchlist/Favorites
- **Worker Type**: frontend-dev
- **Description**: Save/bookmark assets to personal collection, share collections
- **Files**: `frontend/src/app/saved/`, `frontend/src/components/WatchlistButton/`
- **Dependencies**: [Assets Service]
- **Acceptance**: Users can save assets, view saved collection, manage list

### Task 3.2: User Settings Enhancements
- **Worker Type**: frontend-dev
- **Description**: Preferences, integrations, API keys management, privacy settings
- **Files**: `frontend/src/app/settings/`
- **Dependencies**: [Session Service, Subscription Service]
- **Acceptance**: Users can manage all account preferences from settings dashboard

### Task 3.3: i18n Support
- **Worker Type**: frontend-dev
- **Description**: Add internationalization with language switcher, Chinese translation
- **Files**: `frontend/src/i18n/`, `frontend/src/locales/`
- **Dependencies**: [None]
- **Acceptance**: UI available in multiple languages with easy switching

### Task 3.4: Email Notifications
- **Worker Type**: backend-dev
- **Description**: Email templates for purchases, comments, mentions, digest emails
- **Files**: `packages/state/src/services/notifications/email/`
- **Dependencies**: [Notification System]
- **Acceptance**: Users receive timely email notifications with unsubscribe option

### Task 3.5: Analytics Dashboard
- **Worker Type**: frontend-dev
- **Description**: Detailed analytics views, charts, metrics, export functionality
- **Files**: `frontend/src/app/analytics/`
- **Dependencies**: [Analytics Service]
- **Acceptance**: Admin can view comprehensive platform analytics with visualizations

---

## Documentation Tasks

### Task D1: Update API Documentation
- **Worker Type**: documentation
- **Description**: Generate current API docs from OpenAPI spec, document all endpoints
- **Files**: `docs/api/`, `frontend/public/docs/`
- **Dependencies**: [None]
- **Acceptance**: Complete API reference with examples for all endpoints

### Task D2: Component Library Documentation
- **Worker Type**: documentation
- **Description**: Document reusable components with props, usage examples
- **Files**: `frontend/src/components/.mdx`
- **Dependencies**: [None]
- **Acceptance**: Storybook-style docs for all shared components

### Task D3: Deployment/Ops Documentation
- **Worker Type**: documentation
- **Description**: Docker setup, environment variables, CI/CD pipeline, monitoring
- **Files**: `docs/deployment/`
- **Dependencies**: [None]
- **Acceptance**: Complete ops guide for deployment and maintenance

### Task D4: Testing Strategy Document
- **Worker Type**: documentation
- **Description**: Testing pyramid, coverage goals, CI/CD integration, E2E tests
- **Files**: `docs/testing/`
- **Dependencies**: [None]
- **Acceptance**: Clear testing strategy document with implementation guidelines

---

## Task Queue Priority Order

1. **Task 1.1** - Asset Purchase Flow (P0 - Critical)
2. **Task 1.2** - Bounty Task Frontend (P0 - Critical)
3. **Task 1.3** - Asset Publishing UI (P0 - Critical)
4. **Task 1.4** - Checkout/Payment Integration (P0 - Critical)
5. **Task D1** - Update API Documentation (High Priority)
6. **Task 2.1** - Asset Detail Page Enhancements (P1)
7. **Task 2.8** - Agent Profile Pages (P1)
8. **Task 2.7** - Notifications System (P1)
9. **Task 2.4** - Circle/Community Pages (P1)
10. **Task 2.5** - Subscription Plans UI (P1)
11. **Task 2.6** - Drift Bottle UI (P1)
12. **Task 2.3** - Guild System (P1)
13. **Task 2.2** - Recipe Composer (P1)
14. **Task 2.9** - Skill Marketplace Install Flow (P1)
15. **Task 3.1** - Watchlist/Favorites (P2)
16. **Task 3.2** - User Settings Enhancements (P2)
17. **Task D2** - Component Library Documentation (Medium)
18. **Task D3** - Deployment/Ops Documentation (Medium)
19. **Task D4** - Testing Strategy Document (Medium)
20. **Task 3.3** - i18n Support (P2)
21. **Task 3.4** - Email Notifications (P2)
22. **Task 3.5** - Analytics Dashboard (P2)

---

## Worker Assignment Recommendations

| Worker Pool | Assigned Tasks |
|-------------|----------------|
| frontend-dev | 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 3.1, 3.2, 3.3, 3.5, D2 |
| backend-dev | 1.4, 2.7, 3.4 |
| documentation | D1, D2, D3, D4 |
