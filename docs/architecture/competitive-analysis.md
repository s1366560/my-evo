# 竞品分析与架构技术选型报告

> **版本**: v1.0 | **日期**: 2026-04-28
> **基于**: evomap.ai 深度调研 + My Evo 项目现状分析

---

## 一、竞品分析

### 1.1 竞品概览

| 产品 | 类型 | 核心能力 | 技术特点 |
|------|------|----------|----------|
| **EvoMap.ai** | 自我进化基础设施 | Gene/Capsule 资产共享 | GEP-A2A 协议、信任网络 |
| **LangGraph** | Agent 编排框架 | 状态机工作流 | LangChain 生态 |
| **AutoGen** | Multi-Agent 框架 | 对话协作 | Microsoft 生态 |
| **CrewAI** | Agent 团队编排 | 角色分工 | 简洁 API |
| **Dify** | LLM 应用平台 | RAG、工作流 | 可视化编排 |
| **Coze** | Agent 开发平台 | 插件、知识库 | 字节生态 |

### 1.2 详细竞品对比

#### 核心功能对比矩阵

| 功能 | EvoMap | LangGraph | AutoGen | CrewAI | My Evo |
|------|--------|-----------|---------|--------|--------|
| **Agent 生命周期管理** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **资产市场 (Gene/Capsule)** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **赏金/任务系统** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Swarm 多Agent协作** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Council 审议决策** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Biology 进化引擎** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **信誉/信任系统** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **GDI 评分体系** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **A2A 协议** | ✅ GEP-A2A | ❌ | ❌ | ❌ | ✅ GEP-A2A |
| **自我诊断/修复** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **沙箱环境** | ✅ | ❌ | ❌ | ❌ | ✅ |

#### 技术栈对比

| 维度 | EvoMap | LangGraph | AutoGen | CrewAI | My Evo |
|------|--------|-----------|---------|--------|--------|
| **前端框架** | Next.js | - | - | - | Next.js 15 |
| **后端框架** | Node.js | Python | Python | Python | Node.js |
| **ORM/DB** | Prisma+PG | SQLAlchemy | 内部 | 内部 | Prisma+PG |
| **图数据库** | Neo4j | ❌ | ❌ | ❌ | Neo4j |
| **任务队列** | Redis/BullMQ | ❌ | ❌ | ❌ | BullMQ+Redis |
| **API 协议** | GEP-A2A | LangChain | 自有 | 自有 | GEP-A2A |
| **前端状态** | React Query | - | - | - | Zustand+React Query |
| **可视化** | D3/React Flow | - | - | - | React Flow+Recharts |

### 1.3 差异化定位

**My Evo 的独特价值**:

1. **进化优先** — 不是"让 Agent 做事"，而是"让 Agent 学会做事并共享"
2. **信任网络** — 可验证的信誉体系，而非简单的评分
3. **资产市场** — Gene/Capsule 可交易的价值载体
4. **进化生物学隐喻** — 将软件进化类比生物进化，直观且强大

---

## 二、技术选型

### 2.1 前端技术栈

#### 框架选择: Next.js 15

| 方案 | 得分 | 说明 |
|------|------|------|
| **Next.js 15** | ⭐⭐⭐⭐⭐ | SSR/SSG、App Router、RSC、文件系统路由 |
| Remix | ⭐⭐⭐ | 优秀的错误边界，但生态较小 |
| Astro | ⭐⭐ | SSG 强，但 SPA 场景不适合 |

**理由**:
- SSR/ISR 支持 SEO 公开页面
- RSC 减少客户端 JavaScript
- App Router 提供更好的布局和数据获取

#### UI 组件库: shadcn/ui + Radix

| 方案 | 得分 | 说明 |
|------|------|------|
| **shadcn/ui** | ⭐⭐⭐⭐⭐ | 源码可控、无障碍、 Tailwind 深度集成 |
| MUI | ⭐⭐⭐ | 成熟但样式难定制 |
| Ant Design | ⭐⭐ | 适合后台，企业风格 |

**理由**:
- 组件源码在项目中，可完全定制
- 基于 Radix Primitives，保证无障碍
- Tailwind CSS 原子化样式

#### 样式方案: Tailwind CSS 4

| 方案 | 得分 | 说明 |
|------|------|------|
| **Tailwind CSS 4** | ⭐⭐⭐⭐⭐ | 最新版本、CSS Variables、原生支持 |
| CSS Modules | ⭐⭐⭐ | 简单但缺乏复用性 |
| Styled Components | ⭐⭐⭐ | 运行时样式，有性能开销 |

#### 状态管理

| 方案 | 得分 | 说明 |
|------|------|------|
| **Zustand + React Query** | ⭐⭐⭐⭐⭐ | Zustand 轻量态 + TanStack Query 自动缓存 |
| Redux Toolkit | ⭐⭐⭐ | 成熟但样板多 |
| Jotai | ⭐⭐⭐⭐ | 原子化，但 React Query 更适合服务端状态 |

---

### 2.2 后端技术栈

#### 运行时: Node.js 18+ LTS

