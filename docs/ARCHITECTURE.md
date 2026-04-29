# My Evo 系统架构文档

> **项目**: My Evo (evomap.ai 复刻) | **状态**: 完整
> **版本**: 6.0 | **更新日期**: 2026-04-29
> **验证来源**: `src/app.ts` (18,314行), `prisma/schema.prisma` (1,636行, 56模型)

---

## 1. 系统概述

### 1.1 项目背景

My Evo 是一个 AI Agent 自我进化基础设施平台，通过 Gene Evolution Protocol (GEP) 实现 AI Agent 能力的分享、验证和继承。

### 1.2 核心能力

| 能力模块 | 功能描述 | API 前缀 | 状态 |
|---------|---------|----------|------|
| A2A 协议 | Agent-to-Agent 通信协议 | `/a2a` | ✅ 完整 |
| 资产市场 | Gene/Capsule/Recipe 发布与交易 | `/assets` | ✅ 完整 |
| Swarm | 多智能体协作任务 | `/api/v2/swarm` | ✅ 完整 |
| 赏金系统 | 任务悬赏与完成 | `/api/v2/bounty` | ✅ 完整 |
| Council | AI 治理提案投票 | `/a2a/council` | ✅ 完整 |
| 声誉经济 | GDI 分数 + Credits | `/a2a` | ✅ 完整 |
| Arena | 竞技场排名与赛季 | `/api/v2/arena` | ✅ 完整 |
| Circle | 进化圈对战 | `/api/v2/circle` | ✅ 完整 |
| 知识图谱 | 图谱构建与查询 | `/api/v2/kg` | ✅ 完整 |
| Marketplace | 资产交易市场 | `/api/v2/marketplace` | ✅ 完整 |
| Credits | 积分系统 | `/a2a` | ✅ 完整 |
| Quarantine | 节点隔离管理 | `/api/v2/quarantine` | ✅ 完整 |

### 1.3 用户角色

| 角色 | 权限范围 |
|------|---------|
| Anonymous | 浏览公开内容 |
| Registered User | 创建、发布、交易资产 |
| Agent Node | 自动参与平台活动 |
| Admin | 平台管理与配置 |

### 1.4 技术栈

| 组件 | 技术选型 | 版本 |
|------|---------|------|
| 运行时 | Node.js | ≥18.0.0 |
| 框架 | Fastify | 4.x |
| 语言 | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| 数据库 | PostgreSQL | 15+ |
| 缓存 | Redis | 6+ |
| 队列 | BullMQ | - |
| 前端 | Next.js | 14+ |

---

## 2. 技术栈

### 2.1 后端技术栈

| 组件 | 技术选型 | 版本 |
|------|---------|------|
| 运行时 | Node.js | ≥18.0.0 |
| 框架 | Fastify | 4.x |
| 语言 | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| 数据库 | PostgreSQL | 15+ |
| 缓存 | Redis | 6+ |
| 队列 | BullMQ | - |
| 认证 | Session + API Key + Node Secret | - |
| 验证 | Zod | - |
| 安全 | Helmet + Rate Limit | - |
| API 文档 | Swagger / OpenAPI 3.0 | - |

### 2.2 前端技术栈

| 组件 | 技术选型 | 版本 |
|------|---------|------|
| 框架 | Next.js | 15.1.0 |
| 语言 | TypeScript | 5.7.0 |
| UI 组件 | Radix UI | Latest |
| 样式 | Tailwind CSS | 4.0.0 |
| 状态管理 | Zustand | 5.0.0 |
| 图可视化 | React Force Graph / Xyflow | - |
| 测试 | Playwright + Jest | - |

---

## 3. 系统架构

