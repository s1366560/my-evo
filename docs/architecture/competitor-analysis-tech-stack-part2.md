# 竞品分析与技术选型报告 (续)

> **文档版本**: v1.0  
> **关联文档**: competitor-analysis-tech-stack.md  

---

## 三、可视化库选型

### 3.1 可视化库对比矩阵

| 库 | 类型 | 优点 | 缺点 | 适用场景 |
|----|------|------|------|----------|
| **Recharts** | 图表库 | React 原生、API 简洁 | 复杂图表受限 | 仪表板、统计图 |
| **D3.js** | 底层可视化 | 无限可能 | 学习曲线陡峭 | 自定义可视化 |
| **@xyflow/react** | 流程图 | 交互式节点/边 | 包体积较大 | Swarm 拓扑、Workflow |
| **react-force-graph** | 力导向图 | 大规模图渲染 | 交互有限 | 知识图谱 |
| **AntV G6** | 图可视化 | 丰富节点类型 | 文档中文为主 | 复杂关系图 |
| **ECharts** | 图表库 | 图表类型极多 | React 集成一般 | 复杂仪表板 |

### 3.2 可视化决策

| 需求 | 推荐 | 备选 | 拒绝 |
|------|------|------|------|
| 简单折线/柱状 | Recharts | Chart.js | ECharts |
| 雷达图 | Recharts | - | - |
| 关系图谱 | react-force-graph | G6 | D3 (太复杂) |
| 工作流拓扑 | @xyflow/react | D3 | - |
| 自定义 SVG | D3.js | 原生 SVG | - |
| 实时数据 | Recharts | ECharts | - |

### 3.3 知识图谱可视化方案

**技术方案**: react-force-graph-2d + @xyflow/react

```typescript
// react-force-graph 适用于大规模节点渲染
import ForceGraph2D from 'react-force-graph-2d';

// @xyflow/react 适用于交互式工作流
import { ReactFlow } from '@xyflow/react';
```

**场景对比**:
- 资产关系图: react-force-graph-2d (Canvas 渲染高性能)
- Swarm 协作拓扑: @xyflow/react (节点交互丰富)

### 3.4 仪表板图表方案

**技术方案**: Recharts

```typescript
// 雷达图 - GDI 多维评分
<RadarChart data={gdiDimensions}>
  <PolarGrid />
  <Radar name="Asset" dataKey="score" />
</RadarChart>

// 环形图 - 资产分布
<PieChart>
  <Pie data={assetDistribution} innerRadius={60} />
</PieChart>
```

### 3.5 进化时间线方案

**技术方案**: D3.js + SVG

```typescript
// D3 适合高度自定义的时间线
const timeline = d3.timeline()
  .x(d3.scaleLinear().domain([0, generations]))
  .y(d3.scaleBand().domain(assets));
```

---

## 四、后端技术栈选型

### 4.1 Web 框架对比

| 框架 | QPS 基准 | 内存占用 | 插件生态 | 适用场景 |
|------|----------|----------|----------|----------|
| **Fastify 5** ✅ | ~50k req/s | 低 | 丰富 | 高性能 API |
| **Express 4** | ~25k req/s | 中 | 丰富 | 简单 API |
| **NestJS** | ~20k req/s | 高 | 依赖注入 | 企业级应用 |
| **Hono** | ~60k req/s | 极低 | 轻量 | Edge Functions |

**决策理由**: 性能优秀（~2x Express）、Schema 优先、插件质量高

### 4.2 ORM 对比

| ORM | 类型安全 | 迁移体验 | 性能 | 适用场景 |
|-----|----------|----------|------|----------|
| **Prisma 6** ✅ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 快速迭代 |
| **Drizzle** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 性能敏感 |
| **TypeORM** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 遗留项目 |

### 4.3 数据库三层架构

| 类型 | 产品 | 适用场景 |
|------|------|----------|
| **关系型** | PostgreSQL | 主数据存储、事务 |
| **图数据库** | Neo4j | Agent 关系、进化链 |
| **缓存** | Redis | 会话、速率限制、热点缓存 |

### 4.4 任务队列对比

| 方案 | 可靠性 | 监控 | 适用场景 |
|------|--------|------|----------|
| **BullMQ + Redis** ✅ | 高 | Bull Board UI | 通用任务 |
| **AWS SQS + Lambda** | 高 | AWS Console | 云原生 |
| **RabbitMQ** | 高 | 管理 UI | 复杂路由 |

---

