# Frontend Component Inventory

**Generated:** 2026-04-29 | **TypeScript:** ✅ 0 errors | **Next.js build:** ✅ 33 routes

---

## UI Primitives (`src/components/ui/`)

| Component | File | Notes |
|---|---|---|
| Button | button.tsx | 5 variants, 4 sizes (CVA + Radix) |
| Card | card.tsx | Radix card primitives |
| Badge | badge.tsx | Status/tag badge |
| Input | input.tsx | Styled input |
| Textarea | textarea.tsx | Styled textarea |
| Select | select.tsx | Radix Select |
| Checkbox | checkbox.tsx | Radix Checkbox |
| Switch | switch.tsx | Radix Switch |
| Progress | progress.tsx | Radix Progress |
| ProgressExtended | progress-extended.tsx | Animated + label |
| ProgressVariants | progress-variants.ts | GEP scoring style |
| Tabs | tabs.tsx | Radix Tabs |
| Dialog | dialog.tsx | Radix Dialog modal |
| AlertDialog | alert-dialog.tsx | Confirmation modal |
| Sheet | sheet.tsx | Slide-in drawer |
| Avatar | avatar.tsx | Radix Avatar |
| Skeleton | skeleton.tsx | Loading placeholder |
| Tooltip | tooltip.tsx | Radix Tooltip |
| Toast/Toaster | toast.tsx, toaster.tsx | Radix Toast |
| DropdownMenu | dropdown-menu.tsx | Radix DropdownMenu |
| Table | table.tsx | HTML table wrapper |

### CSS Design Tokens

```css
--color-gene-green: #22c55e
--color-capsule-blue: #3b82f6
--color-recipe-amber: #f59e0b
--color-organism-purple: #a855f7
--color-primary (brand purple)
/* + background, foreground, card, border, muted vars */
```

---

## Layout (`src/components/layout/`)

- **NavBar** — Top nav with logo, links, auth state
- **Footer** — Site footer

---

## Landing Page (`src/components/landing/`)

HeroSection · StatsGrid · TrendingSignals · TopContributors · OpenBounties · QuickStartCTA

---

## Dashboard (`src/components/dashboard/`)

CreditsCard · ReputationCard · TrustBadge · ActivityFeed · AssetsList

---

## Editor Canvas (`src/components/editor/`)

MapCanvas (ReactFlow) · EditorToolbar · NodeEditPanel · nodes/ (GeneNode, CapsuleNode, RecipeNode, OrganismNode) · edges/GeneEdge

---

## Map Explorer (`src/components/map/`)

MapVisualization (react-force-graph-2d) · MapFilters · MapStatsBar · MapNodePanel

---

## Browse / Bounty / Scoring / Publish / Onboarding / Auth

Browse: AssetCard · BrowseContent
Bounty: BountyCard · BountyList · BountyDetail · BountyStats · BountyHallWidgets
Scoring: ScoringDashboard · ScoringHistory · ScoreCalculator
Publish: CapsulePublishForm · GenePublishForm
Onboarding: DashboardPreview · WorkerModeSetup · FirstPublish
Auth: AuthLayout · LoginForm · RegisterForm

---

## State Management — Zustand (`src/lib/stores/`)

| Store | Key state |
|---|---|
| authStore | userId, token, isAuthenticated |
| editorStore | nodes, edges, selectedNodeId, undo/redo |
| uiStore | sidebar, active modal, theme |
| notificationsStore | toast queue |
| workspaceStore | goals, tasks, workers, preflightChecks |

---

## React Query Hooks (`src/lib/api/hooks/`)

useGepSearch · useGepGene · useGepCapsule · useGepTypes · useGepPublish · useGepValidate · useGepNode · useMarketplace · useWorkspace · useGdi

---

## MSW Mock Handlers (`src/lib/api/mocks/`)

handlers · handlers-auth · handlers-bounty · handlers-credits · handlers-dashboard · handlers-gdi · handlers-marketplace · handlers-workspace

---

## 33 Routes

```
/ (landing) · /login · /register · /browse · /browse/new · /browse/trending
/browse/[assetId] · /browse/[assetId]/lineage
/bounty · /bounty-hall · /bounty/create · /bounty/[bountyId]
/dashboard · /dashboard/bounties · /dashboard/assets · /dashboard/agents
/dashboard/credits · /dashboard/onboarding
/editor · /map · /workspace
/onboarding · /publish · /profile
/arena · /biology · /council · /docs · /skills · /swarm · /workerpool
/marketplace · /claim/[code]
```

---

## API Routes (`src/app/api/v2/`)

- GET/POST `/api/v2/maps` — list/create maps
- GET/PUT/DELETE `/api/v2/maps/:id` — single map CRUD
- GET/POST `/api/v2/maps/:id/nodes` — nodes within a map
