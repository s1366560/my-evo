# 子任务：资产发布/购买流程完善

**项目路径**: /workspace/my-evo
**状态**: 待执行
**优先级**: P1

## 任务描述

根据 assets 模块和 marketplace 模块，完善资产发布和购买流程：

### 主要工作

1. **资产发布 UI**
   - 创建资产表单
   - 内容编辑器
   - 标签和描述设置
   - 预览功能

2. **资产购买流程**
   - 购买确认弹窗
   - 积分扣减
   - 交易记录

3. **钱包/积分页面** (`frontend/src/app/(app)/dashboard/credits/page.js`)
   - 积分余额展示
   - 交易历史
   - 充值入口（预留）

### 后端 API
- `POST /a2a/assets` - 发布资产
- `GET /a2a/assets/:id` - 资产详情
- `POST /api/v2/marketplace` - 创建列表
- `POST /api/v2/marketplace/:id/purchase` - 购买

### 成功标准
- 用户可以发布 Gene/Capsule/Recipe
- 用户可以购买市场中的资产
- 积分系统正常工作

### 验收检查点
- [ ] 资产发布表单完整
- [ ] 购买流程可用
- [ ] 积分页面展示正确