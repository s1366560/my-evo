# My Evo Workspace 架构设计文档 v1.0

> 版本: 1.0 | 状态: 初稿 | 目标: 复刻 evomap.ai 核心功能，实现前后端功能闭环

## 1. 系统概览

### 1.1 核心能力矩阵

| 能力 | 说明 | 状态 |
|------|------|------|
| GEP 协议 | 基因组进化协议 | ✅ |
| GDI 评分 | 多维质量评估 | ✅ |
| Swarm 协作 | 多 Agent 任务执行 | ✅ |
| Worker Pool | 分布式任务引擎 | ✅ |
| Bounty 系统 | 悬赏任务市场 | ✅ |
| **Workspace 协作** | Leader-Worker 模型 | 🔄 开发中 |

## 2. Workspace Leader 模型

### 2.1 Leader 职责

| 职责 | 说明 |
|------|------|
| 目标分解 | 拆解复杂目标为可执行子任务 |
| 团队组建 | 根据任务类型选择 Worker |
| 任务分配 | 分配子任务给可用 Worker |
| 进度监控 | 跟踪所有 Worker 执行状态 |
| 质量验证 | 使用 Preflight Evidence 验证 |

### 2.2 Leader 数据模型

```typescript
interface WorkspaceLeader {
  leader_id: string;
  workspace_id: string;
  root_goal_id: string;
  status: 'forming' | 'active' | 'waiting' | 'completing' | 'completed' | 'failed';
  team_members: TeamMember[];
  total_tasks: number;
  completed_tasks: number;
  blocked_tasks: number;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  worker_id: string;
  role: 'architect' | 'builder' | 'verifier' | 'specialist';
  assigned_tasks: string[];
  status: 'idle' | 'busy' | 'offline';
}
```

### 2.3 团队组建流程

```
接收目标 → 目标分析 → Worker 匹配 → 团队邀请 → 任务分配
```

### 2.4 Worker 匹配算法

```typescript
// 匹配公式
final_score =
  0.30 × role_match +      // 角色匹配度
  0.25 × skill_overlap +  // 技能重叠度
  0.20 × availability +   // 可用性
  0.15 × reputation +     // 声望
  0.10 × (1 - load/max)   // 负载余量
```

## 3. Workspace Worker 模型

### 3.1 Worker 状态机

```
IDLE → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
                      ↓
                  FAILED/BLOCKED
```

### 3.2 Worker 数据模型

```typescript
interface WorkspaceWorker {
  worker_id: string;
  agent_id: string;
  status: 'idle' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'failed' | 'blocked';
  current_tasks: TaskBinding[];
  capabilities: Capability[];
  max_concurrent_tasks: number;
  last_heartbeat: string;
}

interface TaskBinding {
  task_id: string;
  workspace_id: string;
  workspace_task_id: string;
  attempt_id: string;
  leader_id: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'failed';
  preflight_checks: PreflightCheck[];
  progress_pct: number;
  deadline: string;
}
```

### 3.3 长时间运行保护

**问题**: Worker 长时间工具调用可能被 stale recovery 误标 blocked。

**解决方案**:

```typescript
// 1. 心跳扩展机制
interface HeartbeatExtension {
  task_id: string;
  worker_id: string;
  extended_until: string;
  reason: 'tool_call' | 'compile' | 'test_run';
  estimated_duration_ms: number;
}

// 2. Stale Recovery 规则
const STALE_RULES = {
  NOT_BLOCKED: [
    'heartbeat_within_5min',
    'has_active_extension',
    'has_tool_call_in_progress'
  ],
  BLOCKED_WHEN: [
    'no_heartbeat_for_10min_without_extension',
    'explicit_blocked_signal'
  ]
};
```

## 4. Preflight Evidence 数据模型

### 4.1 核心类型

