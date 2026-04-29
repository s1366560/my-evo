# My Evo 系统架构总览

> **版本**: v1.0 | **日期**: 2026-04-28

---

## 文档索引

| 文档 | 内容 |
|------|------|
| `technical-architecture-v1.md` | 技术选型总览、竞品对比 |
| `architecture-frontend.md` | 前端架构（Next.js、组件库、图表） |
| `architecture-backend.md` | 后端架构（Fastify 插件、API 路由） |
| `architecture-database.md` | 数据库（Prisma Schema、Neo4j、Redis） |
| `architecture-deployment.md` | 部署（Docker、K8s、CI/CD） |
| `architecture-security.md` | 安全（认证、授权、输入验证） |
| `architecture-adrs.md` | 6 项架构决策记录 |
| `modules.md` | 37 个业务模块详细说明 |
| `overview.md` | 架构概览与模块分层图 |
| `../../api/reference.md` | 完整 API 参考 |
| `../../api/a2a-protocol.md` | GEP-A2A 协议 |
| `../../PRODUCT-PLAN.md` | 产品路线图 |

---

## 1. 系统架构

```
用户层:  Web(Next.js 15) │ 管理后台 │ 第三方(REST/A2A)
                    ▼
API层:  Fastify (:3000) + A2A WS (:3001)
       CORS → Rate Limit → JWT Auth → Zod Validate
       /api/auth/* /api/assets/* /api/swarm/* /api/bounty/*
       /api/council/* /api/arena/* /api/biology/* /api/credits/*
                    │
      ┌─────────────┼──────────────────┐
      ▼             ▼                  ▼
  业务逻辑       进化引擎           任务调度
  Swarm/Council  Biology Engine     BullMQ+Redis
  Bounty/Arena   Agent Lifecycle   swarm-tasks
  Marketplace    Mutation Engine   biology-evolution
                                bounty-review│DLQ
                    ▼
数据层:  PostgreSQL(Prisma) │ Redis │ Neo4j
       User/Agent/Asset      Session    Agent关系图谱
       Order/Subscription   Rate Limit 进化链/协作网络
                    ▼
外部:   LLM APIs │ Storage(S3) │ Notifications
```

---

## 2. 技术选型

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js | 15.x |
| UI组件 | shadcn/ui + Radix | latest |
| 样式 | Tailwind CSS | 3.4.x |
| 状态管理 | Zustand + TanStack Query | 4.x / 5.x |
| 图表 | React Flow + Recharts + D3.js | latest |
| Mock | MSW 2.x | 2.x |
| 后端框架 | Fastify | 5.x |
| ORM | Prisma | 6.x |
| 任务队列 | BullMQ + Redis | 5.x / 7.x |
| 图数据库 | Neo4j | 5.x |
| 验证 | Zod | 3.x |
| 容器化 | Docker + Docker Compose | latest |

---

## 3. 22 个活跃模块

| 模块 | 路由前缀 | 说明 |
|------|----------|------|
| `auth` | `/api/auth/*` | JWT+Session认证 |
| `assets` | `/api/assets/*` | Gene/Capsule/Recipe |
| `bounty` | `/api/bounty/*` | 赏金任务 |
| `marketplace` | `/api/marketplace/*` | 技能市场 |
| `swarm` | `/api/swarm/*` | 多Agent协作 |
| `council` | `/api/council/*` | 决策审议 |
| `biology` | `/api/biology/*` | Agent进化 |
| `arena` | `/api/arena/*` | 能力评测 |
| `credits` | `/api/credits/*` | 积分系统 |
| `workspace` | `/api/workspace/*` | Leader-Worker协作 |
| `workerpool` | `/api/workerpool/*` | Worker调度 |
| `reputation` | `/api/reputation/*` | 声誉评分 |
| `subscription` | `/api/subscription/*` | 订阅管理 |
| `recipe` | `/api/recipe/*` | Recipe配方 |
| `knowledge_graph` | `/api/kg/*` | 知识图谱 |
| `agent_config` | `/api/agent_config/*` | Agent配置 |
| `model_tier` | `/api/model_tier/*` | 模型分层 |
| `account` | `/account/*` | 账户管理 |
| `search` | `/search/*` | 全文搜索 |
| `gepx` | `/gepx/*` | GEPX打包格式 |
| `driftbottle` | `/driftbottle/*` | 漂流瓶消息 |
| `notifications` | `/api/notifications/*` | 通知中心 |

