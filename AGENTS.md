# AGENTS.md - EvoMap 开发规范

> 所有成员必须遵循本规范的编码风格和 Git 工作流程。

---

## 1. 项目结构

```
my-evo/
├── src/
│   ├── a2a/              # A2A 协议实现
│   │   ├── types.ts       # 类型定义
│   │   ├── node.ts        # 节点注册
│   │   └── heartbeat.ts   # 心跳保活
│   ├── core/              # 核心业务逻辑
│   │   ├── gdi.ts        # GDI 评分计算
│   │   ├── reputation.ts  # 声望系统
│   │   └── credits.ts    # 积分系统
│   ├── assets/           # 资产管理
│   │   ├── gene.ts       # Gene 实体
│   │   ├── capsule.ts    # Capsule 实体
│   │   └── evolution.ts  # EvolutionEvent
│   ├── swarm/            # Swarm 协作
│   │   ├── engine.ts     # Swarm 引擎
│   │   └── tasks.ts     # 任务管理
│   ├── governance/        # 治理系统
│   │   ├── council.ts    # AI Council
│   │   └── projects.ts   # Official Projects
│   └── utils/            # 工具函数
│       ├── crypto.ts     # 加密工具
│       └── validation.ts # 验证工具
├── tests/                 # 测试文件
│   ├── unit/            # 单元测试
│   └── integration/     # 集成测试
├── docs/                 # 文档
└── scripts/             # 部署脚本
```

---

## 2. 命名规范

### 2.1 文件命名
- **TypeScript**: `kebab-case.ts`（如 `node-utils.ts`）
- **测试**: `*.test.ts`（如 `node.test.ts`）
- **类型定义**: `*.types.ts`

### 2.2 变量/函数命名
| 类型 | 规范 | 示例 |
|------|------|------|
| 变量 | camelCase | `nodeSecret`, `creditBalance` |
| 函数 | camelCase | `registerNode()`, `processHeartbeat()` |
| 类 | PascalCase | `NodeManager`, `SwarmEngine` |
| 常量 | UPPER_SNAKE | `HEARTBEAT_INTERVAL_MS` |
| 类型/接口 | PascalCase | `HelloPayload`, `A2AMessage` |
| 枚举 | PascalCase | `NodeStatus`, `AssetType` |

### 2.3 API 端点命名
- RESTful 风格
- 资源用复数名词
- 动作用 HTTP 方法

```
GET    /a2a/nodes          # 列出节点
GET    /a2a/nodes/:id       # 获取节点详情
POST   /a2a/hello            # 注册节点
POST   /a2a/heartbeat        # 心跳保活
POST   /a2a/publish         # 发布资产
POST   /a2a/fetch            # 获取资产
```

---

## 3. TypeScript 规范

### 3.1 类型定义
```typescript
// ✅ 正确：显式接口定义
interface NodeInfo {
  node_id: string;
  status: NodeStatus;
  reputation: number;
}

// ❌ 错误：使用 any
function process(data: any) { ... }
```

### 3.2 导入规范
```typescript
// ✅ 正确：明确导入
import { registerNode } from './node';
import type { HelloPayload } from './types';

// ❌ 错误：通配符导入
import * as Node from './node';
```

### 3.3 错误处理
```typescript
// ✅ 正确：自定义错误类
export class EvoMapError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'EvoMapError';
  }
}

// 使用
throw new EvoMapError('Node not found', 'NODE_NOT_FOUND', 404);
```

---

## 4. Git 工作流程

### 4.1 分支命名
```
feature/phase-2-asset-system     # 新功能
bugfix/heartbeat-timeout         # Bug修复
hotfix/critical-security          # 紧急修复
docs/update-readme               # 文档更新
```

### 4.2 提交规范
```
<type>(<scope>): <subject>

feat(a2a): add node registration endpoint
fix(heartbeat): resolve 45min timeout calculation
docs(readme): update installation steps
test(assets): add GDI calculation tests
refactor(core): simplify reputation formula
```

**Type 类型：**
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `test`: 测试
- `refactor`: 重构
- `perf`: 性能优化
- `chore`: 构建/工具

### 4.3 PR 流程
1. 从 `master` 创建分支：`git checkout -b feature/xxx`
2. 开发并提交代码
3. 推送分支：`git push origin feature/xxx`
4. 创建 PR 到 `master`
5. 至少 1 人 review
6. @evo 合并 PR

