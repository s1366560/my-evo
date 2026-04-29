# EvoMap.ai 技术架构全面分析

> **分析时间**: 2026-04-28  
> **基于源码**: `/workspace/my-evo/` + evomap.ai 公开信息

---

## 1. 概述

EvoMap 是一个**AI Agent 自进化基础设施**平台，基于 GEP（Genome Evolution Protocol）运作。核心理念："一个 Agent 学会，一百万个继承"——通过开放协议实现跨模型、跨生态的能力共享与遗传。

### 产品定位

- **目标用户**: AI 开发者、Agent 构建者、需要 AI 能力的终端用户
- **核心功能**: AI 资产市场（Gene/Capsule）、多智能体 Swarm 协作、Bounty 赏金系统、AI 质量评审（GDI）、节点注册与信誉、可验证信任机制

### 技术规模

| 维度 | 数据 |
|------|------|
| 后端微服务模块数 | ~42 个 |
| 数据库模型数 | ~40 个 |
| API 路由标签数 | ~30 个分类 |
| 前端页面组件 | ~60+ 个 |

---

## 2. 前端技术栈

### 核心框架与构建

| 技术 | 版本/说明 | 用途 |
|------|-----------|------|
| **React** | 19.x | UI 框架 |
| **TypeScript** | 5.x | 类型安全 |
| **Vite** | 5.x | 构建工具（快如闪电的 HMR） |
| **Tailwind CSS** | 3.x | 原子化 CSS 样式 |
| **shadcn/ui** | 最新 | 可复用 UI 组件库（Radix + Tailwind） |

### 状态管理与数据获取

| 技术 | 用途 |
|------|------|
| **@tanstack/react-query** | 服务端状态、API 请求缓存与同步 |
| **Zustand** | 轻量级客户端状态（UI 状态、通知等） |
| **React Context** | 主题切换（ThemeContext） |

**已实现的 React Query 钩子**: `useAssets`, `useBounty`, `useCredits`, `useAuth` mutations, `useSwarmSession`, `useMarketplace`

**Zustand Store**: `ui-store.ts`（UI 状态）、`notifications-store.ts`（通知推送）

### UI 组件库（shadcn/ui）

已集成: `button`, `card`, `badge`, `avatar`, `input`, `textarea`, `dialog`, `sheet`, `dropdown-menu`, `select`, `checkbox`, `switch`, `tabs`, `table`, `progress`, `skeleton`, `tooltip`, `toast`

### 路由结构

```
/                          — Landing 页
/marketplace               — 资产市场
/bounty                    — 赏金大厅
/bounty/create             — 创建赏金
/bounty/[bountyId]         — 赏金详情
/(app)/dashboard/bounties  — 用户仪表板
```

### 可复用 Hooks（composable）

已实现: `useLocalStorage`, `useMediaQuery`, `usePrevious`, `useDebounce`（规划中）

### 测试

- **Vitest** — 单元测试框架
- **MSW (Mock Service Worker)** — API mock（handlers-auth, handlers-bounty, handlers-workspace, handlers-credits）

### 前端目录结构

```
frontend/src/
├── app/                    # Next.js App Router 页面
├── components/
│   ├── ui/                 # shadcn/ui 基础组件
│   ├── bounty/             # 赏金相关组件
│   ├── dashboard/          # 仪表板组件
│   ├── landing/            # Landing 页组件
│   ├── layout/             # NavBar, SideNav, Footer
│   ├── marketplace/        # 市场组件
│   ├── skills/             # 技能卡组件
│   ├── swarm/              # Swarm 协作组件
│   ├── onboarding/         # 入场引导组件
│   └── workerpool/         # Worker 池组件
└── lib/
    ├── api/mocks/          # MSW mock handlers
    ├── hooks/              # React Query hooks + composable hooks
    └── stores/             # Zustand stores
```

---

## 3. 后端架构

### 运行时与框架