```typescript
// 现有 PreflightCheck (verifier/types.ts)
export interface PreflightCheck {
  check_id: string;
  kind: string;           // 'git_status', 'read_progress', etc.
  command?: string | null;
  required: boolean;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  evidence?: string | null;
  completed_at?: string | null;
}

// 扩展 Evidence 类型
interface PreflightEvidence {
  evidence_id: string;
  task_id: string;
  worker_id: string;
  check_id: string;
  check_kind: 'git_status' | 'read_progress' | 'file_exists' | 'test_run' | 'build_status' | 'api_contract';
  evidence_type: 'text' | 'json' | 'file' | 'screenshot' | 'log';
  evidence_content: string | object;
  captured_at: string;
  capture_method: 'command' | 'file_read' | 'api_call' | 'system';
  verified: boolean;
}

// VerificationResult 维度
interface VerificationResult {
  dimension: 'completeness' | 'consistency' | 'freshness' | 'preflight';
  passed: boolean;
  score: number;         // 0-100
  messages: string[];
  details?: Record<string, unknown>;
}
```

### 4.2 标准 Preflight 配置

```typescript
const PREFLIGHT_CHECKS = {
  code_change: [
    { check_id: 'git-status', kind: 'git_status', command: 'git status --short', required: true },
    { check_id: 'git-diff', kind: 'git_diff', command: 'git diff --stat', required: true }
  ],
  test: [
    { check_id: 'test-run', kind: 'test_run', command: 'npm test 2>&1', required: true }
  ],
  build: [
    { check_id: 'build', kind: 'build_status', command: 'npm run build 2>&1', required: true }
  ]
};
```

## 5. API 契约

### 5.1 Workspace API

#### 创建 Workspace
```
POST /api/v2/workspace
Auth: Bearer <node_secret>

Request:
{
  "name": "string",
  "description": "string",
  "root_goal": "string",
  "leader_config": {
    "auto_form_team": true,
    "team_size": 3,
    "roles": ["architect", "builder", "verifier"]
  }
}

Response 201:
{
  "success": true,
  "data": {
    "workspace_id": "ws_xxx",
    "leader_id": "ldr_xxx",
    "root_goal_id": "goal_xxx",
    "status": "forming"
  }
}
```

#### 获取 Workspace 状态
```
GET /api/v2/workspace/:workspaceId

Response 200:
{
  "success": true,
  "data": {
    "workspace_id": "ws_xxx",
    "status": "active",
    "root_goal": {
      "goal_id": "goal_xxx",
      "progress": 0.65,
      "child_tasks": [...]
    },
    "leader": {
      "leader_id": "ldr_xxx",
      "status": "active",
      "team_members": [...]
    },
    "stats": {
      "total_tasks": 10,
      "completed": 6,
      "in_progress": 2,
      "blocked": 1
    }
  }
}
```

### 5.2 Task API

#### 分配任务
```
POST /api/v2/workspace/:workspaceId/tasks
Auth: Bearer <leader_secret>

Request:
{
  "title": "string",
  "description": "string",
  "assigned_worker_id": "wrk_xxx",
  "preflight_config": {
    "checks": ["git-status", "read-progress"],
    "required": true
  },
  "deadline": "2026-04-28T00:00:00Z"
}

Response 201:
{
  "success": true,
  "data": {
    "task_id": "tsk_xxx",
    "workspace_task_id": "wst_xxx",
    "attempt_id": "att_xxx",
    "status": "assigned"
  }
}
```

#### Worker 报告进度
```
POST /api/v2/workspace/:workspaceId/tasks/:taskId/report
Auth: Bearer <worker_secret>

Request:
{
  "status": "in_progress",
  "progress_pct": 45,
  "current_step": "Implementing feature X",
  "preflight_evidence": [
    {
      "check_id": "git-status",
      "evidence_content": "M src/file.ts",
      "captured_at": "2026-04-27T00:00:00Z"
    }
  ],
  "heartbeat_extension": {
    "reason": "tool_call",
    "estimated_duration_ms": 60000
  }
}

Response 200:
{
  "success": true,
  "data": {
    "acknowledged": true,
    "next_heartbeat_in_ms": 60000
  }
}
```

#### 提交任务完成
```
POST /api/v2/workspace/:workspaceId/tasks/:taskId/complete
Auth: Bearer <worker_secret>

Request:
{
  "summary": "Task completed successfully",
  "artifacts": ["file1.ts", "file2.md"],
  "verifications": [
    "preflight:git-status",
    "preflight:read-progress",
    "test_run:npm test"
  ],
  "preflight_checklist": [
    { "check_id": "git-status", "status": "passed", "evidence": "..." },
    { "check_id": "read-progress", "status": "passed", "evidence": "..." }
  ]
}

Response 200:
{
  "success": true,
  "data": {
    "task_id": "tsk_xxx",
    "status": "completed",
    "verified": true,
    "verification_results": [...]
  }
}
```

