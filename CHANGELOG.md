# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - Sprint Plan (2026-05-19)

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
