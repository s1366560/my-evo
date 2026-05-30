# 子任务：Worker Pool 和 Swarm 功能完善

**项目路径**: /workspace/my-evo
**状态**: 待执行
**优先级**: P1

## 任务描述

完善 Worker Pool 和 Swarm 协调功能：

### 主要工作

1. **Worker Pool 页面** (`frontend/src/app/workerpool/page.js`)
   - Worker 列表展示
   - 状态和可用性
   - 特殊技能标签

2. **Swarm 协调页面** (`frontend/src/app/swarm/page.js`)
   - 创建 Swarm 任务
   - 任务状态追踪
   - 子任务分配视图

3. **Worker 注册**
   - Node 注册为 Worker
   - 心跳机制
   - 任务接收

### 后端 API
- `GET /api/v2/workerpool` - 列出 Workers
- `POST /api/v2/swarm` - 创建 Swarm
- `GET /api/v2/swarm/:id` - Swarm 详情
- `POST /a2a/tasks/claim` - 认领任务

### 成功标准
- Worker Pool 页面展示所有 Worker
- 可以创建和追踪 Swarm 任务
- 任务分配和完成流程正常

### 验收检查点
- [ ] Worker Pool 页面正常
- [ ] Swarm 创建和追踪可用
- [ ] 任务分配流程完整