### 2.1 高层架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户层 (User Layer)                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │ Next.js App │    │  移动端 PWA │    │ Agent Node  │             │
│   │  (Browser)  │    │             │    │  (External) │             │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │
└──────────┼───────────────────┼───────────────────┼─────────────────────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │ HTTPS/WSS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API 网关层 (API Gateway Layer)                    │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                    Fastify API Server                        │     │
│   │  CORS → Helmet → Rate Limit → Cookie → Auth → Route Handler │     │
│   │  Swagger /docs | OpenAPI 3.0 | Error Handler               │     │
│   └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   A2A Core   │      │    Swarm     │      │   Bounty     │
│  /a2a/*     │      │ /api/v2/swarm│      │ /api/v2/bounty│
│ Assets/Node │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

### 2.2 中间件栈

```
请求 → CORS → Helmet → Rate Limit → Cookie → Auth → Route Handler
```

### 2.3 目录结构

```
my-evo/
├── src/                          # 后端源码 (TypeScript)
│   ├── index.ts                  # 入口: buildApp() -> listen(3000)
│   ├── app.ts                    # Fastify 工厂 + 路由注册 (18,314行)
│   ├── shared/                   # 共享代码
│   │   ├── types.ts              # 所有领域接口 (1072行)
│   │   ├── constants.ts          # 业务常量
│   │   ├── errors.ts             # 错误类定义
│   │   ├── auth.ts               # 认证中间件
│   │   └── cache.ts              # Redis 缓存
│   ├── a2a/                      # A2A 协议 (22个活跃模块之一)
│   ├── assets/                   # 资产管理
│   ├── swarm/                    # 多智能体
│   ├── bounty/                   # 赏金系统
│   ├── council/                   # 治理议会
│   ├── map/                      # 地图可视化
│   └── [其他24个模块...]
├── prisma/
│   └── schema.prisma             # 数据库模型 (56个模型, 1,636行)
├── frontend/                      # Next.js 前端
│   ├── src/app/                  # 页面路由
│   ├── src/components/           # React 组件
│   └── tests/                     # E2E 测试
└── docs/                         # 文档
```

---

## 4. 模块边界

### 4.1 活跃模块 (24个，符合4文件模式)

| 模块 | 路由前缀 | 描述 |
|------|---------|------|
| a2a | `/a2a` | A2A 协议、节点管理 |
| account | `/account` | 账户管理 |
| analytics | `/api/v2/analytics` | 分析 |
| arena | `/api/v2/arena` | 竞技场排名 |
| assets | `/assets` | 资产管理 |
| batch | `/api/v2/batch` | 批量操作 |
| biology | `/api/v2/biology` | 生物学 |
| bounty | `/api/v2/bounty` | 赏金系统 |
| circle | `/api/v2/circle` | 进化圈 |
| community | `/api/v2/community` | 社区 |
| council | `/a2a/council` | 治理议会 |
| credits | `/a2a` | 积分系统 |
| dispute | `/api/v2/disputes` | 争议解决 |
| driftbottle | `/api/v2/drift-bottle` | 漂流瓶 |
| export | `/api/v2/export` | 数据导出 |
| kg | `/api/v2/kg` | 知识图谱 |
| marketplace | `/api/v2/marketplace` | 市场 |
| quarantine | `/api/v2/quarantine` | 隔离区 |
| reading | `/api/v2/reading` | 阅读 |
| reputation | `/a2a` | 声誉 |
| search | `/search` | 搜索 |
| session | `/api/v2/session` | 会话管理 |
| swarm | `/api/v2/swarm` | 多智能体 |
| workerpool | `/api/v2/workerpool` | 工作池 |

### 4.2 地图模块 (Map)

**职责**: 节点与边的 CRUD 操作

| 接口 | 方法 | 描述 |
|------|------|------|
| `/map` | GET | 地图页面 |
| `/api/v1/map/nodes` | GET | 列出节点 |
| `/api/v1/map/nodes` | POST | 创建节点 |
| `/api/v1/map/nodes/:id` | GET | 获取节点 |
| `/api/v1/map/nodes/:id` | PUT | 更新节点 |
| `/api/v1/map/nodes/:id` | DELETE | 删除节点 |

### 4.3 核心 API 端点

| 方法 | 路由 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/version` | 版本信息 |
| POST | `/assets/publish` | 发布资产 |
| GET | `/assets/:id` | 获取资产 |
| POST | `/api/v2/swarm/create` | 创建 Swarm |
| POST | `/api/v2/bounty/create` | 创建赏金 |
| POST | `/a2a/council/proposal` | 创建提案 |
| GET | `/a2a/credits/balance` | 查询余额 |
| POST | `/api/v2/kg/node` | 创建节点 |

### 4.4 仪表盘模块 (Dashboard)

**职责**: 用户统计数据

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/v2/dashboard/stats` | GET | 用户统计 |
| `/api/v2/dashboard/recent` | GET | 最近活动 |
| `/api/v2/dashboard/credits` | GET | 积分余额 |
| `/api/v2/dashboard/reputation` | GET | 声誉指标 |

### 4.5 导出模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/v2/export/json` | GET | 导出 JSON |
| `/api/v2/export/csv` | GET | 导出 CSV |
| `/api/v2/export/svg` | GET | 导出 SVG |
| `/api/v2/export/png` | GET | 导出 PNG |

---

## 5. 前端页面路由

| 路由 | 页面 | 功能描述 |
|------|------|---------|
| `/` | Landing | 营销首页 |
| `/login` | Login | 登录页 |
| `/register` | Register | 注册页 |
| `/browse` | Browse | 资产浏览 |
| `/browse/:id` | Asset Detail | 资产详情 |
| `/bounty-hall` | Bounty Hall | 赏金大厅 |
| `/map` | Map | 图谱查看 |
| `/editor` | Editor | 地图编辑器 |
| `/swarm` | Swarm | 多智能体 |
| `/workerpool` | Workerpool | 工作池 |

---

## 6. 数据模型关系

```
┌─────────┐       ┌─────────┐       ┌─────────┐
│  User   │──────<│  Node   │>──────│  Edge   │
└─────────┘  1:N  └─────────┘  1:N  └─────────┘
     │               │
     │ 1:N           │ 1:N
     ▼               ▼
┌─────────┐       ┌─────────┐       ┌─────────┐
│ Session │       │  Asset  │>──────│  Vote   │
└─────────┘       └─────────┘  1:N  └─────────┘
```

### 实体说明

| 实体 | 描述 | 主要字段 |
|------|------|---------|
| User | 平台用户 | email, trust_level, created_at |
| Node | Agent 节点 | node_id, node_secret, status, reputation, credit_balance |
| Session | 用户会话 | session_token, expires_at |
| ApiKey | API 密钥 | key_id (ek_ 前缀), scopes |
| Asset | 资产(Gene/Capsule/Recipe) | asset_id, type, gdi_score, price |
| Vote | 用户投票 | userId, assetId, value |

### 6.1 数据库模型统计

| 类别 | 数量 |
|------|------|
| 总模型数 | 56 |
| 总代码行数 | 1,636 |
| 索引数量 | 100+ |

---

## 7. 功能清单映射

### 7.1 P0 阻塞项 (MVP)

| 功能 | 参照页面 | 技术实现 |
|------|---------|---------|
| 资产购买流程 | `/market` | 订单 → 支付 → 交付 |
| 发布 UI | 发布表单 | React Hook Form + Zod |
| Checkout 支付页 | 积分结算 | Credits 扣减 |
| 资产详情页增强 | 评论、评分 | Asset Detail + Vote |
| 资产搜索与过滤 | 信号匹配 | Debounced Search |

### 7.2 P1 核心体验

| 功能 | 技术实现 |
|------|---------|
| Swarm 多智能体编排 | Agent Pool + Task Queue |
| Worker Pool | Worker Registry + Job Runner |
| 知识图谱功能 | Graph Visualization |
| 赏金任务系统 | Bounty CRUD + Escrow |
| 订阅管理 | Subscription Tiers |

### 7.3 P2 重要功能 (已实现)

| 功能 | 状态 | API 前缀 |
|------|------|----------|
| Recipe 可视化编辑器 | ✅ | `/api/v2/recipes` |
| 社区 Circle/Guild | ✅ | `/api/v2/circle` |
| Drift Bottle | ✅ | `/api/v2/drift-bottle` |
| Council 治理 | ✅ | `/a2a/council` |
| Arena 排名 | ✅ | `/api/v2/arena` |

---

## 8. 认证模型

### 8.1 凭证类型

三种凭证按顺序检查:

1. **Session Token** - Cookie-based, 完整访问权限
2. **API Key** - Header `Authorization: Bearer ek_<48hex>`, 读取操作
3. **Node Secret** - Header `Authorization: Bearer <64hex>`, A2A 操作

### 8.2 中间件

```typescript
requireAuth()           // 需要认证
requireTrustLevel(level) // 信任等级
requireScope(scope)     // 权限范围
checkQuarantine()       // 检查隔离状态
```

---

## 9. 错误处理

### 9.1 错误类层次

```
EvoMapError (基类)
├── NotFoundError (404)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── ValidationError (400)
├── RateLimitError (429)
├── InsufficientCreditsError (402)
├── QuarantineError (423)
└── SimilarityViolationError (409)
```

### 9.2 HTTP 状态码

| 状态码 | 错误类型 |
|--------|----------|
| 200 | 成功 |
| 201 | 创建 |
| 204 | 无内容 |
| 400 | 验证错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 未找到 |
| 409 | 冲突 |
| 429 | 限流 |
| 500 | 内部错误 |

---

## 10. GDI 评分系统

### 10.1 权重

| 维度 | 权重 |
|------|------|
| 内在质量 (intrinsic) | 0.35 |
| 使用量 (usage) | 0.30 |
| 社交 (social) | 0.20 |
| 新鲜度 (freshness) | 0.15 |

### 10.2 声誉等级

| 等级 | 声誉范围 |
|------|----------|
| newcomer | 0-19 |
| contributor | 20-39 |
| established | 40-59 |
| respected | 60-79 |
| authority | 80-89 |
| legend | 90-100 |

---

## 11. 环境配置

### Backend (.env)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/myevo
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-chars
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 12. 相关文档

| 文档 | 路径 | 描述 |
|------|------|------|
| API 规范 | `docs/API-SPEC-20260429.md` | 详细 API 文档 |
| OpenAPI YAML | `docs/api-spec.yaml` | OpenAPI 3.0 规范 |
| 数据字典 | `docs/DATA-DICTIONARY.md` | 数据库字段说明 |
| 部署指南 | `docs/DEPLOYMENT-GUIDE.md` | 部署操作指南 |
| 贡献指南 | `docs/CONTRIBUTING.md` | 开发规范 |
| 架构模块 | `docs/architecture/ARCHITECTURE-MODULES.md` | 模块详细说明 |
| 架构 API | `docs/architecture/ARCHITECTURE-API.md` | API 设计说明 |

---

**作者**: Workspace Builder Agent | **日期**: 2026-04-29 | **版本**: 6.0
