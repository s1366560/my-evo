# 后端实现

## 1. 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js |
| 框架 | Express |
| 语言 | TypeScript |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 认证 | NextAuth.js (JWT) |
| 验证 | Zod |

---

## 2. 目录结构

```
backend/src/
├── index.ts              # Express 应用入口
├── config/index.ts       # 环境配置
├── db/
│   ├── index.ts         # Prisma 客户端导出
│   └── prisma.ts        # Prisma 实例 (singleton)
├── middleware/
│   ├── auth.ts          # JWT 认证中间件
│   └── errorHandler.ts   # 全局错误处理
├── map/
│   └── types.ts         # 图谱/节点类型定义
└── routes/              # 44个功能模块路由
    ├── a2a/
    ├── account/
    ├── agent_config/
    ├── analytics/
    ├── arena/
    ├── assets/
    ├── billing/
    ├── biology/
    ├── bounty/
    ├── circle/
    ├── claim/
    ├── community/
    ├── constitution/
    ├── council/
    ├── credits/
    ├── dispute/
    ├── driftbottle/
    ├── gdi/
    ├── gep/
    ├── gepx/
    ├── kg/
    ├── marketplace/
    ├── memory_graph/
    ├── model_tier/
    ├── monitoring/
    ├── onboarding/
    ├── project/
    ├── quarantine/
    ├── questions/
    ├── reading/
    ├── recipe/
    ├── reputation/
    ├── sandbox/
    ├── search/
    ├── security/
    ├── session/
    ├── skill_store/
    ├── subscription/
    ├── swarm/
    ├── sync/
    ├── task/
    ├── task_alias/
    ├── verifiable_trust/
    ├── workerpool/
    └── workspace/
```

---

## 3. 入口文件 (index.ts)

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app = express();

// 中间件
app.use(express.json());

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 认证中间件应用于所有 /api 路由
app.use('/api', authMiddleware);

// 路由注册 (示例)
// app.use('/api/bounty', bountyRoutes);
// app.use('/api/gep', geneRoutes);
// ...

// 错误处理
app.use(errorHandler);

const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 4. 配置 (config/index.ts)

```typescript
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/myevo',
  jwtSecret: process.env.JWT_SECRET || '',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
};
```

---

## 5. 数据库 (db/)

### 5.1 Prisma 客户端 (prisma.ts)
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### 5.2 导出 (index.ts)
```typescript
import { prisma } from './prisma';
export { prisma };
```

---

## 6. 中间件

### 6.1 认证中间件 (middleware/auth.ts)

```typescript
import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const authMiddleware = (
  req: AuthRequest, res: Response, next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // JWT 验证逻辑
    // req.userId = verifyToken(token).userId;
  }
  
  next();
};
```

### 6.2 错误处理 (middleware/errorHandler.ts)

```typescript
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error, _req: Request, res: Response, _next: NextFunction
) => {
  console.error('Error:', err.message);
  
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};
```

---

## 7. 类型定义 (map/types.ts)

```typescript
import { Node, Edge } from '@my-evo/types';

export interface GraphNode extends Node {
  x?: number;
  y?: number;
}

export interface GraphEdge extends Edge {
  source: string;
  target: string;
}

export interface MapState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
}
```

---

## 8. 路由模块结构

每个路由模块遵循相同模式:

```
routes/<module>/
├── index.ts    # 路由聚合
├── routes.ts   # 路由定义
└── service.ts # 业务逻辑
```

### 8.1 示例: bounty 模块

**routes/bounty/routes.ts** (推断结构)
```typescript
import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const bounties = await prisma.bounty.findMany();
  res.json({ data: bounties });
});

router.get('/:id', async (req, res) => {
  const bounty = await prisma.bounty.findUnique({
    where: { id: req.params.id }
  });
  res.json({ data: bounty });
});

router.post('/', async (req, res) => {
  const bounty = await prisma.bounty.create({ data: req.body });
  res.json({ data: bounty });
});

export default router;
```

---

## 9. 依赖关系

```
index.ts
├── config/index.ts
├── middleware/errorHandler.ts
└── middleware/auth.ts
    └── db/prisma.ts

routes/<module>/
├── db/index.ts
│   └── db/prisma.ts
└── middleware/auth.ts
```

---

## 10. Jest 测试配置

Jest 覆盖率报告位于 `backend/coverage/`:
- `lcov-report/` - HTML 覆盖率报告
- `coverage-final.json` - 覆盖率数据
- `lcov.info` - LCOV 格式数据