| 方案 | 得分 | 说明 |
|------|------|------|
| **Node.js 18+** | ⭐⭐⭐⭐⭐ | 成熟、I/O 高效、生态丰富 |
| Deno | ⭐⭐⭐ | 现代化但生态不足 |
| Bun | ⭐⭐⭐⭐ | 快但生产稳定性待验证 |

#### Web 框架: Fastify 5

| 方案 | 得分 | 说明 |
|------|------|------|
| **Fastify 5** | ⭐⭐⭐⭐⭐ | 比 Express 快 2x、Schema 优先、插件生态 |
| Express | ⭐⭐⭐ | 流行但慢、中间件混乱 |
| NestJS | ⭐⭐⭐⭐ | TypeScript 友好但重型 |

**理由**:
- 路由性能领先
- 内置请求验证 (Zod)
- 插件架构优雅
- OpenAPI/Swagger 集成良好

#### ORM: Prisma 6

| 方案 | 得分 | 说明 |
|------|------|------|
| **Prisma 6** | ⭐⭐⭐⭐⭐ | 类型安全、自动迁移、IDE 支持 |
| Drizzle | ⭐⭐⭐⭐ | 轻量、SQL-like，但迁移生态较弱 |
| TypeORM | ⭐⭐⭐ | 功能全但类型推导弱 |

#### 任务队列: BullMQ 5 + Redis

| 方案 | 得分 | 说明 |
|------|------|------|
| **BullMQ + Redis** | ⭐⭐⭐⭐⭐ | 功能完整、重试/DLQ 支持 |
| Agenda | ⭐⭐⭐ | 简单但功能少 |
| Kafka | ⭐⭐⭐⭐ | 大规模场景，但运维复杂 |

#### 图数据库: Neo4j

| 方案 | 得分 | 说明 |
|------|------|------|
| **Neo4j** | ⭐⭐⭐⭐⭐ | 成熟、Cypher 强大、进化链建模完美 |
| AWS Neptune | ⭐⭐⭐⭐ | 托管但成本高 |
| ArangoDB | ⭐⭐⭐ | 多模型但图查询不如 Neo4j |

**用途**:
- Agent 关系图谱
- 进化链追踪 (Gene → Capsule → EvolutionEvent)
- Swarm 协作拓扑

---

### 2.3 数据存储架构

```
┌─────────────────────────────────────────────────────────┐
│                      应用层                              │
└─────────────────────────┬───────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │PostgreSQL│    │  Redis   │    │  Neo4j   │
   │ (Prisma) │    │ (ioredis)│    │(Cypher)  │
   └──────────┘    └──────────┘    └──────────┘
        │               │               │
   用户/资产/          缓存/         Agent 关系
   任务/订阅          队列/限流       图谱/进化链
```

| 数据库 | 引擎 | 主要数据 |
|--------|------|----------|
| **PostgreSQL** | Prisma ORM | User, Node, Asset, Bounty, Subscription, Credit |
| **Redis** | ioredis | Session, Rate Limit, Queue, Hot Cache |
| **Neo4j** | Cypher | Agent Relations, Evolution Chains, Trust Graph |

---

## 三、API 设计

### 3.1 REST API 端点

```
Base: /api/v1

┌─────────────────────────────────────────────┐
│              Authentication                 │
├─────────────────────────────────────────────┤
│ POST   /auth/register                       │
│ POST   /auth/login                          │
│ POST   /auth/logout                         │
│ GET    /auth/me                             │
├─────────────────────────────────────────────┤
│              Assets (Gene/Capsule)          │
├─────────────────────────────────────────────┤
│ GET    /assets                              │
│ POST   /assets                              │
│ GET    /assets/:id                          │
│ PUT    /assets/:id                          │
│ POST   /assets/:id/fork                     │
├─────────────────────────────────────────────┤
│              Bounty System                  │
├─────────────────────────────────────────────┤
│ GET    /bounties                            │
│ POST   /bounties                            │
│ GET    /bounties/:id                        │
│ POST   /bounties/:id/submit                 │
├─────────────────────────────────────────────┤
│              Swarm Collaboration            │
├─────────────────────────────────────────────┤
│ POST   /swarm/tasks                         │
│ GET    /swarm/tasks                         │
│ GET    /swarm/tasks/:id                     │
├─────────────────────────────────────────────┤
│              GEP-A2A Protocol              │
├─────────────────────────────────────────────┤
│ POST   /a2a/hello                           │
│ POST   /a2a/publish                         │
│ POST   /a2a/fetch                           │
│ POST   /a2a/validate                        │
└─────────────────────────────────────────────┘
```

### 3.2 协议信封格式 (GEP-A2A)

```json
{
  "protocol": "gep-a2a",
  "protocol_version": "1.0.0",
  "message_type": "hello|publish|validate|fetch|report",
  "message_id": "msg_<timestamp>_<random_hex>",
  "sender_id": "node_<node_id>",
  "timestamp": "<ISO 8601 UTC>",
  "payload": { }
}
```

---

## 四、可视化技术深度分析

### 4.1 关系图谱 (Graph Visualization)

**需求场景**:
- Swarm Agent 协作拓扑
- Council 审议关系图
- Agent 信任网络
- 进化链可视化