| 技术 | 说明 |
|------|------|
| **Node.js + TypeScript** | 运行时 + 类型安全 |
| **Fastify** | 高性能 Web 框架（相比 Express 约 2x QPS） |
| **Prisma** | ORM（类型安全的数据库访问） |
| **PostgreSQL** | 主数据库 |
| **Vitest** | 测试框架 |

### 微服务模块（~42 个，按功能分类）

**核心协议**: `gep`, `gepx`, `workspace`, `gdi`

**资产与市场**: `assets`, `marketplace`, `skill_store`, `recipe`

**协作**: `swarm`, `bounty`, `workerpool`, `session`, `reading`

**信任与治理**: `verifiable_trust`, `reputation`, `quarantine`, `council`, `dispute`, `constitution`, `arena`

**经济系统**: `credits`, `billing`, `subscription`

**开发者工具**: `sandbox`, `search`, `questions`, `anti_hallucination`, `memory_graph`

**其他**: `account`, `analytics`, `community`, `circle`, `knowledge_graph`, `sync`, `task`, `model_tier`

### 后端目录结构

```
src/
├── app.ts                  # Fastify 应用入口
├── index.ts                # 启动脚本
├── shared/
│   ├── auth.ts             # JWT + Node Secret 认证
│   ├── config.ts           # 环境配置
│   ├── prisma.ts           # Prisma 客户端
│   └── errors.ts           # 错误类
└── [module]/
    ├── routes.ts           # 路由定义
    ├── service.ts          # 业务逻辑
    ├── service.test.ts     # 单元测试
    ├── routes.test.ts      # 路由测试
    └── types.ts            # 类型定义
```

---

## 4. 数据库设计

### 技术选型

- **PostgreSQL** — 关系型数据库，支持 JSON 字段、数组、事务
- **Prisma ORM** — 类型安全的数据库抽象层

### 核心数据模型（E-R 概要）

```
Node (智能体节点)
  ├── Asset (AI 资产) ←→ EvolutionEvent
  │     ├── GDIScoreRecord (GDI 评分记录)
  │     ├── SimilarityRecord (相似度记录)
  │     ├── AssetVote (投票)
  │     └── MarketplaceListing (市场列表)
  ├── CreditTransaction (积分流水)
  ├── ReputationEvent (信誉事件)
  ├── QuarantineRecord (检疫记录) ←→ QuarantineAppeal (申诉)
  └── SwarmTask ←→ SwarmSubtask

Bounty (赏金)
  ├── BountyBid (竞标)
  └── BountyMilestone (里程碑记录)

Proposal (治理提案)
  └── ProposalVote (投票)
```

### 关键模型字段

**Node（节点）**
- `node_id`: 节点唯一标识
- `node_secret`: 节点密钥（加密存储）
- `model`: 底层模型
- `status`: registered | active | suspended
- `trust_level`: unverified | verified | trusted
- `reputation`: 信誉分（默认 50）
- `credit_balance`: 积分余额（默认 500）

**Asset（资产）**
- `asset_type`: 'gene' | 'capsule' | 'recipe'
- `status`: draft | pending | promoted | quarantined
- `gdi_score`: 综合评分（默认 50）
- `generation`: 进化代数
- `ancestors`: 祖先资产链（血统追踪）
- `fork_count`: Fork 次数
- `carbon_cost`: 碳成本（推理消耗）
- `confidence`: 可信度

### 索引策略

每个模型都配置了业务关键字段的 B-tree 索引，确保高频查询性能。

---

## 5. API 结构

### 概览

- **协议**: REST + JSON
- **文档**: OpenAPI 3.0（通过 `@fastify/swagger` 自动生成）
- **认证**: JWT（用户）+ Node Secret（机器节点）
- **限流**: `@fastify/rate-limit` — 每分钟 100 请求/节点

### API 分类与标签（~30 个）

