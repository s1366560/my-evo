# 架构设计调研报告

> **版本**: v2.0 | **日期**: 2026-04-28
> **任务**: feature-002-6d41ecc976c0

---

## 1. 调研范围与目标

- 分析 my-evo 现有架构设计文档与代码结构
- 调研 evomap.ai 原版产品的核心功能与协议
- 设计合理的模块划分和实现方案

---

## 2. 现有项目状态分析

### 2.1 代码结构概览

```
my-evo/
├── frontend/           # Next.js 15 前端 (App Router)
│   ├── src/app/       # 页面路由 (30+ 页面)
│   ├── src/components/ # 组件 (按功能域组织)
│   └── src/lib/       # 共享库 (api, hooks, stores)
├── backend/            # 目标: Fastify 后端 (当前为空目录)
├── src/                # Node.js/TypeScript 后端 (50+ 服务模块)
│   ├── a2a/          # A2A 协议核心
│   ├── assets/        # 资产发布与获取
│   ├── auth/          # 认证
│   ├── bounty/        # 赏金任务
│   ├── swarm/         # 多 Agent 协作
│   ├── council/       # 审议决策
│   ├── arena/         # Agent 对战
│   ├── biology/       # 进化引擎
│   └── [40+ 更多模块]
├── packages/          # 共享 npm 包
├── prisma/            # Prisma Schema
└── docs/architecture/ # 架构文档
```

### 2.2 技术栈状态

**前端** (已确定):
- Next.js 15 (App Router), shadcn/ui + Radix UI + Tailwind CSS
- Zustand (auth, ui, notifications, workspace stores)
- TanStack Query v5, MSW v2, Vitest + Playwright

**后端** (已确定):
- Node.js 18+, Fastify 5.x (待实现)
- Prisma 6.x (schema 已定义), BullMQ + Redis (待集成)

### 2.3 已实现功能

**前端页面 (22/35 完成)**:
首页、登录/注册、市场、浏览、仪表板、赏金、Arena、Biology、Swarm、Council、Worker Pool、Skills、Claim、文档

**后端模块 (50+ 服务)**:
核心逻辑已实现: assets, bounty, swarm, council, arena, biology, credits, auth 等
待实现: REST API 暴露层、数据持久化

---

## 3. EvoMap 原版功能调研

### 3.1 GEP-A2A 协议 (核心)

消息信封格式:
```json
{
  "protocol": "gep-a2a",
  "protocol_version": "1.0.0",
  "message_type": "<hello|publish|validate|fetch|report>",
  "message_id": "msg_<timestamp>_<random_hex>",
  "sender_id": "node_<node_id>",
  "timestamp": "<ISO 8601 UTC>",
  "payload": {}
}
```

**核心消息类型**:
- hello: 节点注册 (src/a2a/)
- publish: 发布 Gene+Capsule 捆绑包 (src/assets/)
- fetch: 查询已推广资产 (src/assets/)
- report: 提交验证结果 (src/gdi/)
- validate: 干跑测试发布 (src/assets/)

### 3.2 资产结构 (Assets)

**Gene (基因)** — 可复用的策略模板:
- type: "Gene", schema_version: "1.5.0"
- category: repair|optimize|innovate|explore
- signals_match: 触发信号列表
- asset_id: sha256 内容寻址

**Capsule (胶囊)** — 经过验证的修复方案:
- type: "Capsule", 引用 gene: sha256:<gene_asset_id>
- diff: 完整代码变更
- confidence: 置信度 (0-1)
- blast_radius: 影响范围 (files, lines)

**资产生命周期**:
| 状态 | 含义 |
|------|------|
| candidate | 刚发布，等待 Hub 审核 |
| promoted | 已验证，可分发 |
| rejected | 验证或策略检查失败 |
| revoked | 发布者撤回 |

### 3.3 任务系统

**赏金任务流程**:
1. 获取开放任务 → 2. 认领任务 → 3. 解决问题并发布 → 4. 完成任务 → 5. 用户验收

