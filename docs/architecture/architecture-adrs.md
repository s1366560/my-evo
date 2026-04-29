# 架构决策记录 (ADRs)

> **父文档**: `technical-architecture-v1.md` | **版本**: v1.0

---

## ADR-001: 前端框架选型 Next.js 而非纯 React SPA

| 属性 | 值 |
|------|-----|
| **状态** | 已接受 |
| **决策者** | 架构团队 |
| **日期** | 2026-04-28 |

### 背景
需要为 My Evo 选择前端框架，候选方案：Next.js (App Router) 和 纯 React + Vite SPA。

### 决策
采用 **Next.js 15 (App Router)**。

### 理由
1. SSR/ISR 支持内容站 SEO，evomap.ai 有大量文档和营销页
2. App Router 的 React Server Components 减少客户端 JS bundle
3. 文件系统路由减少样板代码
4. Vercel 零配置部署，生产环境成熟

### 备选方案
纯 React + Vite SPA — **拒绝理由**：SEO 不友好，无 SSR 能力。

---

## ADR-002: 后端框架选型 Fastify 而非 Express/NestJS

| 属性 | 值 |
|------|-----|
| **状态** | 已接受 |
| **决策者** | 架构团队 |
| **日期** | 2026-04-28 |

### 决策
采用 **Fastify 5**。

### 理由
1. 性能：基准测试比 Express 快约 2x，与 Go/Node 原生服务器相当
2. Schema 优先：内置 JSON Schema 验证，减少运行时错误
3. 插件生态：认证、Swagger、速率限制等插件质量高
4. 轻量：中间件按需加载，无 NestJS 的依赖注入复杂度

### 备选方案
- **Express** — 拒绝：中间件链式调用性能差，类型安全弱
- **NestJS** — 拒绝：过度工程化，学习曲线陡峭，对于本项目规模过重

---

## ADR-003: ORM 选型 Prisma 而非 TypeORM/Drizzle

| 属性 | 值 |
|------|-----|
| **状态** | 已接受 |
| **决策者** | 架构团队 |
| **日期** | 2026-04-28 |

### 决策
采用 **Prisma 6**。

### 理由
1. 类型安全：`PrismaClient` 自动生成 TypeScript 类型
2. 迁移体验：Prisma Migrate 体验优于 TypeORM 的同步机制
3. IDE 支持：Prisma VSCode 扩展提供语法高亮和自动补全
4. 简洁 API：比 TypeORM 更直观，减少学习成本

### 备选方案
- **TypeORM** — 拒绝：API 复杂，同步机制与 TypeScript 类型系统冲突
- **Drizzle** — 延迟考虑：生态相对新，迁移工具链不如 Prisma 成熟

---

## ADR-004: 图数据库选型 Neo4j 而非 PostgreSQL JSONB

| 属性 | 值 |
|------|-----|
| **状态** | 已接受 |
| **决策者** | 架构团队 |
| **日期** | 2026-04-28 |

### 决策
采用 **Neo4j 5** 存储 Agent 关系图谱和进化链。

### 理由
1. 自然表达：进化关系（父子）、协作关系用 Cypher 查询更直观
2. 性能：多跳关系查询（Agent → 祖先）比 PostgreSQL 递归 CTE 快一个数量级
3. 可视化：Neo4j Bloom 直接可视化图谱
4. 与 Prisma 分工清晰：Neo4j 不承担事务性写操作

### 备选方案
- **PostgreSQL JSONB** — 拒绝：关系查询性能差，JSON 聚合不优雅
- **MongoDB** — 拒绝：无关联查询能力，图场景不适用

---

## ADR-005: 任务队列选型 BullMQ 而非直接 Redis

| 属性 | 值 |
|------|-----|
| **状态** | 已接受 |
| **决策者** | 架构团队 |
| **日期** | 2026-04-28 |

### 决策
采用 **BullMQ 5 + Redis**。

### 理由
1. 可靠性：内置重试、死信队列（DLQ）、优先级、超时控制
2. 监控：BullMQ Board 提供 UI 可视化队列状态
3. 集群支持：支持 Redis Cluster 水平扩展
4. 开发者体验：Job Options API 清晰，比裸 Redis List 易于维护

### 备选方案
- **裸 Redis List (RPUSH/BRPOP)** — 拒绝：需要自行实现重试、超时、优先级机制
- **BeeMQ / Agenda** — 延迟考虑：BullMQ 生态更成熟

---

## ADR-006: Mock 策略选型 MSW 而非 MirageJS/json-server

| 属性 | 值 |
|------|-----|
| **状态** | 已接受 |
| **决策者** | 架构团队 |
| **日期** | 2026-04-28 |

### 决策
开发阶段采用 **MSW (Mock Service Worker) 2.x**。

### 理由
1. 真实拦截：拦截真实 HTTP 请求，前端无需区分 mock/real 代码路径
2. 零侵入：与 axios/fetch 无关，生产环境可无缝切换
3. Service Worker：支持 Service Worker 级别的拦截
4. 类型安全：MSW 提供 TypeScript 类型生成

### 备选方案
- **MirageJS** — 拒绝：仅限前端 JS 拦截，无法拦截 Service Worker 级别请求
- **json-server** — 拒绝：仅 REST，无类型安全，无法模拟复杂业务逻辑
