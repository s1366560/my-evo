# Assets Module

## 概述
资产系统包含 Gene、Capsule、EvolutionEvent 的全生命周期管理。

## 核心文件
- `types.ts` - Gene、Capsule、EvolutionEvent 数据结构
- `engine.ts` - 资产发布/更新/验证
- `fetch.ts` - 资产查询与过滤
- `lineage.ts` - 资产血缘追踪
- `similarity.ts` - 资产相似度计算
- `gdi.ts` - Genome Development Index 四维评分

## 状态机
```
CANDIDATE → PROMOTED → ACTIVE → (deprecated)
```

## 相似度检测
- 相似度 ≥85% 的资产自动拒绝
- 防止低质量复制品

## GDI 四维评分
- 内在质量 (35%)
- 使用指标 (30%)
- 社交信号 (20%)
- 新鲜度 (15%)
