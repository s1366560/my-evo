# my-evo 项目调研报告

**生成时间**: 2026-05-20  
**工作目录**: `/workspace/.memstack/worktrees/0e5a6709-4961-4993-a15b-e55628857871`  
**分支**: `workspace/node-1758af8b32ac-0e5a6709-496`  
**Git HEAD**: `6d2c284` (Merge remote-tracking branch 'refs/remotes/memstack-source-publish/main' into HEAD)

---

## 一、代码结构摘要

### 1.1 项目目录布局

```
my-evo/
├── backend/                        # Express + TypeScript 后端 (ESM)
│   ├── src/
│   │   ├── index.ts                # 入口: Express app 注册路由, 监听端口
│   │   ├── config/                 # 配置 (config/index.ts)
│   │   ├── db/                      # 数据库: mock-store.ts (in-memory), prisma/
│   │   ├── middleware/              # auth.ts, errorHandler.ts
│   │   ├── routes/                  # 6 个路由文件
│   │   ├── ai/                      # AI service + types + ai.test.ts
│   │   ├── auth/                    # controller, service, types, auth.test.ts
│   │   ├── export/                  # service, types, export.test.ts
│   │   ├── graph/                   # engine.ts, algorithms.ts, types.ts
│   │   ├── map/                     # types.ts
│   │   └── *.ts                     # 其他模块 (无测试)
│   ├── prisma/schema.prisma         # PostgreSQL schema (User, Map, Node, Edge...)
│   ├── jest.config.cjs
│   └── package.json
├── frontend/                       # Next.js 14 App Router (TypeScript)
│   ├── src/
│   │   ├── app/                    # 22 个页面路由
│   │   ├── components/             # UI / landing / editor / map / browse / bounty / auth / dashboard / scoring / onboarding / marketplace
│   │   ├── lib/                    # api/, hooks/, stores/, utils/, theme-context
│   │   └── stories/               # Storybook stories
│   ├── tests/                      # 44 个 E2E Playwright spec 文件
│   ├── playwright.config.ts
│   └── package.json
├── docs/                           # ~80 个文档文件 (架构/API/分析/报告)
├── tasks/                          # 任务清单 + 分解子任务
├── verifier/                       # 持久化验证器
├── Dockerfile                      # 多阶段构建, Node 20 Alpine
├── docker-compose.yml              # 开发环境
├── docker-compose.prod.yml         # 生产环境
└── .drone.yml                      # Drone CI/CD 配置
```

### 1.2 后端 API 路由 (6 个路由文件)

| 路由文件 | 前缀 | 路由数量 | 主要端点 |
|---------|------|---------|---------|
| `routes/auth.ts` | `/api/v1/auth` | 4 | register, login, refresh, me |
| `routes/map.ts` | `/api/v1/map` | 12 | nodes CRUD, edges CRUD, maps CRUD |
| `routes/graph.ts` | `/api/v1/graph` | 8 | graph ops, algorithms |
| `routes/export.ts` | `/api/v1/export` | 3 | export formats |
| `routes/dashboard.ts` | `/api/v2/dashboard` | 7 | dashboard data |
| `routes/ai.ts` | `/api/v1/ai` | 6 | AI generation |

**总计: 40 个 API 端点** (后端主应用)  
**健康检查**: `GET /health` → `{status, timestamp, mode}`

### 1.3 前端页面路由 (22 个)

| 路径 | 页面 | 状态 |
|------|------|------|
| `/` | 首页 Landing | ✅ 完整 |
| `/login` | 登录 | ✅ 完整 |
| `/register` | 注册 | ✅ 完整 |
| `/onboarding` | 引导 | ✅ 完整 |
| `/dashboard/onboarding` | 仪表板引导 | ✅ 完整 |
| `/browse` | 资产浏览 | ✅ 完整 |
| `/browse/trending` | 热门浏览 | ✅ 完整 |
| `/browse/new` | 新资产浏览 | ✅ 完整 |
| `/map` | 地图可视化 | ✅ 完整 |
| `/editor` | 地图编辑器 | ✅ 完整 |
| `/workspace` | 工作区 | ✅ 完整 |
| `/bounty-hall` | 赏金大厅 | ✅ 完整 |
| `/bounty` | 赏金列表 | ✅ 完整 |
| `/bounty/create` | 创建赏金 | ✅ 完整 |
| `/bounty/[bountyId]` | 赏金详情 | ✅ 完整 |
| `/bounty-hall/*` | 赏金相关 | ✅ 完整 |
| `/marketplace` | 市场 | ✅ 完整 |
| `/pricing` | 定价 | ✅ 完整 |
| `/publish` | 发布资产 | ✅ 完整 |
| `/dashboard/bounties` | 仪表板赏金 | ✅ 完整 |
| `/api/v1/auth/[...path]` | 代理路由 | ✅ 完整 |
| `/api/v2/*` | BFF 路由 | ✅ 完整 |

