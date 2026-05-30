# My Evo 项目架构设计文档 v2.0

> 版本: 2.0 | 状态: 正式版 | 目标: 复刻 evomap.ai 核心功能，实现前后端功能闭环

## 变更日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-04-27 | 初稿：Workspace Leader/Worker 模型、Preflight Evidence、API 契约 |
| v2.0 | 2026-04-28 | 正式版：完整技术栈、22个模块、Prisma schema、Frontend架构、实施路线 |

---

## 1. 系统概览

### 1.1 项目定位

**My Evo** 是一个 AI Agent 自进化基础设施平台，通过 **GEP (Genome Evolution Protocol)** 协议实现 AI Agent 之间的能力共享、验证和继承。

核心价值主张："One agent learns. A million inherit."

### 1.2 核心能力矩阵

| 能力 | 说明 | 状态 |
|------|------|------|
| GEP 基因组进化协议 | Gene、Capsule、Recipe 有机体管理 | ✅ |
| GDI 评分 | 五维质量评估体系 | ✅ |
| Swarm 协作 | 多 Agent 任务编排 | ✅ |
| Worker Pool | 分布式任务执行引擎 | ✅ |
| Bounty 系统 | 悬赏任务市场 | ✅ |
| Workspace 协作 | Leader-Worker 团队协作模型 | ✅ |
| A2A 协议 | Agent-to-Agent 通信 | ✅ |
| Verifiable Trust | 可验证信任体系 | ✅ |
| Quarantine 隔离 | 恶意节点隔离机制 | ✅ |
| 知识图谱 (KG) | 实体关系图谱 | ✅ |

### 1.3 系统架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                       用户层 (User Layer)                        │
│   Web 前端 (Next.js)  │  管理后台  │  第三方集成 (REST/A2A)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API 网关层 (API Gateway)                       │
│        Fastify REST API (:3000) + A2A WebSocket (:3001)         │
│   [CORS] → [Rate Limit] → [Auth] → [Error Handler]             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      业务逻辑层 (Business Logic)                  │
│                     22 个活跃模块 + 15 个占位模块                  │
│  src/shared/  types.ts (~1072行)  constants.ts  errors.ts  auth.ts│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据层 (Data Layer)                         │
│   PostgreSQL (Prisma)  │  Redis (缓存/队列)  │  Neo4j (知识图谱) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈选型

### 2.1 后端技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **运行时** | Node.js 18+ / TypeScript 5.x | 类型安全，全栈统一语言 |
| **框架** | Fastify 4.x | 高性能，插件化，中间件友好 |
| **ORM** | Prisma 5.x | 类型安全的数据库访问，30+ 数据模型 |
| **数据库** | PostgreSQL 15+ | 事务支持，全文搜索，JSON 存储 |
| **缓存/队列** | Redis 7+ | Session、限流、BullMQ 任务队列 |
| **图数据库** | Neo4j 5.x | 知识图谱实体关系查询 |
| **协议** | GEP-A2A v1.0.0 | Agent-to-Agent 通信协议 |
| **认证** | JWT + API Key + Node Secret | 三层认证体系 |
| **验证** | Zod | 运行时 schema 验证 |

### 2.2 前端技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **框架** | Next.js 14+ (App Router) | SSR/SSG，React Server Components |
| **UI 库** | shadcn/ui + Radix | 可访问性优先，Tailwind CSS |
| **状态管理** | Zustand | 轻量，TypeScript 友好 |
| **表单** | React Hook Form + Zod | 高性能表单验证 |
| **数据获取** | TanStack Query | 缓存、乐观更新、后台刷新 |
| **样式** | Tailwind CSS 3.x | 原子化 CSS，主题定制 |
| **图表** | Recharts | 响应式数据可视化 |
| **E2E 测试** | Playwright | 跨浏览器自动化测试 |

### 2.3 基础设施

| 组件 | 选型 | 说明 |
|------|------|------|
| **容器化** | Docker + Docker Compose | 本地开发和生产部署 |
| **编排** | Kubernetes (k8s/) | 生产环境扩缩容 |
| **CI/CD** | GitHub Actions | 自动化构建和部署 |
| **监控** | Prometheus + Grafana | 指标收集和可视化 |
| **日志** | ELK Stack | 集中式日志分析 |
| **反向代理** | Nginx | HTTPS 终结，负载均衡 |

---

## 3. 模块划分

### 3.1 活跃模块 (22个)

所有活跃模块遵循统一的 **4-文件结构**：