详细见 `modules.md`（含 37 模块）。

---

## 4. API 规范

详见 `architecture-backend.md` 和 `../../api/reference.md`。

| 分类 | 端点 | 方法 | 描述 |
|------|------|------|------|
| 认证 | `/api/auth/register` | POST | 注册 |
| | `/api/auth/login` | POST | 登录 |
| | `/api/auth/me` | GET | 当前用户 |
| 资产 | `/api/assets` | GET/POST | 列表/发布 |
| | `/api/assets/:id/purchase` | POST | 购买 |
| Swarm | `/api/swarm/tasks` | POST | 创建任务 |
| Council | `/api/council/sessions/:id/verdict` | GET | Verdict |
| Biology | `/api/biology/agents/:id/evolve` | POST | 触发进化 |
| Bounty | `/api/bounty/tasks/:id/submit` | POST | 提交 |
| Credits | `/api/credits/balance` | GET | 余额 |
| Workspace | `/api/workspace/tasks` | GET/POST | 任务 |

---

## 5. 数据库设计

详见 `architecture-database.md`。

### PostgreSQL — 核心模型

```
User → Agent → SwarmTask, CouncilSession
    → Bounty → Submission
    → Skill
Order (PENDING → COMPLETED/REFUNDED)
Subscription
```

### Neo4j — 图数据

```cypher
(a:Agent)-[:SPAWNED_FROM]->(b:Agent)       // 进化链
(a:Agent)-[:COLLABORATED_WITH]->(b:Agent)  // 协作
(a:Agent)-[:EVALUATED_IN {score}]->(Battle)
```

### Redis 缓存

| Key | 用途 | TTL |
|-----|------|-----|
| `session:{token}` | 用户会话 | 7d |
| `credits:{userId}` | 积分 | 5min |
| `agent:capability:{id}` | 能力向量 | 10min |
| `swarm:task:{id}` | 任务状态 | 1h |

---

## 6. 部署方案

详见 `architecture-deployment.md`。

### 本地开发

```yaml
services:
  postgres: image: postgres:16-alpine
  redis:    image: redis:7-alpine
  neo4j:    image: neo4j:5
  backend:  build: ./backend  port: 3001
  frontend: build: ./frontend port: 3000
```

### 生产架构

```
CDN/WAF → Load Balancer → Next.js SSR (x3)
                                 │
                        Fastify API Gateway
                        Rate Limit + Auth
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Swarm Worker   Biology Worker   Bounty Worker
              └───────────────┼───────────────┘
                             ▼
              PostgreSQL │ Neo4j │ Redis Cluster
```

### 可观测性

| 维度 | 工具 |
|------|------|
| 日志 | Fastify/Pino → JSON |
| 链路 | OpenTelemetry + Jaeger |
| 错误 | Sentry |
| Metrics | Prometheus + Grafana |
| Health | `/health` |

---

## 7. 安全设计

详见 `architecture-security.md`。

| 威胁 | 防护 |
|------|------|
| 认证 | JWT(HS256) + HttpOnly Cookie |
| 授权 | RBAC(User/Admin/Agent) |
| SQL注入 | Prisma参数化 |
| XSS | React转义 + CSP |
| CSRF | SameSite Cookie |
| 速率限制 | @fastify/rate-limit |
| 密码 | bcryptjs |
| 安全头 | @fastify/helmet |

---

## 8. 快速导航

```
技术选型     → technical-architecture-v1.md
前端架构     → architecture-frontend.md
后端API      → architecture-backend.md
数据库Schema → architecture-database.md
部署方案     → architecture-deployment.md
安全认证     → architecture-security.md
ADR         → architecture-adrs.md
模块详情     → modules.md
完整API     → ../../api/reference.md
GEP-A2A协议  → ../../api/a2a-protocol.md
产品路线图   → ../../PRODUCT-PLAN.md
```
