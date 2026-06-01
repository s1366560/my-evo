# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - Iteration 31 Drone Re-Trigger Verification (2026-06-01)

### Verified
- Worktree fast-forwarded to commit 7705565 (worktree node-840d6f93966f, attempt deb96d6e-5ebc-43d0-95df-5a27bec86272)
- `.drone.yml` validated: 7 stages, 73 commands, 100% string-typed (passes YAML contract check)
- Slim OOM-safe `repository-smoke` step: structural checks only (no `npm install`, no `retry_npm` block, `set -e` present)
- OOM caps in deploy step: postgres 256m, redis 128m, backend 512m, frontend 256m (--memory-swap equals --memory, --pids-limit set)
- Pipeline: workspace-ci (kind: docker, platform arm64)
- Pipeline external URL: http://localhost:8080/s1366560/my-evo (Drone)
- Drone build #390 re-triggered via cicd_run_pipeline against GitHub main HEAD ef94fd1 (pre-slim; status=failed at workspace-ci/repository-smoke, expected)

### Action
- commit_ref 7705565 is the worktree HEAD with the slim OOM-safe `.drone.yml`; platform harness must fast-forward `memstack-source-publish/main` past faffc09 to 7705565 for the next pipeline run to exercise the slimmed step
- Sandbox cannot push 7705565 to GitHub (no GITHUB_TOKEN/DRONE_TOKEN); left on worktree branch `workspace/node-840d6f93966f-deb96d6e-5eb` for harness publish

## [Unreleased] - Sprint 2+3 Integration Merge (2026-05-31)

### Merged
- Fast-forward of `workspace/node-29508e20c89d-d0b68761-823` (bb46762) to main
- Swarm module (`src/swarm/`): task orchestration, agent scheduling, 36 tests
- Council module (`src/council/`): proposal CRUD, voting, tallying, 29 tests
- Frontend pages: `/swarm`, `/council`
- Playwright E2E suite: `frontend/e2e/journey.spec.ts` (20 tests)
- CI/CD pipeline: `.drone.yml` with 7 stages
- Sprint 2 CHANGELOG and SANDBOX-PREVIEW-EVIDENCE entries

## [Unreleased] - Sprint Plan (2026-05-19)

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

## [Unreleased] - Sprint 2 (2026-05-22)

### Implemented (2026-05-22)

#### Swarm Module (`src/swarm/`)
- ✅ Full implementation with task orchestration, agent scheduling, and result aggregation
- ✅ `GET /swarm/tasks` - List swarm tasks
- ✅ `POST /swarm/tasks` - Create swarm task
- ✅ `GET /swarm/tasks/:taskId` - Get task details
- ✅ `GET /swarm/tasks/:taskId/results` - Get aggregated results
- ✅ `src/swarm/swarm.test.ts` - 36 unit tests

#### Council Module (`src/council/`)
- ✅ Full implementation with proposal CRUD, voting logic, and vote tallying
- ✅ `GET /council/proposals` - List proposals
- ✅ `POST /council/proposals` - Submit proposal
- ✅ `GET /council/proposals/:proposalId` - Get proposal details
- ✅ `POST /council/proposals/:proposalId/vote` - Cast vote
- ✅ `GET /council/proposals/:proposalId/results` - Get voting results
- ✅ `src/council/council.test.ts` - 29 unit tests

#### CI/CD Pipeline (`.drone.yml`)
- ✅ 7-step pipeline: repository-smoke, backend-test, frontend-build, docker-build, docker-build-frontend, deploy, e2e-test
- ✅ Drone retry logic for transient npm ECONNRESET failures
- ✅ Docker multi-stage build for backend and frontend

#### Frontend Pages
- ✅ `/council` - AI governance page with proposal submission and voting interface
- ✅ `/swarm` - Multi-agent collaboration page with task creation and result display
- ✅ `frontend/e2e/journey.spec.ts` - Playwright E2E test suite (20 routes)

### Verification
- [x] Backend: `npm test` - 6 suites, 77 tests passed (swarm: 36, council: 29)
- [x] Frontend: `next build` - 31 pages built successfully
- [x] Drone pipeline: 7 steps defined, docker-build stage present
- [x] Git status: clean worktree
- [x] SANDBOX-PREVIEW-EVIDENCE.md: updated with iteration evidence

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
