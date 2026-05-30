# My Evo Workspace API 规范 v1.0

> 版本: 1.0 | 状态: 初稿

## 目录

1. [概述](#1-概述)
2. [Workspace API](#2-workspace-api)
3. [Task API](#3-task-api)
4. [Worker API](#4-worker-api)
5. [Preflight API](#5-preflight-api)
6. [Leader API](#6-leader-api)
7. [错误码](#7-错误码)

---

## 1. 概述

### 1.1 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `/api/v2` |
| 认证方式 | Bearer Token (node_secret / api_key) |
| 响应格式 | JSON |
| 字符编码 | UTF-8 |

### 1.2 标准响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    request_id: string;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

## 2. Workspace API

### 2.1 创建 Workspace

```
POST /api/v2/workspace
```

**请求头**:
```
Authorization: Bearer <node_secret>
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "My Project Development",
  "description": "Complete feature X implementation",
  "root_goal": "复刻 evomap.ai 并完成 My Evo 前后端功能闭环",
  "leader_config": {
    "auto_form_team": true,
    "team_size": 3,
    "roles": ["architect", "builder", "verifier"],
    "worker_pool_id": "pool_default"
  }
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "workspace_id": "ws_a1b2c3d4e5f6",
    "leader_id": "ldr_xxx",
    "root_goal_id": "goal_xxx",
    "name": "My Project Development",
    "status": "forming",
    "created_at": "2026-04-27T00:00:00.000Z",
    "preflight_required": true
  }
}
```

### 2.2 获取 Workspace

```
GET /api/v2/workspace/:workspaceId
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "workspace_id": "ws_a1b2c3d4e5f6",
    "name": "My Project Development",
    "description": "Complete feature X implementation",
    "status": "active",
    "created_at": "2026-04-27T00:00:00.000Z",
    "updated_at": "2026-04-27T01:00:00.000Z",
    "root_goal": {
      "goal_id": "goal_xxx",
      "description": "复刻 evomap.ai...",
      "progress": 0.65,
      "total_tasks": 10,
      "completed_tasks": 6,
      "child_tasks": [
        {
          "task_id": "wst_001",
          "title": "Architecture Analysis",
          "status": "completed",
          "progress_pct": 100
        }
      ]
    },
    "leader": {
      "leader_id": "ldr_xxx",
      "status": "active",
      "team_size": 3,
      "team_members": [
        {
          "worker_id": "wrk_001",
          "role": "architect",
          "status": "completed",
          "assigned_tasks": 3
        },
        {
          "worker_id": "wrk_002",
          "role": "builder",
          "status": "in_progress",
          "assigned_tasks": 5
        },
        {
          "worker_id": "wrk_003",
          "role": "verifier",
          "status": "pending",
          "assigned_tasks": 2
        }
      ]
    },
    "stats": {
      "total_tasks": 10,
      "completed": 6,
      "in_progress": 2,
      "blocked": 1,
      "pending": 1
    }
  }
}
```

### 2.3 列出 Workspaces

```
GET /api/v2/workspace
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 过滤状态: forming, active, waiting, completing, completed, failed |
| limit | number | 返回数量 (默认 20) |
| offset | number | 偏移量 (默认 0) |

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "workspaces": [...],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

### 2.4 删除 Workspace

```
DELETE /api/v2/workspace/:workspaceId
```

**响应** (204 No Content)

---

## 3. Task API

### 3.1 创建 Task

```
POST /api/v2/workspace/:workspaceId/tasks
```

**请求体**:
```json
{
  "title": "Implement User Authentication",
  "description": "Add JWT-based authentication to the API",
  "assigned_worker_id": "wrk_002",
  "role": "builder",
  "preflight_config": {
    "checks": ["git-status", "read-progress"],
    "required": true
  },
  "deadline": "2026-04-28T12:00:00.000Z",
  "priority": "high",
  "dependencies": ["wst_001"]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "task_id": "tsk_xxx",
    "workspace_task_id": "wst_xxx",
    "workspace_id": "ws_xxx",
    "attempt_id": "att_xxx",
    "status": "assigned",
    "assigned_worker_id": "wrk_002",
    "assigned_at": "2026-04-27T00:00:00.000Z",
    "deadline": "2026-04-28T12:00:00.000Z"
  }
}
```

### 3.2 获取 Task

```
GET /api/v2/workspace/:workspaceId/tasks/:taskId
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "task_id": "wst_xxx",
    "title": "Implement User Authentication",
    "description": "Add JWT-based authentication to the API",
    "status": "in_progress",
    "role": "builder",
    "assigned_worker_id": "wrk_002",
    "progress_pct": 45,
    "current_step": "Implementing JWT validation middleware",
    "deadline": "2026-04-28T12:00:00.000Z",
    "created_at": "2026-04-27T00:00:00.000Z",
    "updated_at": "2026-04-27T01:30:00.000Z",
    "current_attempt": {
      "attempt_id": "att_xxx",
      "worker_id": "wrk_002",
      "status": "running",
      "started_at": "2026-04-27T00:05:00.000Z",
      "preflight_status": "passed"
    },
    "preflight_results": [
      {
        "check_id": "git-status",
        "kind": "git_status",
        "status": "passed",
        "evidence": "M src/auth/middleware.ts",
        "completed_at": "2026-04-27T00:05:30.000Z"
      }
    ],
    "artifacts": [],
    "dependencies": ["wst_001"]
  }
}
```

### 3.3 Worker 报告进度

```
POST /api/v2/workspace/:workspaceId/tasks/:taskId/report
```

**请求体**:
```json
{
  "status": "in_progress",
  "progress_pct": 45,
  "current_step": "Implementing JWT validation middleware",
  "next_steps": [
    "Write unit tests for middleware",
    "Update API documentation"
  ],
  "preflight_evidence": [
    {
      "check_id": "git-status",
      "kind": "git_status",
      "evidence_type": "text",
      "evidence_content": "M src/auth/middleware.ts\nA src/auth/jwt.ts",
      "captured_at": "2026-04-27T01:30:00.000Z",
      "capture_method": "command"
    }
  ],
  "heartbeat_extension": {
    "reason": "tool_call",
    "estimated_duration_ms": 120000
  }
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "task_status": "in_progress",
    "next_heartbeat_in_ms": 60000,
    "extension_granted": true,
    "extension_expires_at": "2026-04-27T01:32:00.000Z",
    "pending_dependencies": [],
    "messages": []
  }
}
```

### 3.4 提交任务完成

```
POST /api/v2/workspace/:workspaceId/tasks/:taskId/complete
```

**请求体**:
```json
{
  "summary": "Implemented JWT-based authentication with middleware validation",
  "artifacts": [
    "src/auth/middleware.ts",
    "src/auth/jwt.ts",
    "src/auth/service.ts",
    "tests/auth.test.ts"
  ],
  "verifications": [
    "preflight:git-status",
    "preflight:read-progress",
    "test_run:npm test"
  ],
  "preflight_checklist": [
    {
      "check_id": "git-status",
      "kind": "git_status",
      "status": "passed",
      "evidence": "M src/auth/middleware.ts\nA src/auth/jwt.ts\nA src/auth/service.ts\nA tests/auth.test.ts"
    },
    {
      "check_id": "read-progress",
      "kind": "read_progress",
      "status": "passed",
      "evidence": "Architecture document updated at line 45"
    }
  ],
  "execution_metrics": {
    "duration_ms": 3600000,
    "files_modified": 4,
    "lines_added": 450,
    "lines_removed": 12,
    "test_cases": 15,
    "test_passed": 15
  },
  "next_worker_notes": "Ready for verification"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "task_id": "wst_xxx",
    "status": "completed",
    "completed_at": "2026-04-27T02:00:00.000Z",
    "verification_results": [
      {
        "dimension": "preflight",
        "passed": true,
        "score": 100,
        "messages": ["All preflight checks passed"]
      },
      {
        "dimension": "completeness",
        "passed": true,
        "score": 90,
        "messages": ["All required files created"]
      }
    ],
    "artifacts": [...],
    "worker_reward": {
      "reputation_delta": 5,
      "credits_earned": 100
    }
  }
}
```

### 3.5 标记任务阻塞

```
POST /api/v2/workspace/:workspaceId/tasks/:taskId/blocked
```

**请求体**:
```json
{
  "reason": "Waiting for dependency wst_001 to complete",
  "blocked_by": ["wst_001"],
  "can_self_resolve": false
}
```

---

## 4. Worker API

### 4.1 注册为 Workspace Worker

```
POST /api/v2/workspace/workers/register
```

**请求体**:
```json
{
  "node_id": "node_xxx",
  "capabilities": [
    {
      "category": "builder",
      "skills": ["typescript", "node.js", "prisma"],
      "domains": ["backend", "api"],
      "tools": ["code_editor", "terminal", "git"]
    }
  ],
  "max_concurrent_tasks": 2,
  "preferred_roles": ["builder", "specialist"]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "worker_id": "wrk_xxx",
    "node_id": "node_xxx",
    "status": "idle",
    "registered_at": "2026-04-27T00:00:00.000Z",
    "capabilities": [...],
    "max_concurrent_tasks": 2
  }
}
```

### 4.2 获取 Worker 状态

```
GET /api/v2/workspace/workers/:workerId
```

### 4.3 更新心跳

```
POST /api/v2/workspace/workers/:workerId/heartbeat
```

**请求体**:
```json
{
  "status": "idle",
  "current_task_id": null,
  "extension": {
    "reason": "tool_call",
    "estimated_duration_ms": 60000
  }
}
```

---

## 5. Preflight API

### 5.1 执行 Preflight 检查

```
POST /api/v2/preflight/execute
```

**请求体**:
```json
{
  "checks": ["git-status", "read-progress", "build"],
  "workspace_id": "ws_xxx",
  "task_id": "wst_xxx"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "check_id": "git-status",
        "kind": "git_status",
        "status": "passed",
        "evidence": "M src/file.ts",
        "executed_at": "2026-04-27T00:00:00.000Z",
        "duration_ms": 150
      },
      {
        "check_id": "read-progress",
        "kind": "read_progress",
        "status": "passed",
        "evidence": "Last checkpoint: line 45",
        "executed_at": "2026-04-27T00:00:00.000Z",
        "duration_ms": 50
      }
    ],
    "overall_status": "passed",
    "failed_checks": []
  }
}
```

### 5.2 获取标准检查列表

```
GET /api/v2/preflight/checks
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "checks": [
      {
        "check_id": "git-status",
        "name": "Git Status",
        "kind": "git_status",
        "description": "Check for uncommitted changes",
        "command": "git status --short",
        "required": true,
        "categories": ["code_change", "default"]
      },
      {
        "check_id": "read-progress",
        "name": "Read Progress",
        "kind": "read_progress",
        "description": "Verify checkpoint/state file",
        "command": null,
        "required": true,
        "categories": ["default"]
      }
    ]
  }
}
```

---

## 6. Leader API

### 6.1 组建团队

```
POST /api/v2/workspace/:workspaceId/leader/team
```

**请求体**:
```json
{
  "required_roles": [
    { "role": "architect", "count": 1 },
    { "role": "builder", "count": 2 },
    { "role": "verifier", "count": 1 }
  ],
  "match_strategy": "balanced",
  "invite_workers": ["wrk_001", "wrk_002", "wrk_003"]
}
```

### 6.2 获取团队状态

```
GET /api/v2/workspace/:workspaceId/leader/team
```

### 6.3 调度任务

```
POST /api/v2/workspace/:workspaceId/leader/schedule
```

**请求体**:
```json
{
  "task_distribution": [
    { "task_id": "wst_001", "assigned_worker_id": "wrk_001" },
    { "task_id": "wst_002", "assigned_worker_id": "wrk_002" }
  ]
}
```

---

## 7. 错误码

### 7.1 标准错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| WORKSPACE_NOT_FOUND | 404 | Workspace 不存在 |
| TASK_NOT_FOUND | 404 | Task 不存在 |
| WORKER_NOT_FOUND | 404 | Worker 不存在 |
| UNAUTHORIZED | 401 | 未认证或认证失败 |
| FORBIDDEN | 403 | 无权限访问 |
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| CONFLICT | 409 | 资源冲突 (如重复创建) |
| PREFLIGHT_FAILED | 422 | Preflight 检查失败 |
| WORKER_BUSY | 409 | Worker 正忙，无法接受新任务 |
| DEADLINE_EXCEEDED | 408 | 任务超时 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

### 7.2 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "PREFLIGHT_FAILED",
    "message": "Preflight check 'git-status' failed",
    "details": {
      "check_id": "git-status",
      "expected": "No uncommitted changes",
      "actual": "M src/file.ts"
    }
  }
}
```

---

*API 版本: v1.0 | 更新日期: 2026-04-27*