**Swarm (多智能体任务分解)**:
- Proposer: 5% 权重，提出分解方案
- Solvers: 85% 权重，分割比例按 subtask weight
- Aggregator: 10% 权重，合并所有结果

---

## 4. 模块架构设计

### 4.1 模块分层

```
用户层: Web (Next.js) │ CLI │ 第三方(REST/A2A)
                ↓
API 网关: Fastify (:3000) + WS (:3001)
CORS → Rate Limit → JWT → Zod → Routes
                ↓
业务逻辑: Auth │ Assets │ Swarm │ GDI │ Credits │ Bounty │ Biology
                ↓
数据层: PostgreSQL │ Redis │ Neo4j │ S3
```

### 4.2 核心模块划分 (37 个)

**P0 — MVP 核心模块**:

| # | 模块 | 路由前缀 | 状态 |
|---|------|----------|------|
| 1 | auth | /api/auth/* | ✅ |
| 2 | account | /api/account/* | ✅ |
| 3 | credits | /api/credits/* | ✅ |
| 4 | assets | /api/assets/* | ✅ |
| 5 | bounty | /api/bounty/* | ✅ |
| 6 | marketplace | /api/marketplace/* | ✅ |

**P1 — 核心体验模块**:

| # | 模块 | 路由前缀 | 状态 |
|---|------|----------|------|
| 7 | swarm | /api/swarm/* | ✅ |
| 8 | council | /api/council/* | ✅ |
| 9 | arena | /api/arena/* | ✅ |
| 10 | biology | /api/biology/* | ✅ |
| 11 | gep | /api/gep/* | ✅ |
| 12 | gdi | /api/gdi/* | ✅ |
| 13 | verifiable_trust | /api/trust/* | ✅ |
| 14 | reputation | /api/reputation/* | ✅ |
| 15 | claim | /api/claim/* | ✅ |
| 16 | workspace | /api/workspace/* | ✅ |

**P2 — 完善模块**:

| # | 模块 | 路由前缀 | 状态 |
|---|------|----------|------|
| 17 | workerpool | /api/workerpool/* | ✅ |
| 18 | task | /api/task/* | ✅ |
| 19 | recipe | /api/recipe/* | ✅ |
| 20 | skill_store | /api/skills/* | ✅ |
| 21 | subscription | /api/subscription/* | ✅ |
| 22 | dispute | /api/dispute/* | ✅ |

### 4.3 前端模块划分

**页面路由 (App Router)**:
- (marketing)/: 未登录区域 (onboarding)
- (app)/: 已认证区域 (dashboard, profile)
- marketplace/: 技能市场
- browse/: 资产浏览 (含详情页和 lineage)
- bounty/: 赏金大厅 (含创建和详情)
- arena/, biology/, swarm/, council/, workerpool/, skills/

**组件模块 (按功能域)**:
- ui/: shadcn/ui 基础组件 (18 个)
- auth/: LoginForm, RegisterForm, AuthLayout
- landing/: HeroSection, StatsGrid, TrendingSignals
- swarm/: SwarmSessionTimeline, SwarmTaskCard
- council/: ProposalCard, VotePanel
- workerpool/: WorkerCard, WorkerFilter

**状态管理 (Zustand)**:
- auth-store.ts: token, userId, isAuthenticated
- ui-store.ts: sidebar, theme, modal
- notifications-store.ts: 通知状态
- workspace-store.ts: 工作空间状态

**API 层 (React Query + MSW)**:
- client.ts: API 客户端主文件
- http-client.ts: HTTP 请求封装
- query-keys.ts: React Query key 工厂
- mocks/: MSW handlers (auth, bounty, credits, workspace)

---

## 5. API 设计方案

### 5.1 REST API 路由设计

**认证模块 (/api/auth/*):

| 方法 | 路径 | 描述 | 状态 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | ✅ |
| POST | /api/auth/login | 用户登录 | ✅ |
| POST | /api/auth/logout | 用户登出 | ✅ |
| GET | /api/auth/me | 获取当前用户 | ✅ |
| POST | /api/auth/refresh | 刷新 Token | 待实现 |

**资产模块 (/api/assets/*):

| 方法 | 路径 | 描述 | 状态 |
|------|------|------|------|
| GET | /api/assets | 资产列表 (分页/过滤) | ✅ |
| GET | /api/assets/:id | 资产详情 | ✅ |
| POST | /api/assets | 发布资产 | ✅ |
| POST | /api/assets/:id/purchase | 购买资产 | 待实现 |
| GET | /api/assets/:id/lineage | 资产血缘 | ✅ |
| GET | /api/assets/trending | 热门资产 | ✅ |
| GET | /api/assets/search | 搜索资产 | ✅ |

**赏金模块 (/api/bounty/*):

| 方法 | 路径 | 描述 | 状态 |
|------|------|------|------|
| GET | /api/bounty | 赏金列表 | ✅ |
| GET | /api/bounty/:id | 赏金详情 | ✅ |
| POST | /api/bounty | 创建赏金 | ✅ |
| POST | /api/bounty/:id/bid | 竞标 | ✅ |
| POST | /api/bounty/:id/claim | 认领赏金 | ✅ |
| POST | /api/bounty/:id/submit | 提交交付物 | ✅ |
| POST | /api/bounty/:id/review | 评审 | ✅ |

### 5.2 WebSocket 协议设计 (A2A)

连接: ws://localhost:3001/a2a

// 节点注册
→ { "type": "hello", "node_id": "...", "capabilities": [...] }
← { "type": "hello_ack", "node_id": "...", "hub_url": "..." }

// 资产发布
→ { "type": "publish", "payload": { "gene": {...}, "capsule": {...} } }
← { "type": "publish_ack", "asset_id": "sha256:..." }

// Swarm 会话
→ { "type": "swarm.start", "task_id": "...", "agents": [...] }
← { "type": "swarm.event", "agent_id": "...", "event": "..." }

// 实时通知
← { "type": "notification", "kind": "bounty_claimed", "data": {...} }

### 5.3 数据模型设计 (Prisma Schema)

核心实体关系:

User ─┬─→ Account (多平台认证)
       ├─→ Asset (发布的资产)
       ├─→ Bounty (发布的赏金)
       ├─→ Credit (积分变动)
       ├─→ Subscription (订阅)
       └─→ Workspace (工作空间)

Asset ─┬─→ Gene / Capsule / Recipe (类型区分)
        ├─→ parent: Asset (血缘)
        └─→ Gene (基因引用)

Bounty ─┬─→ Bid (竞标)
         ├─→ Deliverable (交付物)
         └─→ Milestone (里程碑)

Node ─┬─→ Agent (绑定的 Agent)
        └─→ Claim (声明)

SwarmSession ─┬─→ SwarmTask → SwarmTaskResult
               └─→ SwarmAgent → SwarmMessage

---

## 6. 实现方案

### 6.1 分阶段实施计划

**第一阶段: 后端 REST API 统一暴露 (P0)**
- 初始化 Fastify 项目，配置 TypeScript
- 统一添加 JWT 中间件 (从 src/auth 复用)
- 实现 app.ts 主入口，汇总所有路由
- 配置 CORS、Rate Limit、错误处理
- 集成 Prisma Client + Redis 会话

**第二阶段: 前端 API 集成 (P0)**
- 配置 baseURL 指向后端服务
- 添加 JWT token 透传
- 集成 React Query 错误处理 (401 重定向)
- 实现购买/发布/结账等 P0 功能

**第三阶段: 数据持久化 (P0)**
- 完善 Prisma Schema (补充所有实体)
- 在每个 service 中集成 Prisma Client
- 实现 Redis 会话和缓存

**第四阶段: 高级功能 (P1)**
- Swarm 可视化 (React Flow 集成)
- GDI 评分系统
- BullMQ 任务队列

**第五阶段: 完善 (P2)**
- E2E 测试覆盖
- 移动端适配

### 6.2 关键实现代码

**后端入口 (backend/src/app.ts)**:
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth';
import { assetsRoutes } from './routes/assets';
import { bountyRoutes } from './routes/bounty';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(jwt, { secret: process.env.JWT_SECRET! });

app.decorate('authenticate', async (request, reply) => {
  try { await request.jwtVerify(); }
  catch (err) { reply.status(401).send({ error: 'Unauthorized' }); }
});

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(assetsRoutes, { prefix: '/api/assets' });
await app.register(bountyRoutes, { prefix: '/api/bounty' });

export default app;
```

**前端 API 客户端 (frontend/src/lib/api/client.ts)**:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = {
  login: (email: string, password: string) =>
    http.post<AuthResponse>('/api/auth/login', { email, password }),
  getAssets: (filters?: AssetFilters) =>
    http.get<PaginatedResponse<Asset>>('/api/assets', { params: filters }),
  publish: (data: PublishAssetInput) =>
    http.post<Asset>('/api/assets', data),
  purchase: (assetId: string) =>
    http.post<PurchaseResponse>(`/api/assets/${assetId}/purchase`),
  getBounties: (filters?: BountyFilters) =>
    http.get<PaginatedResponse<Bounty>>('/api/bounty', { params: filters }),
  createBounty: (data: CreateBountyInput) =>
    http.post<Bounty>('/api/bounty', data),
};
```

---

## 7. 技术风险与解决方案

| 风险 | 影响 | 解决方案 |
|------|------|---------|
| MSW 与真实 API 切换 | 高 | 条件渲染: dev 用 MSW, prod 用真实 API |
| 大量模块路由汇总 | 中 | 使用 fastify-auto-routes 自动发现 |
| 实时通知可靠性 | 中 | WebSocket 重连 + 消息队列确认 |
| Neo4j 运维复杂度 | 中 | 先用 PostgreSQL 关系表模拟 |
| BullMQ Redis 依赖 | 低 | 开发环境用 ioredis-mock |

---

## 8. 文档输出清单

| 文档 | 路径 | 状态 |
|------|------|------|
| 架构设计调研 (本篇) | docs/architecture/ARCHITECTURE-DESIGN-RESEARCH-v2.md | 完成 |
| 模块架构设计 | docs/architecture/MODULE-ARCHITECTURE.md | 存在 |
| 技术架构设计 | docs/architecture/TECHNICAL-ARCHITECTURE.md | 存在 |
| 实现方案 | docs/architecture/IMPLEMENTATION-PLAN.md | 存在 |
| API 接口参考 | docs/evomap-api-reference.md | 存在 |
| EvoMap 功能清单 | docs/evomap-feature-checklist.md | 存在 |
| 系统总览 | docs/architecture/SYSTEM-OVERVIEW.md | 存在 |
| 后端 API 设计 | docs/architecture/BACKEND-API-DESIGN.md | 待补充 |
| 前端集成指南 | docs/architecture/FRONTEND-INTEGRATION.md | 待补充 |
| 数据库设计 | docs/architecture/DATABASE-DESIGN.md | 待补充 |

---

## 9. 调研结论

### 9.1 核心发现

1. **前后端分离已完成架构设计**: 前端 (Next.js 15 + React Query + Zustand) 和后端 (src/ 50+ 服务模块) 已有完整代码结构
2. **核心功能模块齐全**: 资产系统、赏金系统、Swarm、Council、Arena 等代码均已实现
3. **缺少 REST API 暴露层**: src/ 模块是独立服务，需通过 Fastify 统一暴露
4. **缺少数据持久化**: 当前为内存数据，需集成 Prisma + PostgreSQL
5. **前端 Mock 完备**: MSW handlers 已覆盖 auth、bounty、credits、workspace

### 9.2 推荐实施路径

Step 1: 搭建 Fastify 后端入口 → 汇总所有 src/ 路由
Step 2: 前端 API 客户端对接 → 替换 MSW mock
Step 3: 添加 Prisma + PostgreSQL → 持久化数据
Step 4: 集成 Redis + BullMQ → 任务队列
Step 5: WebSocket A2A → 实时通信
Step 6: Neo4j 知识图谱 → 高级功能

---

*文档版本: v2.0 | 更新日期: 2026-04-28*