---

## 二、Drone CI/CD 配置

### 2.1 `.drone.yml` 结构

```yaml
kind: pipeline / type: docker
trigger: push + custom / branch: main
platform: linux / arm64

steps (并行执行):
  1. repository-smoke  (node:20-alpine) — 检查 package.json 存在且有 scripts
  2. backend-test      (node:20-alpine) — cd backend && npm install && npm test
  3. frontend-build    (node:20-alpine) — cd frontend && npm install && npm run build
  4. docker-build      (plugins/docker:20) — 推送镜像到 host.docker.internal:5001/my-evo
  5. deploy           (docker:cli) — 挂载 /var/run/docker.sock，拉取镜像，运行容器，健康检查

volumes:
  - name: docker-sock
    host: { path: /var/run/docker.sock }

deploy step 命令:
  docker pull host.docker.internal:5001/my-evo:drone-docker-e2e
  docker tag ... my-evo:latest
  docker rm -f my-evo || true
  docker run -d --name my-evo -p 8080:3001 my-evo:latest
  sleep 5
  wget -qO- http://host.docker.internal:8080/health
```

### 2.2 容器端口映射
- 容器暴露端口: `3001` (Dockerfile EXPOSE 3001, HEALTHCHECK 3001/health)
- 宿主机映射: `8080:3001`
- 健康检查端点: `http://host.docker.internal:8080/health`

---

## 三、测试覆盖率分析

### 3.1 后端单元测试

| 文件 | 测试数量 (≈describe+it) | 覆盖 |
|------|------------------------|------|
| `auth/auth.test.ts` | ~40 行 grep 命中 | 登录/注册/token 刷新 |
| `ai/ai.test.ts` | ~41 行 grep 命中 | AI 生成逻辑 |
| `export/export.test.ts` | ~20 行 grep 命中 | 导出格式 |
| **其余 ~30 个服务文件** | **0 个测试** | **无覆盖** |

**覆盖率盲区 (后端)**:
- `routes/map.ts` — 地图 CRUD 路由 (12 端点)
- `routes/graph.ts` — 图算法路由 (8 端点)
- `routes/dashboard.ts` — 仪表板路由 (7 端点)
- `middleware/auth.ts` — JWT 认证中间件
- `middleware/errorHandler.ts` — 错误处理
- `db/mock-store.ts` — 内存数据存储
- `graph/engine.ts` — 图引擎核心
- `graph/algorithms.ts` — 图算法
- `export/service.ts` — 导出服务逻辑

**粗略覆盖率估算**: ~3/30+ 源文件 ≈ **< 10%** 行覆盖率

### 3.2 前端测试

**单元/Vitest 测试**:
- `lib/hooks/useLocalStorage.test.ts`
- `lib/hooks/useMediaQuery.test.ts`
- `lib/hooks/useReactQueryHooks.test.ts`
- `lib/hooks/composable-hooks.test.ts`
- 4 个 hook 测试文件，覆盖有限

**E2E Playwright 测试** (44 个 spec):
- `e2e-auth.spec.ts` — 注册/登录/登出完整生命周期
- `e2e-bounty.spec.ts`, `e2e-bounty-hall.spec.ts`
- `e2e-browse.spec.ts`, `e2e-browse-search.spec.ts`
- `e2e-arena.spec.ts`, `e2e-council.spec.ts`, `e2e-credits.spec.ts`
- `e2e-dataviz.spec.ts`, `e2e-demo-capture.spec.ts`
- `e2e-editor.spec.ts`, `e2e-editor-interaction.spec.ts`
- `e2e-map-interaction.spec.ts`
- `e2e-marketplace.spec.ts`, `e2e-navigation-settings.spec.ts`
- `e2e-onboarding.spec.ts`, `e2e-profile.spec.ts`
- `e2e-publish.spec.ts`, `e2e-core-pages.spec.ts`
- `e2e-screenshot-*.spec.ts` — 截图测试
- `e2e-swarm-workerpool.spec.ts`, `e2e-workspace.spec.ts`
- `e2e-claim.spec.ts`
- `ui-smoke.spec.ts`

**覆盖率盲区 (前端)**:
- 所有 React 组件 (无 Vitest/Jest 组件测试)
- API hooks (`lib/api/hooks/`) — 仅 `useReactQueryHooks.test.ts`
- Store 层 (`lib/stores/`) — 无测试
- 工具函数 (`lib/utils.ts`) — 无测试

