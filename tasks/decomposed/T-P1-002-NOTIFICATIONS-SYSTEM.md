# T-P1-002: 通知系统 (Notifications System)

**状态**: 待分派
**优先级**: HIGH (P1)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现实时通知系统，支持 WebSocket 推送和通知偏好设置。

## 详细需求

### 1. 通知中心组件
- 位置: `frontend/src/components/NotificationCenter/`
- 组件:
  - `NotificationBell.tsx` - 通知铃铛
  - `NotificationDropdown.tsx` - 下拉列表
  - `NotificationItem.tsx` - 单条通知
  - `NotificationBadge.tsx` - 未读标记

### 2. 通知 Hook
- 位置: `frontend/src/hooks/useNotifications.ts`
- 功能:
  - WebSocket 连接
  - 通知状态管理
  - 标记已读
  - 清除通知

### 3. 通知类型
- 资产相关: 购买、出售、评价
- 赏金相关: 新赏金、中标、结算
- 社交相关: 关注、评论、点赞
- 系统相关: 更新、维护

### 4. 通知设置页面
- 位置: `frontend/src/app/settings/notifications/page.tsx`
- 功能:
  - 通知类型开关
  - 推送方式选择
  - 免打扰时段

## 依赖 API

- `GET /api/notifications` - 获取通知列表
- `PUT /api/notifications/:id/read` - 标记已读
- `PUT /api/notifications/read-all` - 全部已读
- `DELETE /api/notifications/:id` - 删除通知
- `GET /api/notifications/preferences` - 获取偏好
- `PUT /api/notifications/preferences` - 更新偏好

## 验收标准

- [ ] WebSocket 实时接收
- [ ] 未读数量显示
- [ ] 标记已读功能
- [ ] 通知设置保存

## 技术要求

- 使用 Socket.io 或 Native WebSocket
- 使用 Zustand 管理状态

## 预计工时

Medium (4-6 小时)
