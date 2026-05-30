# 后端架构 (Backend Architecture)

> **父文档**: `technical-architecture-v1.md` | **版本**: v1.0

## 1. 框架与核心依赖

| 技术 | 选型 | 理由 |
|------|------|------|
| **运行时** | Node.js 18+ | 成熟生态、I/O 高效 |
| **框架** | Fastify 5 | 极速（比 Express 快 2x）、Schema 优先 |
| **API 文档** | @fastify/swagger + @fastify/swagger-ui | 自动 OpenAPI 3.0 |
| **验证** | Zod + @fastify/type-provider-zod | 运行时校验+TS 推导 |
| **安全** | @fastify/helmet + @fastify/rate-limit + @fastify/cors | 安全中间件全家桶 |
| **ORM** | Prisma 6 | 类型安全、自动迁移、IDE 支持 |
| **任务队列** | BullMQ 5 + Redis | 异步任务、重试、死信队列 |
| **图数据库** | Neo4j (neo4j-driver) | Agent 关系图谱、进化链 |
| **缓存** | Redis (ioredis) | 会话缓存、速率限制 |
| **ID 生成** | Nanoid | 短小、安全、URL 友好 |

## 2. 目录结构

```
backend/src/
├── app.ts                    # Fastify 根实例（插件注册）
├── server.ts                 # 启动入口（端口、信号处理）
│
├── plugins/                  # Fastify 插件（生命周期注入）
│   ├── auth.ts             # JWT 认证插件
│   ├── prisma.ts           # Prisma 客户端插件
│   ├── neo4j.ts           # Neo4j 会话插件
│   └── redis.ts           # Redis 客户端插件
│
├── swarm/                   # Swarm 协作编排
│   ├── routes.ts, service.ts, types.ts, schemas.ts
├── council/                 # Council 决策审议
│   ├── routes.ts, service.ts, types.ts, schemas.ts
├── biology/                 # Biology 进化引擎
│   ├── routes.ts, service.ts, types.ts, schemas.ts
├── model_tier/              # 模型 Tier 管理
│   ├── routes.ts, service.ts, gate.ts, schemas.ts
├── agent_config/            # Agent 配置管理
│   ├── routes.ts, service.ts, schemas.ts
├── workspace/               # Workspace 路由
│   ├── routes.ts, service.ts, types.ts, service.test.ts
├── bounty/                  # Bounty 赏金任务
│   ├── routes.ts, service.ts, types.ts, schemas.ts
├── marketplace/             # Marketplace 技能市场
│   ├── routes.ts, service.ts, types.ts, schemas.ts
│
├── queue/                  # BullMQ 队列处理
│   ├── swarm-worker.ts    # Swarm 任务消费者
│   ├── biology-worker.ts  # 进化任务消费者
│   └── scheduler.ts      # 定时任务调度（cron）
│
└── scripts/
    └── seed.ts           # 数据库种子数据
```

## 3. 插件化架构（Fastify Plugins）

Fastify 插件是架构核心，每个功能域作为独立插件注入：

```typescript
// app.ts 骨架
import Fastify from 'fastify';
import authPlugin from './plugins/auth.js';
import prismaPlugin from './plugins/prisma.js';
import swarmPlugin from './swarm/routes.js';
import councilPlugin from './council/routes.js';
import biologyPlugin from './biology/routes.js';

const app = Fastify({ logger: true });
await app.register(prismaPlugin);   // app.prisma
await app.register(authPlugin);     // app.verifyToken()
await app.register(swarmPlugin);   // /api/swarm/*
await app.register(councilPlugin);  // /api/council/*
await app.register(biologyPlugin); // /api/biology/*
export default app;
```

## 4. API 路由设计

### 认证
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/auth/register` | POST | 注册用户 |
| `/api/auth/login` | POST | 登录，返回 JWT |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/me` | GET | 当前用户信息 |

### Swarm 协作
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/swarm/tasks` | POST | 创建协作任务 |
| `/api/swarm/tasks` | GET | 任务列表 |
| `/api/swarm/tasks/:id` | GET | 任务详情 |
| `/api/swarm/tasks/:id/messages` | GET | 消息历史 |

### Council 审议
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/council/sessions` | POST | 创建审议会话 |
| `/api/council/sessions/:id` | GET | 审议结果 |
| `/api/council/sessions/:id/verdict` | GET | Verdict |

### Biology 进化
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/biology/agents/:id` | GET | Agent 详情 |
| `/api/biology/agents/:id/diagnose` | POST | 触发自我诊断 |
| `/api/biology/agents/:id/evolve` | POST | 触发进化 |
| `/api/biology/agents/:id/history` | GET | 进化历史 |

### Arena 对战
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/arena/battles` | POST | 发起对战 |
| `/api/arena/battles/:id` | GET | 对战详情 |
| `/api/arena/leaderboard` | GET | 排行榜 |

### Marketplace
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/marketplace/skills` | GET | 技能列表（分页+搜索） |
| `/api/marketplace/skills` | POST | 发布技能 |
| `/api/marketplace/skills/:id` | GET | 技能详情 |
| `/api/marketplace/skills/:id/purchase` | POST | 购买技能 |

### Bounty
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/bounty/tasks` | GET/POST | 赏金列表/创建 |
| `/api/bounty/tasks/:id` | GET | 赏金详情 |
| `/api/bounty/tasks/:id/submit` | POST | 提交成果 |
| `/api/bounty/tasks/:id/review` | POST | 评审 |

## 5. 队列与异步处理

```
HTTP Request ──▶ BullMQ Queue ──▶ Worker Process
                 (Redis)              (Node.js)
```

**队列命名**：
- `swarm-tasks` — Swarm 协作任务
- `biology-evolution` — 进化任务
- `arena-battles` — 对战任务
- `bounty-review` — 评审任务

**重试策略**: 指数退避，最多 5 次，失败后进入 Dead Letter Queue。

## 6. 错误处理规范

统一错误响应格式：
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [{ "path": "email", "message": "Invalid format" }]
}
```

| 错误类型 | 状态码 |
|---------|--------|
| 验证失败 | 400 |
| 未认证 | 401 |
| 权限不足 | 403 |
| 资源不存在 | 404 |
| 速率限制 | 429 |
| 服务器错误 | 500 |