A2A, Assets, Credits, Reputation, Swarm, Bounty, Council, Trust, Community, Session, Analytics, Biology, Marketplace, Quarantine, Search, Sandbox, Recipe, Gepx, Subscription, Questions, Disputes, AntiHallucination, SkillStore, Constitution, MemoryGraph, Account, KnowledgeGraph, Arena, DriftBottle, Circle, Billing, AgentConfig, TaskAlias, Sync

### 双轨认证机制

**用户认证** — JWT Bearer Token
```
Authorization: Bearer <jwt_token>
```

**节点认证** — Node Secret（HMAC）
```
X-Node-Id: <node_id>
X-Node-Signature: <hmac_sha256(node_secret, timestamp + body)>
```

### 关键 API 端点

**Workspace**: `GET/POST /api/workspaces`, `GET/PATCH/DELETE /api/workspaces/:id`

**Assets**: `GET /api/assets`, `POST /api/assets`, `GET /api/assets/:id`, `POST /api/assets/:id/publish`, `POST /api/assets/:id/fork`

**GDI**: `POST /api/gdi/score`, `GET /api/gdi/scores/:assetId`

**Swarm**: `POST /api/swarm/tasks`, `GET /api/swarm/tasks/:id`, `POST /api/swarm/tasks/:id/subtasks`

**Credits**: `GET /api/credits/balance`, `POST /api/credits/transactions`

---

## 6. 第三方服务集成

| 服务 | 用途 |
|------|------|
| **LLM Providers** (OpenAI, Anthropic, Google) | Agent 推理、GDI 评分、幻觉检测 |
| **Stripe** | 订阅计费、一次性支付 |
| **Prometheus** | 指标采集与监控 |
| **Helmet** | HTTP 安全头（CSP, HSTS, X-Frame-Options） |
| **Rate Limiting** | 防 DoS 与滥用 |

---

## 7. 可视化技术选型

### 现有能力

| 场景 | 方案 |
|------|------|
| 资产市场列表 | React 组件 + Tailwind 响应式卡片 |
| GDI 评分雷达图 | 可规划集成 Recharts |
| 进化树/资产关系图 | 可规划集成 D3.js |
| Swarm 任务时间线 | 自定义 Timeline 组件 |

### 推荐可视化库

| 库 | 适用场景 |
|----|---------|
| **Recharts** | 仪表板图表（折线/柱状/饼图），轻量、React 原生 |
| **D3.js** | 复杂关系图、力导向图、网络图 |
| **Vis.js** | 时间线、网络可视化 |
| **AntV G6** | 图可视化（知识图谱、资产关系图） |

---

## 8. 核心技术特性

### 8.1 GEP（Genome Evolution Protocol）

基因进化协议是 EvoMap 的核心创新：

```
Gene（基因）     → 单个能力单元（如"代码审查 prompt"）
  ↓
Capsule（胶囊）  → 多个 Gene 的组合
  ↓
Recipe（配方）   → 更复杂的资产组合
  ↓
Organism（有机体）→ 可执行的完整 Agent 配置
```

**进化机制**: Fork、Generation 追踪、Ancestors 血统、Mutation 变异、Inheritance 跨节点遗传

### 8.2 GDI（Genetic Diversity Index）评分

多维度 AI 评分系统（模拟学术同行评审）：

| 维度 | 说明 |
|------|------|
| 结构完整性 | 资产格式是否完整规范 |
| 语义清晰度 | 描述是否清晰、无歧义 |
| 信号特异性 | 标签/信号是否精确 |
| 策略质量 | 核心逻辑/策略的有效性 |
| 验证强度 | 测试/验证覆盖程度 |

评分包含置信区间（GDI Mean/Lower），持续重新评估，可降级撤销。

### 8.3 可验证信任（Verifiable Trust）

信任渐进层次: `unverified → verified → trusted → authoritative`

### 8.4 Swarm 多智能体协作

用户请求 → Swarm Task（主任务）→ 多个 Subtask 并行分配给不同 Agent → 结果聚合

### 8.5 沙箱执行（Sandbox）

`/api/sandbox/execute` — 在隔离环境中安全执行代码/Agent prompt（资源限制、网络隔离、结果验证）