### 5.3 Worker Pool 集成

```
GET /api/v2/workerpool/workers
POST /api/v2/workerpool/register
GET /api/v2/workerpool/workers/:id
POST /api/v2/workerpool/match
```

## 6. 状态机设计

### 6.1 Workspace 状态机

```
FORMING → ACTIVE → COMPLETING → COMPLETED
              ↓
           WAITING → (重新激活)
              ↓
           FAILED
```

### 6.2 Task 状态机

```
PENDING → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
                              ↓
                          BLOCKED/FAILED
```

### 6.3 Attempt 状态机

```
CREATED → RUNNING → COMPLETED
              ↓
          BLOCKED
```

## 7. 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Leader                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ 目标分解    │  │ 团队组建    │  │ 进度监控    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Task Broker                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 任务队列: pending → assigned → in_progress → completed     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Worker                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Architect   │  │ Builder     │  │ Verifier    │            │
│  │ (分析设计)  │  │ (代码实现)  │  │ (验证测试)  │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Preflight Evidence                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • git status --short                                       ││
│  │ • npm test                                                 ││
│  │ • npm run build                                            ││
│  │ • API contract verification                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 8. Prisma 数据模型扩展

```prisma
// Workspace Leader
model WorkspaceLeader {
  id             String   @id @default(uuid())
  leader_id      String   @unique
  workspace_id   String
  root_goal_id   String
  status         String   @default("forming")
  team_size      Int      @default(3)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  
  workspace      Workspace @relation(fields: [workspace_id], references: [id])
  team_members   TeamMember[]
  tasks          WorkspaceTask[]
}

// Team Member
model TeamMember {
  id           String   @id @default(uuid())
  leader_id    String
  worker_id    String
  role         String   // 'architect', 'builder', 'verifier', 'specialist'
  status       String   @default("idle")
  joined_at    DateTime @default(now())
  
  leader       WorkspaceLeader @relation(fields: [leader_id], references: [id])
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
  status              String   @default("pending")
  assigned_worker_id  String?
  progress_pct        Int      @default(0)
  preflight_config    Json?
  deadline            DateTime?
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  
  leader              WorkspaceLeader @relation(fields: [leader_id], references: [id])
  attempts            TaskAttempt[]
  preflight_results   PreflightResult[]
}

// Task Attempt
model TaskAttempt {
  id             String   @id @default(uuid())
  attempt_id     String   @unique
  task_id        String
  worker_id      String
  status         String   @default("created")
  started_at     DateTime?
  completed_at   DateTime?
  summary        String?
  artifacts      Json?
  verifications  Json?
  
  task           WorkspaceTask @relation(fields: [task_id], references: [id])
  @@index([task_id])
}

// Preflight Result
model PreflightResult {
  id           String   @id @default(uuid())
  task_id      String
  attempt_id   String
  check_id     String
  kind         String
  status       String   // 'pending', 'passed', 'failed', 'skipped'
  evidence     String?
  captured_at  DateTime?
  created_at   DateTime @default(now())
  
  task         WorkspaceTask @relation(fields: [task_id], references: [id])
  @@index([task_id, attempt_id])
}
```

## 9. 实施路线图

### Phase 1: 基础框架 (1-2 周)
- [ ] 定义 WorkspaceLeader 数据模型
- [ ] 定义 WorkspaceWorker 数据模型
- [ ] 创建 Workspace Task 模型
- [ ] 实现基础 API 端点

### Phase 2: Worker 集成 (2-3 周)
- [ ] Worker Pool 集成
- [ ] Task 分配和状态管理
- [ ] 心跳和健康检查
- [ ] 长时间运行保护机制

### Phase 3: Preflight 系统 (2 周)
- [ ] Preflight 检查框架
- [ ] 标准检查实现
- [ ] Evidence 收集和存储
- [ ] Verification 引擎

### Phase 4: 前端集成 (2 周)
- [ ] Workspace 管理界面
- [ ] Task 进度展示
- [ ] Worker 状态监控
- [ ] Preflight 结果展示

---

*文档版本: v1.0 | 创建日期: 2026-04-27*
