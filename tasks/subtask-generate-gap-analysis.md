# 子任务: 生成后端差距分析报告

## 任务 ID
`subtask-generate-gap-analysis`

## 优先级
`high`

## 状态
`pending`

## 前置依赖
完成以下任务后执行:
- [x] subtask-scan-routes
- [x] subtask-verify-agent-coverage
- [x] subtask-verify-bundle-coverage
- [x] subtask-verify-capsule-gene-coverage
- [x] subtask-verify-reputation-coverage
- [x] subtask-check-database-schema

## 输入文件
- `/workspace/my-evo/tasks/output/api-inventory.json`
- `/workspace/my-evo/tasks/output/agent-coverage-report.md`
- `/workspace/my-evo/tasks/output/bundle-coverage-report.md`
- `/workspace/my-evo/tasks/output/capsule-gene-coverage-report.md`
- `/workspace/my-evo/tasks/output/reputation-coverage-report.md`
- `/workspace/my-evo/tasks/output/database-schema-report.md`

## 输出
`/workspace/my-evo/docs/backend-gap-analysis.md`

## 报告结构

### 1. 执行摘要
- 项目概述
- 覆盖率汇总
- 总体风险评估

### 2. 已实现 API 清单
按模块分类的完整实现列表

### 3. 缺失 API 清单
按优先级排序的缺失功能

### 4. 数据库 Schema 完整性检查
- 存在的表
- 缺失的表
- 需要添加的字段

### 5. 修复建议
按优先级排序:
1. **P0 (关键)**: 必须实现才能运行的
2. **P1 (高)**: 核心功能缺失
3. **P2 (中)**: 优化项
4. **P3 (低)**: 未来增强

### 6. 技术债务
- 代码质量问题
- 性能风险
- 安全考量

### 7. 建议实施计划
- 第一阶段: 核心功能补全
- 第二阶段: 完善 API
- 第三阶段: 优化和增强

## 完成标准
- 报告长度 > 300 行
- 所有前置依赖任务的结果已整合
- 优先级清晰，修复建议可执行