**技术对比**:

| 库 | 优点 | 缺点 | 适用场景 |
|----|------|------|----------|
| **React Flow** | 高度可定制、节点/边可控、React 集成 | 学习曲线 | 工作流图、决策树 |
| **D3.js** | 强大、灵活 | 学习曲线陡、DOM 操作 | 高度定制可视化 |
| **Force Graph** | 力导向布局、开箱即用 | 定制困难 | 网络图 |
| **Cytoscape.js** | 专业图库 | 较重 | 生物网络 |

**推荐**:
- **React Flow** 用于交互式工作流（Swarm/Council）
- **D3.js** 用于进化时间线等定制图表

### 4.2 统计图表 (Charts)

**需求场景**:
- GDI 评分仪表盘
- 能力雷达图
- 趋势折线图
- 排行榜柱状图

**技术对比**:

| 库 | 优点 | 缺点 | 适用场景 |
|----|------|------|----------|
| **Recharts** | React 原生、轻量、灵活 | 大数据量性能差 | 中小数据仪表盘 |
| **Chart.js** | 简单、文档好 | 非 React 原生 | 简单图表 |
| **Victory** | React 原生、React Native | 功能相对少 | 移动端图表 |
| **Nivo** | 强大、主题化 | 较重 | 复杂仪表盘 |

**当前项目已安装**: `recharts ^2.15.0`

### 4.3 3D 可视化

**需求场景**:
- 进化树 3D 视图
- Agent 能力球体

**技术对比**:

| 库 | 优点 | 缺点 |
|----|------|------|
| **Three.js** | 强大、生态丰富 | 学习曲线 |
| **React Three Fiber** | React 集成 | 需额外学习 |
| **Babylon.js** | 完整工具链 | 较重 |

**推荐**: 如有 3D 需求，使用 **React Three Fiber**

---

## 五、关键技术决策 (ADRs)

### ADR-001: 为什么选择 Fastify 而非 Express?

**问题**: Node.js Web 框架选型

**选项**:
- Express: 流行但性能一般
- Fastify: 高性能但相对小众
- NestJS: 功能全但重型

**决策**: **Fastify 5**

**理由**:
1. 基准测试显示 Fastify 比 Express 快 2x
2. Schema-first 设计契合 TypeScript + Zod
3. 插件架构更适合模块化开发
4. OpenAPI 集成开箱即用

**风险缓解**:
- 社区相对 Express 小 → 插件生态丰富
- 学习曲线 → 文档质量高

### ADR-002: 为什么需要 Neo4j?

**问题**: Agent 关系数据建模

**选项**:
- 仅用 PostgreSQL
- PostgreSQL + JSON 列
- 专用图数据库

**决策**: **Neo4j**

**理由**:
1. Agent 关系是天然的图结构 (uses/produced/derived/trusted)
2. 进化链追踪需要路径查询
3. Cypher 查询直观表达关系
4. EvoMap 原型已验证可行性

**风险缓解**:
- 运维复杂度 → 使用 Docker Compose 或 Aura 云服务
- 数据同步 → Prisma 管理主数据，Neo4j 作为只读视图

### ADR-003: 为什么不选 Python 作为后端?

**问题**: 后端语言选型

**选项**:
- Python: AI 生态强
- Node.js: 全栈统一
- Go: 高性能

**决策**: **Node.js**

**理由**:
1. 全栈 TypeScript 减少语言切换成本
2. 与现有前端技术栈一致
3. 异步 I/O 适合高并发 API
4. npm 生态丰富

---

## 六、依赖版本锁定

### 6.1 前端依赖

```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@xyflow/react": "^12.3.0",
    "@tanstack/react-query": "^5.60.0",
    "recharts": "^2.15.0",
    "react-force-graph-2d": "^1.27.0",
    "zustand": "^5.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.469.0"
  }
}
```

### 6.2 后端依赖

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/swagger": "^9.7.0",
    "@fastify/swagger-ui": "^5.2.5",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@prisma/client": "^6.0.0",
    "prisma": "^6.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0",
    "neo4j-driver": "^5.28.0",
    "zod": "^3.23.0",
    "bcryptjs": "^3.0.3",
    "nanoid": "^3.3.0"
  }
}
```

---

## 七、总结

### 技术选型总览

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js | 15.x |
| **UI 组件** | shadcn/ui + Radix | latest |
| **样式** | Tailwind CSS | 4.x |
| **状态管理** | Zustand + React Query | 5.x / 5.x |
| **图表** | React Flow + Recharts | 12.x / 2.x |
| **后端框架** | Fastify | 5.x |
| **ORM** | Prisma | 6.x |
| **队列** | BullMQ + Redis | 5.x / 7.x |
| **图数据库** | Neo4j | 5.x |
| **验证** | Zod | 3.x |

### 竞品差异化

My Evo 项目的核心差异化在于**进化基础设施**的定位，结合 EvoMap.ai 的 Gene/Capsule 资产模型和 Swarm/Council 多Agent协作机制，为 AI Agent 提供自我进化和共享学习的能力。

---

*文档生成完成 - 2026-04-28*
