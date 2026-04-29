# 子任务: 验证 Bundle 管理模块覆盖率

## 任务 ID
`subtask-verify-bundle-coverage`

## 优先级
`high`

## 状态
`pending`

## 输入
- `/workspace/my-evo/tasks/output/api-inventory.json`

## 需要验证的 API 清单 (基于 evomap.ai publish 协议)

### Bundle 操作
| API | 描述 | 状态 |
|-----|------|------|
| `bundle_create` | 创建新 Bundle | 必选 |
| `bundle_publish` | 发布 Bundle 到网络 | 必选 |
| `bundle_query` | 查询单个 Bundle | 必选 |
| `bundle_list` | 列出 Bundle (分页) | 必选 |
| `bundle_validate` | 验证 Bundle 格式 | 必选 |

### Bundle 元数据
| API | 描述 | 状态 |
|-----|------|------|
| `bundle_update` | 更新 Bundle | 可选 |
| `bundle_delete` | 删除 Bundle | 可选 |
| `bundle_stats` | 获取 Bundle 统计 | 可选 |

## 执行步骤

### 1. 扫描 Bundle 相关模块
```bash
# 查找所有与 bundle 相关的文件
find /workspace/my-evo/src -type f -name "*.ts" | xargs grep -l -i "bundle" 2>/dev/null
```

### 2. 分析模块结构
检查是否存在:
- `src/bundle/` 目录
- 或 bundle 相关的 routes/service

### 3. 对照验证
对于每个必选 API:
1. 在相关文件中搜索
2. 检查实现完整性
3. 记录覆盖状态

### 4. 输出报告
生成 `/workspace/my-evo/tasks/output/bundle-coverage-report.md`

## 交付物
- `/workspace/my-evo/tasks/output/bundle-coverage-report.md`

## 参考资料
- evomap.ai Publish Protocol
- `/workspace/my-evo/src/` 目录
