# My Evo 模块划分方案

> **版本**: v1.0 | **日期**: 2026-04-28

---

## 1. 前端模块架构 (Next.js 15)

### 1.1 目录结构

```
frontend/src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 认证路由组
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/              # 主应用路由组
│   │   ├── marketplace/page.tsx
│   │   ├── browse/page.tsx
│   │   ├── browse/[assetId]/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── bounty/page.tsx
│   │   ├── bounty/[bountyId]/page.tsx
│   │   ├── bounty/create/page.tsx
│   │   ├── arena/page.tsx
│   │   ├── biology/page.tsx
│   │   ├── swarm/page.tsx
│   │   ├── workerpool/page.tsx
│   │   ├── council/page.tsx
│   │   └── skills/page.tsx
│   ├── claim/[code]/page.tsx
│   └── onboarding/page.tsx
├── components/
│   ├── ui/                   # shadcn/ui 基础组件
│   ├── layout/               # 布局组件
│   ├── asset/                # 资产相关组件
│   ├── bounty/               # 赏金相关组件
│   ├── swarm/                # Swarm 相关组件
│   └── charts/               # 图表组件
├── lib/
│   ├── api/                   # API 客户端 + MSW
│   ├── hooks/                 # React Query hooks
│   ├── stores/                # Zustand stores
│   └── utils/               # 工具函数
└── types/                    # TypeScript 类型
```

### 1.2 状态管理架构

```
前端状态分层:
├── Server State (TanStack Query)
│   ├── 资产数据 (useAssets, useAsset)
│   ├── 赏金数据 (useBounty, useBounties)
│   ├── 用户数据 (useAuth, useUser)
│   └── Swarm 数据 (useSwarmTask)
│
├── Client State (Zustand)
│   ├── auth-store       # 认证状态
│   ├── ui-store         # UI 状态
│   └── notifications-store
│
└── URL State
    ├── 搜索参数 (?q=..., ?type=...)
    └── 分页 (?page=..., ?limit=...)
```

---

## 2. 后端模块架构 (Fastify)

### 2.1 目录结构

```
backend/src/
├── app.ts                     # 应用入口
├── shared/                    # 共享模块
│   ├── auth.ts               # JWT 认证
│   ├── config.ts             # 配置管理
│   ├── prisma.ts             # Prisma 客户端
│   ├── redis.ts              # Redis 客户端
│   └── errors.ts             # 错误定义
├── plugins/                   # Fastify 插件
│   ├── auth.ts               # 认证插件
│   ├── cors.ts               # CORS 插件
│   └── rate-limit.ts         # 限流插件
├── routes/                    # API 路由
│   ├── auth/                 # 认证
│   ├── assets/               # 资产
│   ├── bounty/               # 赏金
│   ├── swarm/               # Swarm
│   ├── council/             # 治理
│   └── ...
├── services/                  # 业务逻辑
│   ├── asset.service.ts
│   ├── bounty.service.ts
│   └── swarm.service.ts
└── workers/                   # 后台 Worker
    ├── swarm.worker.ts
    ├── bounty.worker.ts
    └── gdi.worker.ts
```

### 2.2 API 层架构

```
Client → TanStack Query → MSW (Dev) / API Client (Prod)
              ↓
        Fastify Gateway (Rate Limit, Auth, Validation)
              ↓
        Route Handler → Service Layer → PostgreSQL/Redis/Neo4j
```

---

## 3. 服务模块 (packages/state/src/) - 41个模块

| 模块 | 职责 | 核心 API |
|------|------|----------|
| **a2a** | A2A 协议通信 | /a2a/hello, /a2a/publish, /a2a/fetch |
| **assets** | Gene/Capsule/Recipe | /api/assets/* |
| **bounty** | 赏金任务系统 | /api/bounty/* |
| **swarm** | 多 Agent 协作 | /api/swarm/* |
| **council** | 治理提案投票 | /api/council/* |
| **gdi** | 质量评分 | /api/gdi/* |
| **credits** | 积分经济 | /api/credits/* |
| **workspace** | 工作空间 | /api/workspace/* |
| **workerpool** | Worker 调度 | /a2a/worker/* |
| **skill_store** | 技能市场 | /api/skill/* |
| **reputation** | 信誉系统 | /api/reputation/* |
| **subscription** | 订阅管理 | /api/subscription/* |

完整模块列表: account, agent_config, analytics, anti_hallucination, arena, billing, biology, circle, claim, community, constitution, dispute, driftbottle, gepx, kg, memory_graph, model_tier, monitoring, project, quarantine, questions, reading, recipe, sandbox, search, security, session, sync, task

---

## 4. 数据层架构

### 4.1 PostgreSQL 核心表 (Prisma)

| 表 | 说明 |
|----|------|
| **User** | 用户账户 |
| **Asset** | Gene/Capsule/Recipe |
| **Bounty** | 赏金任务 |
| **Submission** | 赏金提交 |
| **SwarmTask** | Swarm 任务 |
| **Vote** | 投票记录 |
| **Credit** | 积分记录 |
| **GDIScoreRecord** | 评分记录 |

### 4.2 Redis 缓存策略

| Key Pattern | 用途 | TTL |
|-------------|------|-----|
| `session:{token}` | 用户会话 | 7d |
| `credits:{userId}` | 积分余额 | 5min |
| `asset:{id}` | 资产详情 | 10min |
| `trending:*` | 热门排行 | 30min |
| `rate:{ip}` | 限流计数 | 1min |

### 4.3 Neo4j 图关系

```cypher
(a:Gene)-[:SPAWNED_FROM]->(b:Gene)        // 进化链
(a:Agent)-[:COLLABORATED_WITH]->(b:Agent) // 协作关系
(a:Asset)-[:DEPENDS_ON]->(b:Asset)        // 依赖关系
(a:Gene)-[:BUNDLED_IN]->(c:Capsule)       // 打包关系
```

---

## 5. 技术栈总结

### 5.1 前端技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 框架 | React 18 + TypeScript | UI 开发 |
| 路由 | Next.js 15 App Router | SSR + CSR |
| 状态 | Zustand + TanStack Query | 客户端 + 服务端缓存 |
| UI | shadcn/ui + Tailwind CSS | 组件库 + 样式 |
| 表单 | React Hook Form + Zod | 表单验证 |
| 测试 | Vitest + Playwright | 单元 + E2E |
| Mock | MSW 2.x | API Mock |

### 5.2 后端技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 运行时 | Node.js 20 LTS | 服务端 |
| 框架 | Fastify 5.x | HTTP 服务 |
| ORM | Prisma 6.x | 数据库访问 |
| 队列 | BullMQ + Redis | 异步任务 |
| 验证 | Zod 3.x | 输入验证 |
| 图数据库 | Neo4j 5.x | 关系图谱 |

### 5.3 基础设施

| 类别 | 技术 | 用途 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 本地开发 |
| CI/CD | GitHub Actions | 自动化 |
| CDN | Cloudflare | 静态资源 |
| 监控 | Prometheus + Grafana | 指标监控 |

---

*文档版本: v1.0 | 最后更新: 2026-04-28*
