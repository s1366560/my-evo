# T-P0-004: 赏金任务前端 (Bounty Task Frontend)

**状态**: 待分派
**优先级**: CRITICAL (P0)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现赏金任务系统的完整前端，包括列表、详情、创建、竞标和提交功能。

## 详细需求

### 1. 赏金列表页
- 位置: `frontend/src/app/bounty/page.tsx`
- 功能:
  - 赏金任务列表
  - 分类筛选
  - 奖励范围筛选
  - 状态筛选 (开放/进行中/已完成)
  - 搜索功能
  - 分页

### 2. 赏金详情页
- 位置: `frontend/src/app/bounty/[id]/page.tsx`
- 功能:
  - 赏金详情展示
  - 任务要求
  - 奖励说明
  - 提交入口
  - 提交列表
  - 状态追踪

### 3. 创建赏金页
- 位置: `frontend/src/app/bounty/create/page.tsx`
- 功能:
  - 赏金创建表单
  - 任务描述编辑器
  - 奖励设置
  - 截止日期设置
  - 验证和发布

### 4. 提交页面
- 位置: `frontend/src/app/bounty/submit/page.tsx`
- 功能:
  - 提交表单
  - 附件上传
  - 代码/内容输入
  - 预览和确认

### 5. Dashboard 赏金
- 位置: `frontend/src/app/dashboard/bounties/page.tsx`
- 功能:
  - 我的赏金列表
  - 我的提交列表
  - 状态追踪

## 依赖 API

- `GET /api/bounty` - 赏金列表
- `GET /api/bounty/:id` - 赏金详情
- `POST /api/bounty` - 创建赏金
- `PUT /api/bounty/:id` - 更新赏金
- `POST /api/bounty/:id/submit` - 提交解决方案
- `POST /api/bounty/:id/bid` - 竞标

## 验收标准

- [ ] 列表页筛选和搜索正常
- [ ] 详情页完整展示
- [ ] 创建流程完整
- [ ] 提交功能正常
- [ ] Dashboard 正确显示

## 预计工时

Medium (4-6 小时)
