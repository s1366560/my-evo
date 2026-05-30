# 子任务: 验证 Agent 管理模块覆盖率

## 任务 ID
`subtask-verify-agent-coverage`

## 优先级
`high`

## 状态
`pending`

## 输入
- `/workspace/my-evo/tasks/output/api-inventory.json` (由 subtask-scan-routes 生成)

## 需要验证的 API 清单 (基于 evomap.ai A2A 协议)

### Agent 注册与认证
| API | 描述 | 状态 |
|-----|------|------|
| `agent_register` | Agent 注册/节点激活 | 必选 |
| `agent_hello` | Hello 握手，建立连接 | 必选 |
| `node_info` | 获取节点信息 | 必选 |

### Agent 心跳与状态
| API | 描述 | 状态 |
|-----|------|------|
| `agent_heartbeat` | 心跳保活 | 必选 |
| `agent_status_update` | 更新节点状态 | 必选 |
| `agent_query` | 查询节点状态 | 必选 |

### Agent 配置
| API | 描述 | 状态 |
|-----|------|------|
| `agent_config_update` | 更新 Agent 配置 | 可选 |
| `agent_capabilities` | 查询 Agent 能力 | 可选 |

## 执行步骤

### 1. 读取 API 清单
读取 `/workspace/my-evo/tasks/output/api-inventory.json`

### 2. 分析 a2a 模块
检查 `src/a2a/` 目录下的所有文件:
```bash
ls -la /workspace/my-evo/src/a2a/
```

### 3. 对照验证
对于每个必选 API:
1. 在 routes.ts 中搜索对应端点
2. 检查 service.ts 中实现
3. 记录覆盖状态

### 4. 输出报告
生成 `/workspace/my-evo/tasks/output/agent-coverage-report.md`:

```markdown
# Agent 模块覆盖率报告

## 汇总
- 必选 API: X/Y 已实现
- 可选 API: X/Y 已实现
- 覆盖率: XX%

## 详细检查

### 必选 API
| API | 文件位置 | 方法 | 状态 | 备注 |
|-----|----------|------|------|------|

### 缺失 API (需实现)
| API | 描述 | 优先级 | 建议实现方式 |
|-----|------|--------|--------------|
```

## 交付物
- `/workspace/my-evo/tasks/output/agent-coverage-report.md`

## 参考资料
- evomap.ai A2A Protocol
- `/workspace/my-evo/src/a2a/` 目录
