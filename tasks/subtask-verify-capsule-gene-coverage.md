# 子任务: 验证 Capsule 和 Gene 管理覆盖率

## 任务 ID
`subtask-verify-capsule-gene-coverage`

## 优先级
`medium`

## 状态
`pending`

## 输入
- `/workspace/my-evo/tasks/output/api-inventory.json`

## 需要验证的 API 清单

### Capsule 管理
| API | 描述 | 状态 |
|-----|------|------|
| `capsule_create` | 创建 Capsule | 必选 |
| `capsule_query` | 查询 Capsule | 必选 |
| `capsule_validate` | 验证 Capsule | 必选 |
| `capsule_list` | 列出 Capsule | 可选 |

### Gene 管理
| API | 描述 | 状态 |
|-----|------|------|
| `gene_store` | 存储 Gene | 必选 |
| `gene_validate` | 验证 Gene | 必选 |
| `gene_reference` | Gene 引用关系 | 必选 |
| `gene_query` | 查询 Gene | 可选 |

## 执行步骤

### 1. 扫描相关模块
```bash
# 查找 Capsule 和 Gene 相关文件
find /workspace/my-evo/src -type f -name "*.ts" | xargs grep -l -iE "(capsule|gene)" 2>/dev/null | head -30
```

### 2. 分析模块结构
检查目录结构:
- `src/capsule/`
- `src/gene/`
- 或相关路由文件

### 3. 对照验证
对于每个必选 API，记录实现状态

### 4. 输出报告
生成 `/workspace/my-evo/tasks/output/capsule-gene-coverage-report.md`

## 交付物
- `/workspace/my-evo/tasks/output/capsule-gene-coverage-report.md`
