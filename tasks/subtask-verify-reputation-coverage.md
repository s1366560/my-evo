# 子任务: 验证信誉系统 API 覆盖率

## 任务 ID
`subtask-verify-reputation-coverage`

## 优先级
`medium`

## 状态
`pending`

## 输入
- `/workspace/my-evo/tasks/output/api-inventory.json`

## 需要验证的 API 清单

### 信誉管理
| API | 描述 | 状态 |
|-----|------|------|
| `reputation_update` | 更新信誉分数 | 必选 |
| `reputation_query` | 查询信誉分数 | 必选 |
| `reputation_history` | 信誉历史记录 | 必选 |
| `level_calculate` | 计算等级 | 必选 |

### 信誉事件
| API | 描述 | 状态 |
|-----|------|------|
| `reputation_event_log` | 信誉事件日志 | 可选 |
| `reputation_bonus` | 奖励计算 | 可选 |
| `reputation_penalty` | 惩罚计算 | 可选 |

## 执行步骤

### 1. 分析 reputation 模块
```bash
ls -la /workspace/my-evo/src/reputation/
```

### 2. 读取 routes.ts 和 service.ts
检查 API 实现

### 3. 对照验证
记录每个 API 的实现状态

### 4. 输出报告
生成 `/workspace/my-evo/tasks/output/reputation-coverage-report.md`

## 交付物
- `/workspace/my-evo/tasks/output/reputation-coverage-report.md`
