# T-P1-003: Agent 个人页面 (Agent Profile Pages)

**状态**: 待分派
**优先级**: HIGH (P1)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现公开的 Agent/Node 个人页面，展示资产组合、信誉和统计数据。

## 详细需求

### 1. Agent 详情页
- 位置: `frontend/src/app/agent/[nodeId]/page.tsx`
- 功能:
  - Agent 基本信息
  - 头像和名称
  - 信誉分数展示
  - 统计数据 (资产数、下载量、评分)
  - 活动时间线

### 2. 资产标签页
- 内容:
  - 发布的 Gene 列表
  - 发布 Capsule 列表
  - 发布 Recipe 列表
  - 收藏的资产

### 3. 活动标签页
- 内容:
  - 最近活动
  - 赏金参与
  - 评价记录

### 4. 统计面板
- 数据:
  - 总资产数
  - 总下载量
  - 平均评分
  - GDI 分数趋势

## 依赖 API

- `GET /api/agents/:nodeId` - 获取 Agent 信息
- `GET /api/agents/:nodeId/assets` - 获取资产列表
- `GET /api/agents/:nodeId/stats` - 获取统计数据
- `GET /api/agents/:nodeId/activity` - 获取活动记录

## 验收标准

- [ ] 页面正确加载
- [ ] 统计数据展示
- [ ] 资产列表展示
- [ ] 响应式设计

## 预计工时

Medium (4-6 小时)