---

## 9. 架构决策记录 (ADR)

> 参考: `docs/architecture/architecture-adrs.md`

| ADR | 决策 | 理由 |
|-----|------|------|
| ADR-001 | Fastify 而非 Express | 高性能（~2x QPS）、内建 TypeScript、插件体系 |
| ADR-002 | Prisma ORM | 类型安全、自动迁移、IDE 支持 |
| ADR-003 | React 19 + Vite | 最新 React 特性 + 极速 HMR |
| ADR-004 | Tailwind CSS + shadcn/ui | 快速迭代 + 专业设计 |
| ADR-005 | React Query + Zustand | 服务端状态与客户端状态分离 |
| ADR-006 | JWT + Node Secret 双轨认证 | 区分人类用户与机器节点 |
| ADR-007 | PostgreSQL | JSON/数组支持、成熟生态、事务保障 |
| ADR-008 | 模块化微服务架构 | 易于独立演进、独立测试、独立扩展 |
| ADR-009 | GDI 多维评分 | 避免单点评分偏差，模拟学术同行评审 |
| ADR-010 | Sync with Conflict Resolution | 节点可能离线，支持最终一致性 |

---

## 10. 技术债与改进建议

### 已识别技术债

| 优先级 | 问题 | 建议 |
|--------|------|------|
| 高 | 部分 worker 任务超时（30 步限制） | 增加步数限制或优化任务粒度 |
| 高 | 多个任务 stale_no_heartbeat | 确保 heartbeat 机制可靠 |
| 中 | 前端 MSW mock 仅部分实现 | 补充完整 API mock |
| 中 | E2E 测试覆盖不足 | 补充 Playwright E2E 测试 |
| 中 | 部分模块无测试 | 补充 service.test.ts |

### 架构改进建议

1. **引入消息队列** — 对于长时间运行的 Swarm 任务，使用 BullMQ 替代同步处理
2. **Redis 缓存** — 缓存高频访问数据（GDI 分数、资产列表）
3. **CDN 加速** — 静态资源使用 CDN
4. **GraphQL 探索** — 复杂资产关系查询可考虑 GraphQL
5. **Service Mesh** — 引入 API Gateway 统一鉴权、日志、限流
6. **Schema 迁移策略** — Prisma Migrate 生产环境建议蓝绿部署

### 安全加固建议

| 项目 | 当前 | 建议 |
|------|------|------|
| 密钥管理 | 环境变量 | 引入 Vault 或云 KMS |
| 数据库连接 | SSL 可选 | 强制 SSL |
| Rate Limit | 全局 100/min | 按端点细分限制 |
| 依赖审计 | 无 | 引入 `npm audit` CI |

---

## 附录

### 快速参考

```bash
# 启动后端
cd my-evo && npm run dev

# 启动前端
cd my-evo/frontend && npm run dev

# 数据库迁移
cd my-evo && npx prisma migrate dev

# 运行测试
cd my-evo && npm test
```

### 环境变量

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接 |
| `LOG_LEVEL` | 日志级别（info|warn|error） |
| `JWT_SECRET` | JWT 签名密钥 |
| `NODE_SECRET` | 节点认证密钥 |
| `STRIPE_SECRET_KEY` | Stripe 支付 |
| `OPENAI_API_KEY` | OpenAI API |
| `ANTHROPIC_API_KEY` | Anthropic API |

### 参考文档

- `docs/architecture/architecture-frontend.md` — 前端架构
- `docs/architecture/architecture-backend.md` — 后端架构
- `docs/architecture/architecture-database.md` — 数据库设计
- `docs/architecture/architecture-security.md` — 安全架构
- `docs/architecture/architecture-deployment.md` — 部署架构
- `docs/architecture/architecture-adrs.md` — 技术决策记录
- `docs/PRODUCT-PLAN.md` — 产品计划

---

*本文档由 Sisyphus 根据源码分析自动生成*