```
src/{module}/
  routes.ts       # Fastify 路由插件
  service.ts      # 业务逻辑 + setPrisma() DI
  service.test.ts # Jest 单元测试
  types.ts        # 类型重导出
```

| 模块 | 路由前缀 | 核心功能 |
|------|----------|----------|
| **a2a** | `/a2a` | GEP-A2A 协议、节点注册、心跳 |
| **account** | `/account` | 账户管理、个人资料 |
| **analytics** | `/api/v2/analytics` | 数据分析、统计报表 |
| **arena** | `/api/v2/arena` | Agent 竞技场对战 |
| **assets** | `/a2a/assets` | 资产(基因/胶囊)管理 |
| **biology** | `/api/v2/biology` | 生物演化模型 |
| **bounty** | `/api/v2/bounty` | 悬赏任务系统 |
| **circle** | `/api/v2/circle` | 社交圈子 |
| **community** | `/api/v2/community` | 社区论坛 |
| **council** | `/a2a/council` | 治理委员会投票 |
| **credits** | `/a2a/credits` | 积分系统 |
| **driftbottle** | `/api/v2/drift-bottle` | 漂流瓶社交 |
| **gdi** | `/gdi` | GDI 评分引擎 |
| **gep** | `/gep` | GEP 基因组协议 |
| **gepx** | `/gepx` | GEP 扩展协议 |
| **kg** | `/api/v2/kg` | 知识图谱 |
| **marketplace** | `/api/v2/marketplace` | 资产交易市场 |
| **monitoring** | `/api/v2/monitoring` | 系统监控 |
| **quarantine** | `/api/v2/quarantine` | 节点隔离管理 |
| **reading** | `/api/v2/reading` | 阅读追踪 |
| **reputation** | `/a2a/reputation` | 声誉系统 |
| **search** | `/search` | 全文搜索 |
| **session** | `/api/v2/session` | 会话管理 |
| **swarm** | `/api/v2/swarm` | 多 Agent 协作编排 |
| **verifiable_trust** | `/trust` | 可验证信任 |
| **workerpool** | `/api/v2/workerpool` | 工作者池 |
| **workspace** | `/workspace` | 团队协作工作空间 |

### 3.2 占位模块 (15个)

待开发的模块目录：anti_hallucination, directory, gepx, memory_graph, onboarding, project, protocol, questions, recipe, sandbox, scripts, skill_store, subscription, sync, trust

### 3.3 共享模块 (src/shared/)

| 文件 | 说明 |
|------|------|
| `types.ts` | 所有领域接口定义（单源 Truth），~1072 行 |
| `constants.ts` | 所有业务常量（按模块分组） |
| `errors.ts` | EvoMapError 基类 + 11 个子类 |
| `auth.ts` | 三层认证：Session > API Key > Node Secret |

### 3.4 模块间依赖关系

```
shared/ (types, errors, auth, constants)
    │
    ├── a2a ─────────┐
    ├── assets ───────┤
    ├── credits ──────┤
    ├── gep ──────────┼──► 核心协议层
    ├── gepx ─────────┤
    └── reputation ───┘
    │
    ├── swarm ───────────► 编排层 (依赖 core)
    ├── workerpool ──────► 执行层 (依赖 core)
    ├── bounty ──────────► 业务层 (依赖 core + swarm)
    ├── marketplace ────► 业务层 (依赖 core)
    ├── analytics ──────► 分析层 (依赖 core)
    └── workspace ───────► 协作层 (依赖 core + workerpool)
```

---

## 4. 接口设计

### 4.1 认证体系

三层认证按优先级顺序检查：

```
Request ──► requireAuth()
               │
               ├── 1. Session Token (cookie)  ✅ → 放行
               ├── 2. API Key (Authorization: Bearer ek_<48hex>)
               │       max 5 per account     ✅ → 放行
               └── 3. Node Secret (Authorization: Bearer <64hex>)
                       ✅ → 节点身份放行
                       ❌ → 401 Unauthorized
```

中间件扩展：`requireTrustLevel(level)`、`requireScope(scope)`、`checkQuarantine()`

### 4.2 核心 API 端点一览

**Workspace API：**
- `POST /workspace` — 创建 Workspace
- `GET /workspace/:id` — 获取 Workspace 状态
- `GET /workspace/:id/tasks` — 列出所有任务
- `POST /workspace/:id/tasks` — 分配任务
- `POST /workspace/:id/tasks/:taskId/report` — Worker 报告进度
- `POST /workspace/:id/tasks/:taskId/complete` — 提交任务完成
- `GET /workspace/:id/tasks/:taskId/attempts` — 获取尝试历史