### 4.4 PR 模板
```markdown
## 描述
<!--简要说明本次变更-->

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug修复 (fix)
- [ ] 文档更新 (docs)
- [ ] 测试 (test)

## 验收标准
<!--完成后如何验证-->

## 相关任务
<!--关联的黑板任务 ID-->
```

---

## 5. API 设计规范

### 5.1 请求格式
```typescript
// A2A 消息信封
interface A2ARequest {
  protocol: 'gep-a2a';
  protocol_version: '1.0.0';
  message_type: string;
  message_id: string;
  sender_id: string;
  timestamp: string;
  payload: object;
}
```

### 5.2 响应格式
```typescript
// 成功响应
interface SuccessResponse {
  status: 'ok' | 'acknowledged';
  [key: string]: unknown;
}

// 错误响应
interface ErrorResponse {
  error: string;        // 错误码
  message: string;      // 错误描述
  correction?: string;  // 修正建议
}
```

### 5.3 状态码
| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（无效 node_secret）|
| 404 | 资源不存在 |
| 429 | 请求过于频繁（速率限制）|
| 500 | 服务器内部错误 |

---

## 6. 测试规范

### 6.1 测试覆盖率目标
- **单元测试**: > 80%
- **集成测试**: 所有 API 端点
- **关键路径**: 100%

### 6.2 测试文件命名
```
tests/
├── unit/
│   ├── node.test.ts
│   ├── heartbeat.test.ts
│   └── gdi.test.ts
└── integration/
    ├── a2a-api.test.ts
    └── swarm.test.ts
```

### 6.3 测试规范
```typescript
describe('Node Registration', () => {
  it('should register a new node and return node_secret', async () => {
    const result = await registerNode({ model: 'test-model' });
    expect(result.status).toBe('acknowledged');
    expect(result.node_secret).toHaveLength(64);
  });
});
```

---

## 7. 文档规范

### 7.1 代码注释
```typescript
/**
 * Register a new node and return credentials.
 * 
 * @param payload - Node registration data
 * @param existingNodeId - Optional existing node ID for re-registration
 * @returns Node credentials including node_secret
 * 
 * @example
 * const result = await registerNode({ model: 'claude-sonnet-4' });
 * console.log(result.node_secret);
 */
export async function registerNode(
  payload: HelloPayload,
  existingNodeId?: string
): Promise<HelloResponse> { ... }
```

### 7.2 API 文档
每个 API 端点需要 JSDoc 注释：
```typescript
/**
 * POST /a2a/hello
 * 
 * Register a new node and obtain node_secret for authentication.
 * 
 * Request Body:
 *   - model: Node model identifier
 *   - gene_count: Number of published genes
 *   - capsule_count: Number of published capsules
 * 
 * Response:
 *   - your_node_id: Unique node identifier
 *   - node_secret: Authentication secret (64 chars)
 *   - credit_balance: Initial credits (500 for new nodes)
 * 
 * @see https://docs.evomap.ai/a2a/hello
 */
```

---

## 8. 安全规范

### 8.1 认证
- 所有写操作需要 `Authorization: Bearer <node_secret>`
- node_secret 必须安全存储，不要提交到 Git

### 8.2 输入验证
```typescript
// ✅ 正确：验证输入
if (!payload.sender_id) {
  throw new EvoMapError('Missing sender_id', 'INVALID_REQUEST', 400);
}

// ❌ 错误：信任用户输入
const nodeId = req.body.nodeId; // 未验证
```

### 8.3 敏感信息
```
.env           # 环境变量（包含 secrets）
*.log          # 日志文件
node_modules/  # 依赖（通过 npm install）
```

---

## 9. 团队分工

| 成员 | 职责 | 专注领域 |
|------|------|---------|
| **evo** | 架构设计、代码审查、PR 合并 | 整体架构 |
| **dev** | 核心开发、积分/声望系统 | Phase 3-4 |
| **test** | Swarm 协作、集成测试 | Phase 3, 6 |
| **arch** | 节点系统、文档规范 | Phase 1, 文档 |

---

## 10. 参考文档

- TypeScript 风格指南: https://google.github.io/styleguide/tsguide.html
- Git 提交规范: https://conventionalcommits.org/
- REST API 最佳实践: https://restfulapi.net/

---

*最后更新: 2026-03-27 | 版本: 1.0*
