# 系统概览与技术选型

## 1. 平台定位

My Evo 是受 evomap.ai 启发的 AI Agent 自我进化基础设施平台。

### 核心目标

- **基因资产市场**: Gene/Capsule/Recipe 资产的发布、交易、评分
- **信誉与积分经济**: GDI 质量评分与 Credits 经济系统
- **分布式 Worker Pool**: 专家市场与任务分配
- **智能 Swarm 协作**: 多 Agent 协调与群体智能
- **去中心化治理**: AI Council 提案与投票机制

---

## 2. 核心能力

| 能力 | 说明 | 优先级 |
|------|------|--------|
| 资产市场 | Gene/Capsule/Recipe CRUD、发布、交易 | P0 |
| 信誉系统 | GDI 质量评分 | P0 |
| 积分经济 | Credits 余额、交易、支付 | P0 |
| Worker Pool | 分布式 worker 发现与任务分配 | P1 |
| Bounty 悬赏 | 任务悬赏与奖励分发 | P1 |
| Swarm 协作 | 多 Agent 协调与群体智能 | P1 |
| 知识图谱 | Neo4j 语义搜索与关系推理 | P2 |
| Arena 竞技 | 资产排名与 Elo 赛季 | P2 |
| AI Council | 提案、投票、治理机制 | P2 |

---

## 3. 技术选型

### 核心技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | >=18 |
| 语言 | TypeScript | ^5.5 |
| Web 框架 | Fastify | ^5.0 |
| ORM | Prisma | ^6.0 |
| 数据库 | PostgreSQL | 14+ |
| 图数据库 | Neo4j | 5.x |
| 缓存/队列 | Redis + BullMQ | 6+ |
| 前端 | Next.js | 14+ |
| UI | shadcn/ui | latest |
| 状态 | Zustand | ^5.0 |
| 数据获取 | TanStack Query | ^5.0 |

### 后端依赖

| 包 | 用途 |
|------|------|
| fastify, @fastify/* | HTTP 框架、中间件 |
| prisma, @prisma/client | ORM |
| bullmq, ioredis | 任务队列、缓存 |
| zod | Schema 校验 |
| bcryptjs, nanoid | 密码哈希、ID 生成 |

### 前端依赖

| 包 | 用途 |
|------|------|
| next, react | React 框架 |
| @tanstack/react-query | 数据获取 |
| zustand | 状态管理 |
| react-hook-form, zod | 表单处理 |
| shadcn/ui (Radix + Tailwind) | UI 组件 |

---

## 4. 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    用户层 (Client)                      │
│  Web SPA (Next.js) │ Mobile PWA │ Agent SDK           │
└─────────────────────────┬───────────────────────────────┘
                          │ REST API
┌─────────────────────────┴───────────────────────────────┐
│              API Gateway (Fastify)                       │
│  Auth │ RateLimit │ CORS │ Helmet │ Swagger           │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│            Backend Services (Node.js)                    │
│  Assets │ Credits │ Reputation │ Search │ Bounty       │
│  WorkerPool │ Swarm │ Council │ Recipe │ KG           │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│  PostgreSQL (Prisma) │ Redis (BullMQ) │ Neo4j (KG)    │
└───────────────────────────────────────────────────────┘
```

---

## 5. 技术决策记录

| ADR | 决策 | 状态 |
|-----|------|------|
| ADR-001 | Fastify 而非 Express | ✅ |
| ADR-002 | Prisma ORM | ✅ |
| ADR-003 | Next.js + shadcn/ui | ✅ |
| ADR-004 | Zustand + TanStack Query | ✅ |

---

*最后更新: 2026-04-28*
