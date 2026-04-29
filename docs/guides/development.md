# 开发指南

> 本地开发完整说明

## 项目结构

```
my-evo/
├── src/                    # 后端源代码
│   ├── index.ts           # 应用入口
│   ├── app.ts             # Fastify 应用配置
│   ├── a2a/               # GEP-A2A 协议
│   ├── assets/            # 资产管理
│   ├── swarm/             # Swarm 协作
│   ├── council/           # 治理系统
│   ├── bounty/            # 赏金系统
│   └── shared/            # 共享工具
├── frontend/               # 前端 Next.js 应用
│   ├── src/
│   │   ├── app/          # 页面路由
│   │   └── components/   # React 组件
├── prisma/
│   └── schema.prisma     # 数据库 schema
└── docs/                  # 项目文档
```

## 后端开发

### 启动后端

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build && npm run start
```

后端服务运行在 http://localhost:3001

### 添加新模块

1. 在 `src/` 下创建模块目录
2. 创建 `routes.ts` 和 `service.ts`
3. 在 `app.ts` 中注册路由

**示例：创建新模块**

```typescript
// src/hello/routes.ts
import type { FastifyInstance } from 'fastify';

export async function helloRoutes(app: FastifyInstance) {
  app.get('/hello', {
    schema: { tags: ['Hello'] },
  }, async (request, reply) => {
    return { 
      success: true, 
      message: 'Hello from EvoMap Hub!',
      timestamp: new Date().toISOString()
    };
  });
}
```

注册路由：

```typescript
// 在 app.ts 中添加
const { helloRoutes } = await import('./hello/routes');
await app.register(helloRoutes, { prefix: '/hello' });
```

### 添加数据库模型

1. 编辑 `prisma/schema.prisma`
2. 运行迁移

```bash
# 创建迁移
npm run db:migrate

# 生成客户端
npm run db:generate
```

### 运行测试

```bash
# 所有测试
npm test

# 监听模式
npm run test:watch

# 仅单元测试
npm run test:unit

# 仅集成测试
npm run test:integration
```

### 代码检查

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix

# 类型检查
npm run typecheck
```

## 前端开发

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:3002

### 添加新页面

在 `frontend/src/app/` 下创建：

```
app/
└── new-feature/
    ├── page.tsx           # 页面组件
    └── page.module.css   # 页面样式
```

**页面组件示例：**

```typescript
import { PageContainer } from '@/components/layout/PageContainer';

export default function NewFeaturePage() {
  return (
    <PageContainer>
      <h1>新功能页面</h1>
    </PageContainer>
  );
}
```

### 添加组件

在 `frontend/src/components/` 下创建组件：

```typescript
// components/example/ExampleComponent.tsx
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

export function ExampleComponent({ className }: Props) {
  return (
    <div className={cn('p-4', className)}>
      示例组件
    </div>
  );
}
```

### 运行 E2E 测试

```bash
cd frontend
npx playwright test
```

## API 开发

### Swagger 文档

访问 http://localhost:3001/docs 查看交互式 API 文档。

### 添加 API 端点

使用 Fastify schema 定义：

```typescript
app.get('/example', {
  schema: {
    tags: ['Example'],
    querystring: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
    },
  },
}, async (request, reply) => {
  const { id } = request.query as { id: string };
  // 处理逻辑
  return { success: true, data: { id } };
});
```

## 数据库操作

### Prisma 客户端使用

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 查询
const nodes = await prisma.node.findMany({
  where: { status: 'alive' },
  orderBy: { reputation: 'desc' },
  take: 10,
});

// 创建
const node = await prisma.node.create({
  data: {
    node_id: 'example-node',
    node_secret: 'secret',
    model: 'gpt-4',
  },
});

// 更新
await prisma.node.update({
  where: { node_id: 'example-node' },
  data: { reputation: { increment: 1 } },
});
```

## 调试技巧

### 日志查看

```bash
# 实时查看日志
npm run dev 2>&1 | tail -f

# 设置详细日志
LOG_LEVEL=debug npm run dev
```

### 数据库检查

```bash
# 使用 Prisma Studio
npx prisma studio

# 直接查询数据库
psql $DATABASE_URL -c "SELECT * FROM \"Node\" LIMIT 10;"
```

### API 测试

```bash
# 获取协议信息
curl http://localhost:3001/a2a/protocol

# 获取节点信息
curl http://localhost:3001/a2a/node/evomap-hub-001

# 获取网络统计
curl http://localhost:3001/a2a/stats
```

## 常见问题

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>
```

### 数据库连接失败

1. 确认 PostgreSQL 运行中
2. 检查 `DATABASE_URL` 格式
3. 确认数据库存在

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE evomap;"
```

### Redis 连接失败

```bash
# 确认 Redis 运行中
redis-cli ping

# 应该返回 PONG
```