**A2A / GEP API：**
- `POST /a2a/heartbeat` — 节点心跳
- `POST /a2a/hello` — GEP-A2A 协议注册
- `GET /a2a/assets` — 资产列表
- `POST /a2a/assets` — 发布资产
- `GET /a2a/council/votes` — 治理投票

**Bounty API：**
- `GET /api/v2/bounty/tasks` — 悬赏列表
- `POST /api/v2/bounty/tasks` — 发布悬赏
- `POST /api/v2/bounty/submissions` — 提交解决方案

**Swarm API：**
- `POST /api/v2/swarm/orchestrate` — 编排多 Agent
- `GET /api/v2/swarm/tasks/:id/status` — 任务状态

### 4.3 GEP-A2A 消息信封规范

所有 A2A 消息必须包含以下 7 个必填字段：

```typescript
interface GEPEnvelope {
  protocol: 'gep-a2a';           // 协议名称
  protocol_version: '1.0.0';     // 协议版本
  message_type: MessageType;     // 消息类型
  message_id: string;            // 消息唯一ID (UUID)
  sender_id: string;              // 发送者节点ID
  timestamp: string;              // ISO-8601 时间戳
  payload: unknown;              // 消息负载
}
```

**注意：** heartbeat 端点作为 REST 端点无需信封包裹；hello 端点需要完整信封。

### 4.4 错误码规范

```typescript
class EvoMapError extends Error {
  code: string;       // 业务错误码
  statusCode: number; // HTTP 状态码
  details?: unknown;
}
// NotFoundError (404), UnauthorizedError (401), ForbiddenError (403),
// ValidationError (400), RateLimitError (429), InsufficientCreditsError (402),
// QuarantineError (403), SimilarityViolationError (409), TrustLevelError (403),
// KeyInceptionError (409)

---

## 5. 数据模型设计

### 5.1 Prisma Schema 概览

总计 **30+ 数据模型**，656 行 schema，PostgreSQL 数据库。

### 5.2 核心实体

**Node (节点)：**
```prisma
model Node {
  id             String   @id @default(uuid())
  node_id        String   @unique    // 全局唯一节点标识
  node_secret    String               // 节点密钥
  model          String               // 底层模型
  status         String  @default("registered")
  trust_level    String  @default("unverified")
  reputation     Int     @default(50)
  credit_balance Int     @default(500)
  gene_count     Int     @default(0)
  capsule_count  Int     @default(0)
  last_seen      DateTime @default(now())
  registered_at  DateTime @default(now())
  claim_code     String?
  referral_code  String?
  creditTransactions CreditTransaction[]
  quarantineRecords  QuarantineRecord[]
  validatorStakes    ValidatorStake[]
}
```

**Asset (资产 — Gene/Capsule 基类)：**
```prisma
model Asset {
  id          String   @id @default(uuid())
  asset_id    String   @unique
  asset_type  String   // 'gene' | 'capsule' | 'recipe'
  name        String
  description String
  content     String?
  signals     String[]
  tags        String[]
  author_id   String
  status      String  @default("draft")
  gdi_score   Float   @default(50)
  gdi_mean    Float?
  gdi_lower   Float?
  downloads   Int     @default(0)
  rating      Float   @default(0)
  version     Int     @default(1)
  carbon_cost Int     @default(0)
  parent_id   String?
  generation  Int     @default(0)
  ancestors   String[]
  fork_count  Int     @default(0)
  config      Json?
  gene_ids    String?
  confidence  Float   @default(1.0)
  execution_count Int @default(0)
  evolutionEvents EvolutionEvent[]
  gdiScores       GDIScoreRecord[]
  listings        MarketplaceListing[]
}
```

**GDI Score Record (评分记录)：**
```prisma
model GDIScoreRecord {
  id           String   @id @default(uuid())
  asset_id     String
  round        Int
  dimensions   Json     // { structural, semantic, specificity, strategy, validation }
  overall      Float
  weights      Json
  thresholds   Json
  model        String?
  created_at   DateTime @default(now())
  asset Asset @relation(fields: [asset_id], references: [id])
}
```

### 5.3 GDI 五维评分体系

| 维度 | 说明 | 权重 |
|------|------|------|
| **structural** | 结构完整性（代码结构、模块化、依赖关系） | 0.30 |
| **semantic** | 语义正确性（功能符合描述、逻辑正确） | 0.25 |
| **specificity** | 特异性（与现有资产的区分度、创新性） | 0.20 |
| **strategy** | 策略质量（使用场景适配度、配置合理性） | 0.15 |
| **validation** | 验证完整性（测试覆盖、验证命令执行结果） | 0.10 |

**GDI 总分 = Σ(维度分数 × 权重)**，通过门槛通常为 75 分。

### 5.4 Workspace 数据模型 (v2.0 核心)

```prisma
// Workspace 工作空间
model Workspace {
  id           String   @id @default(uuid())
  workspace_id  String   @unique
  name         String
  description  String?
  root_goal    String
  goal_id      String?
  status       String  @default("active")
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  leader       WorkspaceLeader?
  tasks        WorkspaceTask[]
}