## 五、数据处理方案

### 5.1 数据流架构

```
[Client] 
    │
    ▼
[Fastify API] ─────► [BullMQ Queue] ─────► [Worker]
    │                    │                      │
    ▼                    ▼                      ▼
[Redis Cache]      [Dead Letter]         [Result Storage]
    │
    ▼
[PostgreSQL / Neo4j]
```

### 5.2 缓存策略

| 层级 | 存储 | TTL | 适用场景 |
|------|------|-----|----------|
| L1 | React Query | 5min | 客户端缓存 |
| L2 | Redis | 30s-5min | 服务端热点 |
| L3 | PostgreSQL | 持久 | 主数据 |

### 5.3 搜索方案

| 方案 | 适用场景 | 复杂度 |
|------|----------|--------|
| **全文搜索** | 资产名称、描述 | 低 |
| **语义搜索** | 意图匹配 | 中 (需 Embedding) |
| **图搜索** | 关系探索 | 中 (Neo4j Cypher) |
| **混合搜索** | 综合查询 | 高 |

---

## 六、安全架构

### 6.1 认证体系

**双轨认证**:
- **Node 认证**: node_id + node_secret (Bearer Token)
- **User 认证**: JWT

**权限分层**:
```
匿名用户 → 注册用户 → 节点绑定 → 付费订阅
```

### 6.2 速率限制

| 计划 | API 限制 | 实现 |
|------|----------|------|
| Free | 100 req/min | @fastify/rate-limit |
| Premium | 500 req/min | @fastify/rate-limit |
| Ultra | 2000 req/min | @fastify/rate-limit |

### 6.3 安全中间件

| 中间件 | 功能 |
|--------|------|
| @fastify/helmet | HTTP 安全头 (CSP, HSTS) |
| @fastify/cors | 跨域资源共享 |
| bcryptjs | 密码哈希 |
| HMAC-SHA256 | 消息签名 |

---

## 七、技术债与改进

### 7.1 已识别技术债

| 优先级 | 问题 | 建议 |
|--------|------|------|
| 高 | 多个 worker 任务超时 | 增加步数限制或拆分任务 |
| 高 | 部分 stale_no_heartbeat | 确保 heartbeat 机制可靠 |
| 中 | MSW mock 部分实现 | 补充完整 API mock |
| 中 | E2E 测试覆盖不足 | 补充 Playwright 测试 |

### 7.2 架构改进路线

1. **短期**: 完善 MSW mock、E2E 测试
2. **中期**: 引入 GraphQL、Service Mesh
3. **长期**: 多租户架构、边缘计算

### 7.3 性能优化

| 优化项 | 方案 | 预期收益 |
|--------|------|----------|
| 静态资源 | CDN | 首屏 <1s |
| API 缓存 | Redis | P95 <100ms |
| 数据库索引 | B-tree | 查询 <10ms |
| 前端 Bundle | 代码分割 | FCP <2s |

---

## 八、架构决策总结

### 8.1 已确认决策

| ADR | 决策 | 状态 |
|-----|------|------|
| ADR-001 | Next.js 15 (App Router) | ✅ 已接受 |
| ADR-002 | Fastify 5 | ✅ 已接受 |
| ADR-003 | Prisma 6 ORM | ✅ 已接受 |
| ADR-004 | Neo4j 图数据库 | ✅ 已接受 |
| ADR-005 | BullMQ + Redis | ✅ 已接受 |
| ADR-006 | MSW Mock | ✅ 已接受 |

### 8.2 可视化库决策

| 库 | 用途 | 状态 |
|----|------|------|
| Recharts | 仪表板图表 | ✅ 确认 |
| @xyflow/react | 工作流拓扑 | ✅ 确认 |
| react-force-graph-2d | 知识图谱 | ✅ 确认 |
| D3.js | 自定义 SVG | ✅ 备选 |

### 8.3 技术栈总览

```
前端:
├── Next.js 15 (App Router)
├── TypeScript 5.5
├── Tailwind CSS 3.4
├── shadcn/ui + Radix
├── React Query + Zustand
├── Recharts + @xyflow/react + react-force-graph-2d
└── Vitest + Playwright + MSW

后端:
├── Node.js 18+
├── Fastify 5
├── TypeScript 5.5
├── Prisma 6 + PostgreSQL
├── Neo4j (图数据库)
├── Redis (缓存)
├── BullMQ (任务队列)
└── Zod (验证)
```

---

*报告生成完毕 - 2026-04-28*
