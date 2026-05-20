# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - Sprint Plan (2026-05-20)

### Sprint 2026-W21-2 Implementation Plan

基于 docs/RESEARCH-REPORT-20260520.md 调研结果，本轮 Sprint 选取以下 2 个最高优先级功能点进行独立实现与测试：

#### Feature 1: Asset Purchase Flow (TASK_P0_01)
**优先级**: P0 (核心交易流程)
**范围**: backend `routes/purchase.ts` + frontend `src/app/purchase/`
**独立可测**: ✅ 是（前后端可独立开发，E2E 测试覆盖购物车→结账完整链路）

实现内容:
- `POST /api/v1/purchase/buy` - 购买资产，原子化扣减 credits，返回交易记录
- `GET /api/v1/purchase/history` - 用户购买历史
- `POST /api/v1/purchase/refund` - 退款接口（原子化返还 credits）
- `src/app/purchase/cart/` - 购物车页面
- `src/app/purchase/checkout/` - 结账确认页
- `frontend/tests/e2e-purchase.spec.ts` - 完整购买链路 E2E

**依赖**: Prisma `Transaction` / `CreditLog` 模型已存在于 schema.prisma

#### Feature 2: Backend Test Coverage — Map & Graph Routes
**优先级**: P1 (质量提升)
**范围**: backend `routes/map.ts` + `routes/graph.ts` + `middleware/auth.ts`
**独立可测**: ✅ 是（纯后端 Jest 测试，无需前端）

实现内容:
- `routes/map.test.ts` - 地图 CRUD 12 端点路由测试（~20 个用例）
- `routes/graph.test.ts` - 图算法 8 端点路由测试（~15 个用例）
- `middleware/auth.test.ts` - JWT 认证中间件测试（~10 个用例）

**依据**: 调研报告显示 routes/map.ts、routes/graph.ts、middleware/auth.ts 当前 0 测试覆盖，是最大盲区

#### 分支说明
- **分支名**: `workspace/node-b056ccaddc5b-fd0a066e-e2e`（已从 main 拉取）
- **Base**: `f74cba2` (Merge commit)
- **目标**: 独立实现并测试完成后，通过 PR 合并到 main

### Verification
- [ ] Backend: `cd backend && npm test` 全部通过
- [ ] Backend: `npm run build` 成功
- [ ] Frontend: `cd frontend && npm run build` 成功
- [ ] E2E: `npx playwright test` 购买链路 100% pass

### Files to Create/Modify
- `backend/src/routes/purchase.ts` (new)
- `backend/src/routes/purchase.test.ts` (new)
- `backend/src/routes/map.test.ts` (new)
- `backend/src/routes/graph.test.ts` (new)
- `backend/src/middleware/auth.test.ts` (new)
- `frontend/src/app/purchase/cart/page.tsx` (new)
- `frontend/src/app/purchase/checkout/page.tsx` (new)
- `frontend/tests/e2e-purchase.spec.ts` (new)
- `CHANGELOG.md` (本条更新)

---

## [Unreleased-old] - Sprint Plan (2026-05-19)

### Implemented (2026-05-19)

#### A2A Protocol (`src/a2a/`)
- ✅ Full implementation with 10 endpoints
- ✅ `POST /a2a/hello` - Node handshake
- ✅ `POST /a2a/heartbeat` - Heartbeat
- ✅ `POST /a2a/publish` - Publish capability (auth required)
- ✅ `POST /a2a/fetch` - Fetch node/asset
- ✅ `POST /a2a/search` - Search directory
- ✅ `POST /a2a/report` - Report status (auth required)
- ✅ `GET /a2a/directory` - List nodes
- ✅ `GET /a2a/nodes/:nodeId` - Get specific node
- ✅ `GET /a2a/billing/earnings` - Earnings (auth required)
- ✅ `GET /a2a/help` - Help info

#### Assets Module (`src/assets/`)
- ✅ Full CRUD + publish functionality
- ✅ `GET /assets` - List assets with filtering
- ✅ `GET /assets/:id` - Get asset
- ✅ `POST /assets` - Create asset (auth required)
- ✅ `PUT /assets/:id` - Update asset (auth required)
- ✅ `DELETE /assets/:id` - Delete asset (auth required)
- ✅ `POST /assets/publish` - Publish asset (auth required)
- ✅ `POST /assets/:id/fork` - Fork asset (auth required)
- ✅ `GET /assets/categories` - Asset categories

