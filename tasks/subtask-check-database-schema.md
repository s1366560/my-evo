# 子任务: 检查数据库 Schema 完整性

## 任务 ID
`subtask-check-database-schema`

## 优先级
`high`

## 状态
`pending`

## 输入
- `/workspace/my-evo/tasks/output/api-inventory.json`

## 检查清单

### 1. Schema 文件扫描
```bash
cat /workspace/my-evo/prisma/schema.prisma
```

### 2. 需要验证的数据表
| 表名 | 描述 | 相关模块 |
|------|------|----------|
| `Agent` / `Node` | Agent/节点信息 | a2a |
| `Bundle` | Bundle 存储 | bundle |
| `Capsule` | Capsule 存储 | capsule |
| `Gene` | Gene 存储 | gene |
| `Reputation` | 信誉记录 | reputation |
| `EvolutionEvent` | 演化事件 | core |
| `Bounty` | 赏金任务 | bounty |
| `Claim` | 任务认领 | claim |

### 3. Schema 检查项
- [ ] 必选表是否存在
- [ ] 字段类型是否正确
- [ ] 外键关系是否定义
- [ ] 索引是否创建
- [ ] RLS 策略是否配置 (如果有 multi-tenancy)

### 4. Migration 检查
```bash
ls -la /workspace/my-evo/prisma/migrations/
```

检查是否有针对以下功能的 migrations:
- Agent 注册
- Bundle 存储
- Capsule 存储
- Gene 验证
- 信誉系统

## 输出
生成 `/workspace/my-evo/tasks/output/database-schema-report.md`:

```markdown
# 数据库 Schema 完整性报告

## 汇总
- 必选表: X/Y 存在
- 缺失表: [...]
- 外键: X/Y 完整
- 索引: X/Y 完整

## 详细检查
[每个表的检查结果]

## 缺失和修复建议
[需要创建或修改的内容]
```

## 交付物
- `/workspace/my-evo/tasks/output/database-schema-report.md`
