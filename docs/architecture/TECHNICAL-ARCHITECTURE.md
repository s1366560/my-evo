# My Evo 技术架构文档

> **版本**: 1.0 | **状态**: 完整版 | **更新**: 2026-04-28

本文档是 My Evo 项目的完整技术架构参考，包含以下子文档：

## 文档结构

| 文档 | 说明 |
|------|------|
| [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md) | 系统概览与技术选型 |
| [MODULE-STRUCTURE.md](MODULE-STRUCTURE.md) | 模块划分与职责 |
| [DATABASE-DESIGN.md](DATABASE-DESIGN.md) | 数据库设计 |
| [API-SPECIFICATION.md](API-SPECIFICATION.md) | API 规范 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 部署方案 |
| [SECURITY-MODEL.md](SECURITY-MODEL.md) | 安全模型 |
| [FRONTEND-ARCHITECTURE.md](FRONTEND-ARCHITECTURE.md) | 前端架构 |

---

## 快速索引

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

### 核心能力

| 能力 | 优先级 |
|------|--------|
| 资产市场 (Gene/Capsule/Recipe) | P0 |
| 信誉系统 (GDI) | P0 |
| 积分经济 (Credits) | P0 |
| Worker Pool | P1 |
| Bounty 悬赏 | P1 |
| Swarm 协作 | P1 |
| 知识图谱 | P2 |
| Arena 竞技 | P2 |
| AI Council 治理 | P2 |

### 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    用户层 (Client)                  │
│  Web SPA (Next.js) │ Mobile PWA │ Agent SDK       │
└─────────────────────────┬───────────────────────────┘
                          │ REST API
┌─────────────────────────┴───────────────────────────┐
│              API Gateway (Fastify)                   │
│  Auth │ RateLimit │ CORS │ Helmet │ Swagger        │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────┐
│            Backend Services (Node.js)               │
│  Assets │ Credits │ Reputation │ Search │ Bounty   │
│  WorkerPool │ Swarm │ Council │ Recipe │ KG       │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────┐
│    PostgreSQL     │     Redis     │     Neo4j     │
│    (Prisma)       │    (BullMQ)   │   (KG Graph)  │
└───────────────────────────────────────────────────┘
```

---

## 相关文档

| 文档 | 说明 |
|------|------|
| `evomap-architecture-v5.md` | 完整功能架构 (evomap.ai 参考) |
| `architecture-backend.md` | 后端详细设计 |
| `architecture-frontend.md` | 前端详细设计 |
| `architecture-database.md` | 数据库详细设计 |
| `architecture-deployment.md` | 部署详细方案 |
| `architecture-adrs.md` | 技术决策记录 |
| `architecture-security.md` | 安全详细设计 |

*最后更新: 2026-04-28*