#### Search Module (`src/search/`)
- ✅ Routes for existing service
- ✅ `GET /search` - Full-text search
- ✅ `GET /search/suggestions` - Search suggestions
- ✅ `GET /search/trending` - Trending searches
- ✅ `GET /search/similar/:assetId` - Find similar assets

#### Stub Modules (33 modules created)
Created stub implementations for:
- claim, reputation, swarm, workerpool, council
- session, analytics, biology, quarantine, driftbottle
- community, circle, kg, arena, account, onboarding
- verifiable_trust, reading, sync, task, task_alias
- questions, dispute, recipe, gepx, anti_hallucination
- skill_store, constitution, docs, agent_config, model_tier
- security, project, memory_graph
- bounty (with compat-routes)

#### Bug Fixes
- Fixed `src/sandbox/queue/routes.ts` - import path from './engine' to './index'
- Fixed `src/sandbox/queue/engine.ts` - added non-null assertion for array access
- Fixed `src/sandbox/queue/index.ts` - cast handler types for generic compatibility
- Fixed `src/docs/routes.ts` - updated function signature for getWikiPageResponse

### Sprint 2026-W21 Implementation Plan

基于 gap-analysis.md (commit a9b04255e)，本轮 Sprint 选取以下 3 个最高优先级 P0 模块进行实现：

#### 1. A2A Protocol Core (`src/a2a/`)
**优先级**: P0 (核心协议)
**文件**: `src/a2a/routes.ts`, `src/a2a/service.ts`, `src/a2a/types.ts`

实现 endpoints:
- `POST /a2a/hello` - 节点握手
- `POST /a2a/heartbeat` - 心跳检测
- `POST /a2a/publish` - 发布资产/能力
- `POST /a2a/fetch` - 获取节点/资产信息
- `POST /a2a/search` - 搜索节点/资产
- `POST /a2a/report` - 报告节点状态
- `GET /a2a/directory` - 节点目录
- `GET /a2a/nodes/:nodeId` - 获取特定节点
- `GET /a2a/billing/earnings` - 计费收益
- `GET /a2a/help` - 帮助信息

#### 2. Assets Module (`src/assets/`)
**优先级**: P0 (核心功能)
**文件**: `src/assets/routes.ts`, `src/assets/service.ts`, `src/assets/types.ts`

实现功能:
- `GET /assets` - 资产列表 (支持分页、过滤)
- `GET /assets/:id` - 资产详情
- `POST /assets` - 创建资产
- `PUT /assets/:id` - 更新资产
- `DELETE /assets/:id` - 删除资产
- `POST /assets/publish` - 发布资产
- `GET /assets/categories` - 资产分类

#### 3. Search Module (`src/search/`)
**优先级**: P0 (用户发现)
**文件**: `src/search/routes.ts`, `src/search/service.ts`

实现功能:
- `GET /search?q=` - 全文搜索
- `GET /search/suggestions` - 搜索建议
- `GET /search/trending` - 热门搜索
- `POST /search/index` - 索引资产 (内部)

### Dependencies
- 数据库: 28+ Prisma models 已存在 (Node, Asset, ReputationEvent 等)
- 共享模块: `src/shared/` (auth, errors, prisma)

### Verification
- [ ] Backend: `npm run build` 成功
- [ ] Backend: `npm test` 所有测试通过
- [ ] Backend: `npx tsx src/index.ts` 能正常启动
- [ ] Frontend: `cd frontend && npm run build` 成功

### Files to Create/Modify
- `src/a2a/routes.ts` (new)
- `src/a2a/service.ts` (new)
- `src/a2a/types.ts` (new)
- `src/assets/routes.ts` (new - 或增强现有 stubs)
- `src/assets/service.ts` (new)
- `src/assets/types.ts` (new)
- `src/search/routes.ts` (增强)
- `src/search/service.ts` (增强)
- `CHANGELOG.md` (本条更新)

---

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