### 3.3 集成测试
- 无 `__tests__/` 集成测试目录 (存在目录结构但内容很少)
- 无跨服务 API 集成测试

---

## 四、未完成功能清单 (按 P0/P1/P2)

### P0 CRITICAL (4 项)
1. **TASK_P0_01: Asset Purchase Flow** — 购物车/结账/credit 扣减/交易记录
2. **TASK_P0_02: Bounty Task Frontend** — 赏金前端完整 UI (已有基础, 需完善提交追踪)
3. **TASK_P0_03: Asset Publishing UI** — 多步资产创建向导 (Gene/Capsule/Recipe)
4. **TASK_P0_04: Checkout/Payment Integration** — 原子化 credit 扣减/退款/收据生成

### P1 HIGH (9 项)
5. **TASK_P1_01: Asset Detail Page Enhancements** — 资产详情页增强
6. **TASK_P1_02: Recipe Composer** — 配方编辑器
7. **TASK_P1_03: Guild System** — 公会/社区系统
8. **TASK_P1_04: Circle/Community Pages** — 圈子/社区页面
9. **TASK_P1_05: Subscription Plans UI** — 订阅计划 UI
10. **TASK_P1_06: Drift Bottle UI** — 漂流瓶 UI
11. **TASK_P1_07: Notifications System** — 通知系统
12. **TASK_P1_08: Agent Profile Pages** — Agent 个人页
13. **TASK_P1_09: Skill Marketplace Install Flow** — 技能市场安装流程

### P2 MEDIUM (5 项)
14. **TASK_P2_01: Watchlist/Favorites** — 收藏夹
15. **TASK_P2_02: User Settings Enhancements** — 设置增强
16. **TASK_P2_03: i18n Support** — 国际化
17. **TASK_P2_04: Email Notifications** — 邮件通知
18. **TASK_P2_05: Analytics Dashboard** — 数据分析仪表板

### DOC 文档任务 (4 项)
19. **TASK_DOC_01: Update API Documentation** — API 文档更新
20. **TASK_DOC_02: Component Library Documentation** — 组件库文档
21. **TASK_DOC_03: Deployment/Ops Documentation** — 部署运维文档
22. **TASK_DOC_04: Testing Strategy Document** — 测试策略文档

---

## 五、CI/CD 盲区与改进建议

### 5.1 当前 .drone.yml 局限
1. **无前端测试步骤**: `frontend-build` 只做 `npm run build`，未运行 `npm test` 或 E2E
2. **deploy step 健康检查**: `wget` 检查成功但退出码未验证 (`wget -qO-` 即使 404 也会成功退出)
3. **无 E2E 阶段**: 44 个 Playwright spec 文件从未在 CI 中运行
4. **镜像标签**: 仅用 `drone-docker-e2e` 和 `latest`，无 git SHA 标签

### 5.2 测试覆盖率改进
1. 为 `routes/map.ts`, `routes/graph.ts`, `routes/dashboard.ts` 添加 Jest 路由测试
2. 为 `middleware/auth.ts` 添加 JWT 验证测试
3. 为 `db/mock-store.ts` 添加 CRUD 测试
4. 前端添加组件级 Vitest 测试
5. CI 添加 E2E 测试阶段 (Playwright)

### 5.3 Docker 改进
1. 前端 `Dockerfile` 存在但未集成到 `.drone.yml`
2. `docker-compose.prod.yml` 有前端服务但主 Dockerfile 只构建后端
3. 建议统一使用 monorepo Dockerfile 或拆分为两个镜像

---

## 六、总结

| 维度 | 状态 | 备注 |
|------|------|------|
| 后端 API 路由 | ✅ 40 端点实现 | 全部在 Express 单体中 |
| 前端页面 | ✅ 22 个页面 | 全部有实际内容，非 stub |
| 数据库 Schema | ✅ Prisma schema | PostgreSQL 模型完整 |
| CI/CD | ✅ .drone.yml | 有 docker-deploy stage |
| 后端单元测试 | ❌ 极低 | 仅 3 个文件有测试，<10% 覆盖 |
| 前端组件测试 | ❌ 无 | 无 Vitest/Jest 组件测试 |
| E2E 测试 | ⚠️ 44 个 spec | 有文件但 CI 未执行 |
| 未完成功能 | ⚠️ 22 项 | P0 有 4 项阻塞核心业务流程 |
| 文档完整性 | ⚠️ 80+ docs | 大量文档但部分过期 |