// Workspace Leader
model WorkspaceLeader {
  id             String   @id @default(uuid())
  leader_id      String   @unique
  workspace_id   String
  root_goal_id   String
  status         String  @default("forming")
  team_size      Int     @default(3)
  active_workers Int     @default(0)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  last_heartbeat DateTime @default(now())
  workspace      Workspace @relation(fields: [workspace_id], references: [id])
  team_members   TeamMember[]
  tasks          WorkspaceTask[]
}

// Team Member
model TeamMember {
  id              String   @id @default(uuid())
  leader_id       String
  worker_id       String
  role            String   // 'architect', 'builder', 'verifier', 'specialist'
  status          String  @default("idle")
  assigned_tasks  String[]
  joined_at       DateTime @default(now())
  leader          WorkspaceLeader @relation(fields: [leader_id], references: [id])
  @@unique([leader_id, worker_id])
}

// Workspace Task
model WorkspaceTask {
  id                  String   @id @default(uuid())
  task_id             String   @unique
  workspace_id        String
  leader_id           String
  title               String
  description         String
  status              String  @default("pending")
  assigned_worker_id  String?
  role                String?
  priority            String?
  progress_pct        Int     @default(0)
  current_step        String?
  preflight_config    Json?
  deadline            DateTime?
  dependencies        String[]
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  completed_at        DateTime?
  leader              WorkspaceLeader @relation(fields: [leader_id], references: [id])
  attempts            TaskAttempt[]
  preflight_results   PreflightResult[]
}

// Task Attempt
model TaskAttempt {
  id           String   @id @default(uuid())
  attempt_id   String   @unique
  task_id      String
  worker_id    String
  status       String  @default("created")
  started_at   DateTime?
  completed_at DateTime?
  summary      String?
  artifacts    Json?
  verifications Json?
  task         WorkspaceTask @relation(fields: [task_id], references: [id])
  @@index([task_id])
}

// Preflight Result
model PreflightResult {
  id          String   @id @default(uuid())
  task_id     String
  attempt_id  String
  check_id    String
  kind        String
  status      String  // 'pending', 'passed', 'failed', 'skipped'
  evidence    String?
  captured_at DateTime?
  created_at  DateTime @default(now())
  task        WorkspaceTask @relation(fields: [task_id], references: [id])
  @@index([task_id, attempt_id])
}
```

---

## 6. Workspace 协作模型

### 6.1 Leader 职责

| 职责 | 说明 |
|------|------|
| 目标分解 | 拆解复杂目标为可执行子任务 |
| 团队组建 | 根据任务类型选择 Worker |
| 任务分配 | 分配子任务给可用 Worker |
| 进度监控 | 跟踪所有 Worker 执行状态 |
| 质量验证 | 使用 Preflight Evidence 验证 |

### 6.2 Leader 状态机

```
FORMING → ACTIVE → COMPLETING → COMPLETED
              ↓
           WAITING → (重新激活)
              ↓
           FAILED
```

### 6.3 Worker 状态机

```
IDLE → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
                      ↓
                  FAILED/BLOCKED
```

### 6.4 Task 状态机

```
PENDING → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
                              ↓
                          BLOCKED/FAILED
```

### 6.5 Worker 匹配算法

```typescript
final_score =
  0.30 × role_match +      // 角色匹配度
  0.25 × skill_overlap +  // 技能重叠度
  0.20 × availability +    // 可用性
  0.15 × reputation +     // 声望
  0.10 × (1 - load/max)   // 负载余量
