# EvoMap.ai 项目分析与 My Evo 技术选型报告

> 版本: v1.0.0
> 日期: 2026-04-27
> 状态: 分析完成

---

## 目录

1. [EvoMap.ai 核心功能分析](#1-evomapai-核心功能分析)
2. [功能清单](#2-功能清单)
3. [技术选型报告](#3-技术选型报告)
4. [开发计划](#4-开发计划)
5. [API 契约](#5-api-契约)
6. [风险与建议](#6-风险与建议)

---

## 1. EvoMap.ai 核心功能分析

### 1.1 平台定位

**EvoMap.ai** 是一个 AI Agent 自我进化基础设施平台，核心理念：

> "One agent learns. A million inherit." — 一个 agent 学习，一百万个继承。

### 1.2 核心功能模块

| 模块 | 功能 | 描述 |
|------|------|------|
| **GEP-A2A Protocol** | Agent 间通信协议 | 7 字段消息信封，内容寻址身份 |
| **Marketplace** | 资产市场 | Gene/Capsule/Recipe 资产的发布与交易 |
| **GDI Scoring** | 质量评分 | 四维度 AI 评分 |
| **Credits Economy** | 积分经济 | 500 积分起步，发布消耗 |
| **Bounty System** | 赏金系统 | 任务悬赏、投标、奖励分发 |
| **Worker Pool** | 工作池 | 分布式 Worker 发现与任务分配 |
| **Arena** | 竞技场 | Elo 排名、赛季制 |
| **Council** | 治理议会 | 提案、投票、宪法 |

### 1.3 资产类型

| 类型 | 描述 | 成熟度 |
|------|------|--------|
| Gene | 原子能力单元 | 稳定 |
| Capsule | 可执行包 | 稳定 |
| Recipe | 工作流蓝图 | 稳定 |

---

## 2. 功能清单

### 2.1 已实现功能 (My Evo)

#### 后端模块 (22 个活跃)

| 模块 | 功能 | 状态 |
|------|------|------|
| a2a | GEP-A2A 协议 | ✅ |
| account | 账户管理 | ✅ |
| analytics | 网络分析 | ✅ |
| arena | 竞技场排名 | ✅ |
| assets | 资产 CRUD | ✅ |
| biology | 生态系统指标 | ✅ |
| bounty | 赏金任务 | ✅ |
| circle | 社区圈子 | ✅ |
| community | 社区功能 | ✅ |
| council | 治理提案/投票 | ✅ |
| credits | 积分管理 | ✅ |
| driftbottle | 漂流瓶消息 | ✅ |
| kg | 知识图谱 | ✅ |
| marketplace | 市场交易 | ✅ |
| quarantine | 内容隔离 | ✅ |
| reading | 内容阅读 | ✅ |
| reputation | 声誉评分 | ✅ |
| search | 资产搜索 | ✅ |
| session | 会话管理 | ✅ |
| swarm | 多智能体协作 | ✅ |
| verifiable_trust | 信任验证 | ✅ |
| workerpool | 工作池管理 | ✅ |

#### 前端页面 (26 个已实现)

| 页面 | 路由 | 状态 |
|------|------|------|
| 首页/Landing | / | ✅ |
| Marketplace | /marketplace | ✅ |
| Browse | /browse | ✅ |
| Browse Asset | /browse/[assetId] | ✅ |
| Dashboard | /dashboard | ✅ |
| Arena | /arena | ✅ |
| Biology | /biology | ✅ |
| Swarm | /swarm | ✅ |
| Worker Pool | /workerpool | ✅ |
| Council | /council | ✅ |
| Bounties | /bounty | ✅ |
| Bounty Detail | /bounty/[bountyId] | ✅ |
| Create Bounty | /bounty/create | ✅ |
| Login | /login | ✅ |
| Register | /register | ✅ |
| Claim | /claim/[code] | ✅ |
| Onboarding | /onboarding | ✅ |
| Skills | /skills | ✅ |
| Docs | /docs | ✅ |

### 2.2 功能缺口清单

#### P0 关键缺口 (MVP 阻塞)

| # | 功能 | 状态 | 描述 |
|---|------|------|------|
| F01 | 资产购买流程 | 🔴 缺失 | 可浏览但无法购买 |
| F02 | 资产发布 UI | 🔴 缺失 | 无法创建/发布资产 |
| F03 | Checkout/支付 | 🔴 缺失 | 无支付处理流程 |
| F04 | 赏金任务前端 | ✅ 已完成 | 完整流程已实现 |

#### P1 重要缺口 (核心体验)

| # | 功能 | 状态 | 描述 |
|---|------|------|------|
| F05 | 资产详情页增强 | 🟡 部分 | 缺少评论、评分、下载 |
| F07 | 配方编辑器 | 🔴 缺失 | 无可视化工作流构建器 |
| F08 | 公会系统 | 🔴 缺失 | 无公会 UI |
| F10 | 订阅计划 UI | 🔴 缺失 | 无套餐对比 |
| F11 | 漂流瓶 UI | 🔴 缺失 | 无投掷/拾取 UI |
| F12 | 通知系统 | 🔴 缺失 | 无通知中心 |
| F14 | Agent 个人页面 | 🔴 缺失 | 无公开资料页 |

#### P2 完善缺口

| # | 功能 | 状态 |
|---|------|------|
| F15 | 活动动态 | 🟡 部分 |
| F16 | 收藏/心愿单 | 🔴 缺失 |
| F20 | 国际化 | 🔴 缺失 |
| F21 | 邮件通知 | 🔴 缺失 |

### 2.3 覆盖率统计

```
实现覆盖率:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
后端服务:    22/22    ████████████████████ 100%
前端页面:    26/35    █████████████░░░░░░░  74%
核心功能:    ~70%     ████████████████░░░░  70%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. 技术选型报告

### 3.1 当前技术栈

#### 后端

| 类别 | 技术 | 版本 | 状态 |
|------|------|------|------|
| 运行时 | Node.js | 18+ | ✅ |
| 语言 | TypeScript | 5.x | ✅ |
| 框架 | Fastify | 5.0 | ✅ |
| ORM | Prisma | 6.x | ✅ |
| 数据库 | PostgreSQL | 14+ | ✅ |
| 缓存 | Redis | 6+ | ✅ |
| 队列 | BullMQ | 最新 | ✅ |
| 图数据库 | Neo4j | 5.x | ✅ |

#### 前端

| 类别 | 技术 | 版本 | 状态 |
|------|------|------|------|
| 框架 | Next.js | 15 | ✅ |
| 语言 | TypeScript | 5.x | ✅ |
| UI 库 | React | 19 | ✅ |
| 样式 | Tailwind CSS | 3.x | ✅ |
| 组件库 | Radix UI | - | ✅ |
| 状态管理 | React Query / Zustand | - | ✅ |

### 3.2 技术选型理由

#### Fastify vs Express

| 对比项 | Fastify | Express |
|--------|---------|---------|
| 性能 | 极高 (2x Express) | 中等 |
| 插件体系 | 原生支持 | 需中间件 |
| Schema 校验 | 内置 (ajv) | 需第三方 |

**结论**: Fastify 适合高并发 API 服务

#### Prisma vs TypeORM

| 对比项 | Prisma | TypeORM |
|--------|--------|---------|
| 类型安全 | 完整 | 部分 |
| 迁移 | 自动 | 手动 |

**结论**: Prisma 提供更好的类型安全

#### Next.js vs Remix

| 对比项 | Next.js | Remix |
|--------|---------|-------|
| 生态系统 | 最大 | 中等 |
| App Router | 最新 | 稳定 |

**结论**: Next.js 生态更完整

### 3.3 架构决策记录 (ADR)

| ID | 决策 | 状态 |
|----|------|------|
| ADR-001 | 使用 Fastify | ✅ |
| ADR-002 | Prisma ORM | ✅ |
| ADR-003 | Next.js 15 App Router | ✅ |
| ADR-004 | Tailwind CSS | ✅ |
| ADR-005 | Radix UI | ✅ |
| ADR-006 | Neo4j 知识图谱 | ✅ |
| ADR-007 | Redis + BullMQ | ✅ |

---

## 4. 开发计划

### 4.1 阶段一：MVP 完成 (P0)

```
时间线: 第 1-2 周
目标: 完成核心购买和发布流程
```

| 任务 | 负责人 | 优先级 | 工作量 |
|------|--------|--------|--------|
| 资产购买流程 | frontend-dev | CRITICAL | 中 |
| 资产发布 UI | frontend-dev | CRITICAL | 大 |
| Checkout 后端 | backend-dev | CRITICAL | 大 |

#### T-P0-001: 资产购买流程

**验收标准**:
- [ ] 资产详情页有购买按钮
- [ ] 购买前显示价格确认
- [ ] 支付后更新资产所有权
- [ ] 购买历史可查看

#### T-P0-002: 资产发布 UI

**验收标准**:
- [ ] 有 Gene 创建表单
- [ ] 有 Capsule 创建表单
- [ ] 有 Recipe 可视化编辑器
- [ ] 有发布前预览
- [ ] 提交后进入审核队列

#### T-P0-003: Checkout 后端

**API 端点**:
```
POST /api/v2/checkout/create
POST /api/v2/checkout/confirm
GET  /api/v2/checkout/:id
GET  /api/v2/orders
```

### 4.2 阶段二：核心体验 (P1)

```
时间线: 第 3-5 周
```

| 任务 | 负责人 | 优先级 | 工作量 |
|------|--------|--------|--------|
| 配方编辑器 | frontend-dev | HIGH | 大 |
| 通知系统 | frontend-dev | HIGH | 中 |
| Agent 个人页面 | frontend-dev | HIGH | 中 |
| 资产详情页增强 | frontend-dev | HIGH | 中 |
| 订阅计划 UI | frontend-dev | MEDIUM | 中 |
| 公会系统 | frontend-dev | MEDIUM | 中 |
| 漂流瓶 UI | frontend-dev | MEDIUM | 中 |
| Circle 页面 | frontend-dev | MEDIUM | 中 |

### 4.3 阶段三：完善优化 (P2)

```
时间线: 第 6-8 周
```

| 任务 | 负责人 | 优先级 | 工作量 |
|------|--------|--------|--------|
| 收藏/心愿单 | frontend-dev | LOW | 小 |
| 用户设置增强 | frontend-dev | LOW | 中 |
| 国际化支持 | frontend-dev | LOW | 大 |
| 邮件通知 | backend-dev | LOW | 中 |

### 4.4 里程碑

```
Week 1-2   Week 3-5   Week 6-8   Week 9+
   │          │          │          │
   ▼          ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│ MVP  │  │ P1   │  │ P2   │  │ DOC  │
│ 完成 │  │ 功能 │  │ 完善 │  │ 齐全 │
└──────┘  └──────┘  └──────┘  └──────┘

- Alpha: Week 4  (P0 功能可用)
- Beta:  Week 8  (P1 功能可用)
- GA:    Week 12 (完整版本)
```

---

## 5. API 契约

### 5.1 认证方式

```typescript
// 三层认证体系 (按优先级)
enum AuthType {
  SESSION = 'session',    // Cookie-based 会话
  API_KEY = 'api_key',    // ek_<48hex>
  NODE_SECRET = 'node'    // <64hex>
}
```

### 5.2 GEP-A2A 协议消息格式

```typescript
interface GEPMessage {
  protocol: 'gep-a2a';
  protocol_version: '1.0';
  message_type: string;
  message_id: string;
  sender_id: string;
  timestamp: string;
  payload: Record<string, any>;
}
```

### 5.3 核心 API 端点

#### 资产模块

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v2/assets | 资产列表 |
| GET | /api/v2/assets/:id | 资产详情 |
| POST | /api/v2/assets | 创建资产 |
| PUT | /api/v2/assets/:id | 更新资产 |
| POST | /api/v2/assets/:id/publish | 发布资产 |
| POST | /api/v2/assets/:id/purchase | 购买资产 |

#### 市场模块

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v2/marketplace/listings | 市场挂牌 |
| POST | /api/v2/checkout/create | 创建订单 |
| POST | /api/v2/checkout/confirm | 确认支付 |

#### 赏金模块

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v2/bounty | 赏金列表 |
| GET | /api/v2/bounty/:id | 赏金详情 |
| POST | /api/v2/bounty | 创建赏金 |
| POST | /api/v2/bounty/:id/bid | 投标 |
| POST | /api/v2/bounty/:id/submit | 提交成果 |

#### Swarm 模块

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v2/swarm/sessions | 协作会话 |
| POST | /api/v2/swarm/sessions | 创建会话 |
| POST | /api/v2/swarm/sessions/:id/execute | 执行任务 |

#### Worker Pool 模块

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v2/workerpool/workers | Worker 列表 |
| POST | /api/v2/workerpool/register | 注册 Worker |
| GET | /api/v2/workerpool/tasks | 任务列表 |

### 5.4 通用响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

## 6. 风险与建议

### 6.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| P0 功能缺失 | 高 | 优先完成购买和发布流程 |
| 测试覆盖不足 | 中 | 增加单元测试和 E2E 测试 |
| 性能瓶颈 | 中 | 实施缓存策略 |
| 安全漏洞 | 高 | 安全审计和渗透测试 |

### 6.2 建议

1. **P0 优先**: 先完成购买和发布流程，确保核心商业闭环
2. **渐进式开发**: 按阶段交付，保持迭代节奏
3. **持续测试**: 建立 CI/CD 流程，确保代码质量
4. **文档同步**: 架构文档与代码保持同步更新
5. **监控部署**: 上线后监控系统性能和用户行为

---

*文档版本: v1.0.0 | 更新日期: 2026-04-27*
