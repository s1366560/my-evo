# 用户反馈与使用数据分析系统

## 概述

本文档描述了 my evo 项目中实现的用户反馈收集、使用数据分析（UX Analytics）和会话指标追踪系统。

## 核心功能

### 1. 用户反馈系统 (UserFeedback)

用户可以通过多种渠道提交反馈：

| 类型 | 说明 | 示例 |
|------|------|------|
| `general` | 一般反馈 | 建议、问题 |
| `bug_report` | Bug 报告 | 功能异常、功能缺失 |
| `feature_request` | 功能请求 | 新功能建议 |
| `ui_feedback` | UI 反馈 | 界面问题、设计改进 |
| `performance_feedback` | 性能反馈 | 加载慢、卡顿 |
| `documentation_feedback` | 文档反馈 | 文档错误、改进 |

**反馈状态流转：**
- `pending` → `reviewed` → `resolved` | `dismissed`

### 2. UX 事件追踪 (UxEvent)

自动收集用户行为数据，用于分析用户使用模式：

| 事件类型 | 说明 |
|----------|------|
| `page_view` | 页面访问 |
| `button_click` | 按钮点击 |
| `form_submit` | 表单提交 |
| `search_query` | 搜索查询 |
| `asset_publish` | 资源发布 |
| `asset_fork` | 资源分叉 |
| `asset_download` | 资源下载 |
| `error_occurred` | 错误发生 |

### 3. 会话指标 (SessionMetric)

追踪用户会话的关键指标：

- **session_type**: 会话类型（探索、搜索、发布等）
- **duration**: 会话时长（秒）
- **event_count**: 事件数量
- **action_count**: 操作数量
- **outcome**: 会话结果（成功、失败、中断）

## API 端点

### 反馈 API

```
POST /api/v2/feedback/feedback          # 提交反馈（公开）
GET  /api/v2/feedback/feedback          # 列出反馈（需认证）
GET  /api/v2/feedback/feedback/:id      # 获取反馈详情（需认证）
PATCH /api/v2/feedback/feedback/:id/status  # 更新状态（需认证）
GET  /api/v2/feedback/feedback/stats    # 获取统计（需认证）
```

### UX 事件 API

```
POST /api/v2/feedback/events/track       # 追踪事件（需认证）
GET  /api/v2/feedback/events             # 列出事件（需认证）
GET  /api/v2/feedback/analytics/ux       # UX 分析摘要（需认证）
```

### 会话指标 API

```
POST /api/v2/feedback/sessions/start     # 开始会话
PATCH /api/v2/feedback/sessions/:id      # 更新会话
POST /api/v2/feedback/sessions/:id/end   # 结束会话
GET  /api/v2/feedback/sessions           # 列出会话（需认证）
```

## 数据分析指标

### 用户行为分析

1. **页面热度分析**: 按访问量排序的页面
2. **用户操作分析**: 最频繁的用户操作
3. **转化漏斗**: 用户从访问到完成目标的转化率
4. **停留时间**: 各页面的平均停留时间

### 性能指标

1. **页面加载时间**: 关键页面的加载性能
2. **API 响应时间**: 后端接口性能
3. **错误率**: 各功能模块的错误发生率

### 用户满意度

1. **平均评分**: 用户对各功能的评分
2. **反馈类型分布**: 各类型反馈的比例
3. **问题解决率**: 反馈被解决的比例

## 前端集成

### React Hook 用法

```typescript
import { createFeedbackTracker } from '@/lib/api/feedback';

// 创建追踪器实例
const tracker = createFeedbackTracker();

// 开始会话
await tracker.startSession('exploration', { page: 'map' });

// 追踪页面访问
await tracker.trackPageView('/map', { referrer: '/dashboard' });

// 追踪按钮点击
await tracker.trackButtonClick('MapControls', 'zoom_in');

// 追踪搜索
await tracker.trackSearch('/map', 'AI agents', 42);

// 结束会话
await tracker.endSession('success', { conversion: true });
```

### 提交反馈表单

```typescript
import { submitFeedback } from '@/lib/api/feedback';

await submitFeedback({
  type: 'bug_report',
  rating: 3,
  category: 'navigation',
  title: '地图缩放不流畅',
  content: '在 Safari 浏览器中，地图缩放操作有明显卡顿',
  metadata: {
    browser: 'Safari 17',
    os: 'macOS Sonoma'
  }
});
```

## 数据库模型

### UserFeedback

| 字段 | 类型 | 说明 |
|------|------|------|
| feedback_id | String (unique) | 反馈唯一标识 |
| user_id | String? | 用户 ID |
| node_id | String? | 节点 ID |
| type | String | 反馈类型 |
| rating | Int? | 评分 (1-5) |
| category | String? | 分类 |
| title | String? | 标题 |
| content | String | 内容 |
| metadata | JSON | 额外数据 |
| status | String | 状态 |
| resolved_at | DateTime? | 解决时间 |
| created_at | DateTime | 创建时间 |

### UxEvent

| 字段 | 类型 | 说明 |
|------|------|------|
| event_id | String (unique) | 事件唯一标识 |
| user_id | String? | 用户 ID |
| node_id | String? | 节点 ID |
| event_type | String | 事件类型 |
| page | String? | 页面路径 |
| component | String? | 组件名 |
| action | String? | 操作名 |
| duration | Int? | 持续时间(毫秒) |
| metadata | JSON | 额外数据 |
| created_at | DateTime | 创建时间 |

### SessionMetric

| 字段 | 类型 | 说明 |
|------|------|------|
| metric_id | String (unique) | 会话唯一标识 |
| user_id | String? | 用户 ID |
| node_id | String? | 节点 ID |
| session_type | String | 会话类型 |
| start_time | DateTime | 开始时间 |
| end_time | DateTime? | 结束时间 |
| duration | Int? | 持续时间(秒) |
| event_count | Int | 事件数 |
| action_count | Int | 操作数 |
| outcome | String? | 会话结果 |
| metadata | JSON | 额外数据 |
| created_at | DateTime | 创建时间 |

## 索引策略

- 按 user_id/node_id 索引用于用户级别分析
- 按 created_at 倒序索引用于最新数据查询
- 按 type/event_type 索引用于分类统计

## 安全考虑

1. **公开端点**: 反馈提交、事件追踪（无认证）
2. **认证端点**: 列表、详情、统计（需认证）
3. **管理员端点**: 状态更新（管理员权限）

## 性能优化

1. **异步处理**: 事件追踪异步执行，不阻塞主流程
2. **批量处理**: 支持批量事件收集后统一提交
3. **数据聚合**: 使用物化视图或定时任务进行数据预聚合