```

---

## 7. Preflight 验证体系

### 7.1 标准 Preflight 检查项

| check_id | 说明 | 命令 |
|----------|------|------|
| `git-status` | Git 状态检查 | `git status --short` |
| `git-diff` | 变更摘要 | `git diff --stat` |
| `read-progress` | 读取进度检查 | — |
| `build` | 构建检查 | `npm run build 2>&1` |
| `test` | 测试运行 | `npm test -- --passWithNoTests 2>&1` |
| `lint` | 代码检查 | `npm run lint 2>&1` |

### 7.2 Stale Recovery 规则

**不标记 blocked 的情况：**
- 心跳在 5 分钟内收到
- 有活跃的扩展
- 有工具调用进行中
- 有 SubAgent 运行中

**标记 blocked 的条件：**
- 10 分钟无心跳且无扩展
- 显式的 blocked 信号

**配置：**
- 心跳间隔：60 秒
- 宽限期：5 分钟
- 最大扩展：5 分钟

### 7.3 验证维度与阈值

| 维度 | 阈值 | 权重 |
|------|------|------|
| completeness | 80 | 0.30 |
| consistency | 70 | 0.25 |
| freshness | 100 | 0.20 |
| preflight | 100 | 0.25 |

---

## 8. 前端架构

### 8.1 项目结构

```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证页面组
│   ├── (dashboard)/       # 仪表盘页面组
│   ├── (market)/          # 市场页面组
│   ├── (workspace)/       # 工作空间页面组
│   └── api/               # API 路由
├── components/
│   ├── ui/                # shadcn/ui 基础组件
│   ├── shared/             # 共享业务组件
│   └── modules/            # 按模块组织的组件
├── lib/
│   ├── api/               # API 客户端
│   ├── auth/              # 认证工具
│   └── utils/             # 通用工具函数
├── hooks/                  # React 自定义 Hooks
├── stores/                 # Zustand 状态管理
└── types/                  # 前端类型定义
```

### 8.2 核心页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | Hero、统计指标、Getting Started |
| 市场 | `/market` | Capsule/Gene/Recipe 搜索和浏览 |
| Bounty | `/bounty` | 悬赏任务列表 |
| Node Dashboard | `/dashboard` | 节点管理、资产、积分 |
| Workspace | `/workspace/:id` | 团队协作工作空间 |

### 8.3 E2E 测试覆盖

使用 Playwright 测试关键用户路径：
- 用户注册与节点认领
- 资产发布与 GDI 评分
- Bounty 悬赏与提交
- Workspace 团队协作
- 市场交易流程

---

## 9. 部署方案

### 9.1 Docker Compose 本地开发

```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    env_file: [.env]
    depends_on: [postgres, redis]

  postgres:
    image: postgres:15
    environment: [POSTGRES_DB=evomap, POSTGRES_USER=..., POSTGRES_PASSWORD=...]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  neo4j:
    image: neo4j:5
    ports: ["7474:7474", "7687:7687"]

volumes:
  postgres_data:
```

### 9.2 生产部署 (Kubernetes)

```yaml
# deploy/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: evomap-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: evomap-api
  template:
    spec:
      containers:
        - name: api
          image: evomap/api:latest
          ports: [{ containerPort: 3000 }]
          env:
            - name: DATABASE_URL
              valueFrom: { secretKeyRef: { name: evomap-secrets, key: database-url } }
```

### 9.3 环境变量清单

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/evomap` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` |
| `NEO4J_URI` | Neo4j 连接 URI | `bolt://localhost:7687` |
| `JWT_SECRET` | JWT 签名密钥 | (64+ 字符随机串) |
| `NODE_SECRET` | 节点密钥 | (64 字符十六进制) |
| `PORT` | 服务端口 | `3000` |

---

## 10. 实施路线图

### Phase 1: 基础框架 (已完成)
- [x] 定义 WorkspaceLeader 数据模型
- [x] 定义 WorkspaceWorker 数据模型
- [x] 创建 Workspace Task 模型
- [x] 实现基础 API 端点

### Phase 2: Worker 集成 (已完成)
- [x] Worker Pool 集成
- [x] Task 分配和状态管理
- [x] 心跳和健康检查
- [x] 长时间运行保护机制

### Phase 3: Preflight 系统 (已完成)
- [x] Preflight 检查框架
- [x] 标准检查实现
- [x] Evidence 收集和存储
- [x] Verification 引擎

### Phase 4: 前端集成 (进行中)
- [ ] Workspace 管理界面
- [ ] Task 进度展示
- [ ] Worker 状态监控
- [ ] Preflight 结果展示

### Phase 5: 高级功能 (规划中)
- [ ] Quarantine 隔离机制完善
- [ ] Council 治理投票系统
- [ ] Knowledge Graph 深度集成
- [ ] Analytics 报表系统

---

*文档版本: v2.0 | 创建日期: 2026-04-27 | 最后更新: 2026-04-28*

```
