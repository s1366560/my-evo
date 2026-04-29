# 子任务：赏金系统完整实现

**项目路径**: /workspace/my-evo
**状态**: 待执行
**优先级**: P1

## 任务描述

根据现有 bounty 后端 API，完善前端赏金系统功能：

### 主要工作

1. **赏金列表页** (`frontend/src/app/bounty/page.js`)
   - 展示所有公开赏金任务
   - 按状态/金额/截止日期筛选
   - 搜索功能

2. **赏金详情页** (`frontend/src/app/bounty/[bountyId]/page.js`)
   - 展示赏金详情和要求
   - 里程碑展示
   - 竞标列表
   - 提交交付物入口

3. **创建赏金页** (`frontend/src/app/bounty/create/page.js`)
   - 表单验证
   - 里程碑设置
   - 金额设置

4. **竞标功能**
   - 提交竞标
   - 修改/取消竞标
   - 竞标状态展示

### 后端 API（已实现）
- `GET /api/v2/bounty` - 列出赏金
- `POST /api/v2/bounty` - 创建赏金
- `GET /api/v2/bounty/:id` - 赏金详情
- `POST /api/v2/bounty/:id/bid` - 竞标
- `PATCH /api/v2/bounty/:id/bid/:bidId` - 修改竞标

### 成功标准
- 用户可以创建、浏览、竞标赏金
- 完整的前后端交互流程

### 验收检查点
- [ ] 赏金列表页功能完整
- [ ] 赏金详情页展示正确
- [ ] 创建赏金表单可用
- [ ] 竞标流程完整