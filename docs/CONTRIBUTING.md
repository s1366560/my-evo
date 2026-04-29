# 贡献指南 | Contributing Guide

> **版本**: v1.0 | **更新日期**: 2026-04-29
> 欢迎参与 My Evo 的开发！本指南将帮助你了解项目结构、代码规范和提交流程。

---

## 目录

1. [行为准则](#行为准则)
2. [开发环境](#开发环境)
3. [代码规范](#代码规范)
4. [分支管理](#分支管理)
5. [提交规范](#提交规范)
6. [测试要求](#测试要求)
7. [文档要求](#文档要求)
8. [模块开发](#模块开发)
9. [Pull Request 流程](#pull-request-流程)
10. [问题反馈](#问题反馈)

---

## 行为准则

我们坚持开放、尊重、包容的社区精神：

- **尊重他人**：使用包容性语言，避免人身攻击
- **接受建设性反馈**：批评针对代码，而非个人
- **关注社区利益**：优先考虑项目的长期健康
- **遵守法律**：不提交受版权保护的未经授权代码

---

## 开发环境

### 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |
| PostgreSQL | >= 14 |
| Redis | >= 6 |

### 快速设置

```bash
# 1. 克隆仓库
git clone <repo-url>
cd my-evo

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填写必要的配置

# 4. 初始化数据库
npm run db:generate   # 生成 Prisma Client
npm run db:migrate    # 执行数据库迁移
npm run db:seed       # 填充种子数据（可选）

# 5. 启动开发服务器
npm run dev           # 后端 (Fastify, 端口 3000)
# 新开终端窗口:
cd frontend && npm run dev  # 前端 (Next.js, 端口 3001)
```

### 开发工具

```bash
# 代码检查
npm run lint          # ESLint 检查
npm run lint:fix      # 自动修复

# 格式化
npm run format        # Prettier 格式化

# 类型检查
npm run typecheck     # TypeScript 类型检查
```

---

## 代码规范

### TypeScript 规范

- 使用 **TypeScript 5.x** 严格模式
- 所有新增代码必须标注类型，禁止使用 `any`
- 优先使用接口而非类型别名
- 使用 `undefined` 而非 `null`

```typescript
// ✅ 正确
interface UserProfile {
  id: string;
  email: string;
  trustLevel: TrustLevel;
}

// ❌ 错误
const user: any = fetchUser();
```

### 文件命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 模块目录 | kebab-case | `src/worker-pool/` |
| 路由文件 | routes.ts | `src/assets/routes.ts` |
| 服务文件 | service.ts | `src/assets/service.ts` |
| 类型文件 | types.ts | `src/assets/types.ts` |
| 测试文件 | service.test.ts | `src/assets/service.test.ts` |
| 工具函数 | utils.ts | `src/shared/utils.ts` |

### 模块结构

每个功能模块必须遵循四文件结构：

```
src/{module-name}/
├── routes.ts         # Fastify 路由定义
├── service.ts        # 业务逻辑
├── service.test.ts   # 单元测试
└── types.ts         # 类型导出
```

**routes.ts 示例：**
```typescript
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth.js';

export default async function (app: FastifyInstance): Promise<void> {
  app.get('/endpoint', { preHandler: [requireAuth] }, async (request, reply) => {
    // ...
  });
}
```

**service.ts DI 模式：**
```typescript
import { PrismaClient } from '@prisma/client';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function getEntity(id: string) {
  return prisma.entity.findUnique({ where: { id } });
}
```

### 错误处理

使用统一的错误类：

```typescript
import { NotFoundError, ValidationError } from '../shared/errors.js';

// 抛出领域错误
throw new NotFoundError('Asset not found');

// 业务验证
throw new ValidationError('Invalid input', { field: 'email' });
```

---

## 分支管理

### 分支命名

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 功能 | `feat/<short-description>` | `feat/oauth-integration` |
| 修复 | `fix/<issue-description>` | `fix/session-expiry` |
| 文档 | `docs/<scope>` | `docs/api-reference` |
| 重构 | `refactor/<scope>` | `refactor/auth-module` |
| 测试 | `test/<scope>` | `test/auth-flow` |
| 探索 | `explore/<idea>` | `explore/ai-council` |

### 分支策略

```
main (生产就绪)
  └── develop (开发集成)
        ├── feat/oauth-integration
        ├── fix/session-expiry
        └── docs/api-reference
```

---

## 提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### 类型

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档变更 |
| style | 代码格式（不影响功能） |
| refactor | 重构（非新功能/非修复） |
| test | 添加/修改测试 |
| chore | 构建/工具变更 |

### 示例

```bash
# 功能提交
git commit -m "feat(auth): add OAuth2.0 integration with Google"

# 修复提交
git commit -m "fix(session): resolve token refresh race condition"

# 文档提交
git commit -m "docs(api): update /a2a/hello endpoint description"

# 包含详细说明
git commit -m "feat(bounty): implement milestone-based payment
- Add BountyMilestone model to schema
- Update bounty service with milestone tracking
- Add milestone validation in routes
Closes #123"
```

---

## 测试要求

### 测试覆盖目标

| 指标 | 最低要求 |
|------|----------|
| 语句覆盖率 | 80% |
| 分支覆盖率 | 80% |
| 函数覆盖率 | 80% |
| 行覆盖率 | 80% |

### 测试文件组织

```
src/
└── {module}/
    ├── service.test.ts      # 单元测试
    └── routes.test.ts       # 路由测试（如需要）
```

### 测试模式

```typescript
import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  model: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
} as unknown as PrismaClient;

beforeAll(() => {
  setPrisma(mockPrisma);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('getEntities', () => {
  it('should return list of entities', async () => {
    const mockData = [{ id: '1', name: 'Test' }];
    mockPrisma.model.findMany.mockResolvedValue(mockData);

    const result = await getEntities();
    expect(result).toEqual(mockData);
    expect(mockPrisma.model.findMany).toHaveBeenCalledOnce();
  });
});
```

### 运行测试

```bash
npm test                    # 运行所有测试
npm run test:coverage       # 生成覆盖率报告
npm run test:watch          # 监听模式
npm run test:grep "auth"    # 运行匹配的测试
```

---

## 文档要求

### 代码内注释

- 公共 API 必须包含 JSDoc 注释
- 复杂业务逻辑添加行内说明
- 避免无意义的注释（如 `// increment i`）

```typescript
/**
 * 计算节点 GDI 分数
 * @param nodeId - 节点 ID
 * @returns GDI 分数 (0-100)
 */
export async function calculateGDI(nodeId: string): Promise<number> {
  // ...
}
```

### API 文档

新增或修改 API 端点时，同步更新 `docs/api/reference.md`：

```markdown
### 端点名称

```
METHOD /path
```

**认证：** 认证方式

**请求体：**
```json
{
  "field": "description"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {}
}
```
```

---

## 模块开发

### 创建新模块

```bash
# 1. 创建模块目录
mkdir -p src/new-module

# 2. 创建文件
touch src/new-module/routes.ts
touch src/new-module/service.ts
touch src/new-module/service.test.ts
touch src/new-module/types.ts

# 3. 在 app.ts 中注册路由
# 编辑 src/app.ts，添加模块路由注册
```

### 路由注册示例

```typescript
// src/app.ts
import newModule from './new-module/routes.js';

export async function buildApp() {
  const app = fastify();

  // ... existing plugins

  // 注册新模块
  app.register(newModule, { prefix: '/api/v2/new-module' });

  return app;
}
```

### 数据库模型

若新模块需要数据库模型：

```bash
# 1. 编辑 schema
nano prisma/schema.prisma

# 2. 生成迁移
npm run db:migrate -- --name add_new_module

# 3. 生成 Client
npm run db:generate
```

---

## Pull Request 流程

### 步骤

1. **Fork 仓库**（如从外部贡献）
2. **创建功能分支**：`git checkout -b feat/my-feature`
3. **开发并测试**
4. **确保所有测试通过**：`npm test`
5. **确保代码格式正确**：`npm run lint:fix`
6. **提交并推送**：`git push origin feat/my-feature`
7. **创建 Pull Request**
8. **等待代码审查**

### PR 描述模板

```markdown
## 描述
<!-- 简要说明这次变更 -->

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 重构

## 测试
<!-- 描述你如何测试这些变更 -->

## 截图（如涉及 UI）
<!-- UI 变更请附上截图 -->
```

### 审查要点

- [ ] 代码逻辑正确性
- [ ] 是否遵循代码规范
- [ ] 是否有适当的测试覆盖
- [ ] 是否更新了相关文档
- [ ] 是否有性能影响
- [ ] 是否引入安全风险

---

## 问题反馈

### Bug 报告

请使用 GitHub Issues，标签 `bug`，格式：

```markdown
**描述**
<!-- 清晰描述问题 -->

**复现步骤**
1.
2.
3.

**预期行为**
<!-- 描述应该发生什么 -->

**实际行为**
<!-- 描述实际发生了什么 -->

**环境**
- Node.js 版本:
- 操作系统:
- 数据库版本:
```

### 功能请求

标签 `enhancement`，格式：

```markdown
**问题/动机**
<!-- 描述你想解决的问题或动机 -->

**建议的解决方案**
<!-- 描述你认为应该如何解决 -->

**替代方案**
<!-- 其他可能的解决方案 -->

**附加内容**
<!-- 截图、伪代码等 -->
```

---

## 资源链接

- [架构文档](ARCHITECTURE.md)
- [API 参考](docs/api/reference.md)
- [数据库模型](docs/architecture/architecture-database.md)
- [开发指南](docs/guides/development.md)
- [部署指南](docs/guides/deployment.md)

---

*最后更新: 2026-04-29*
