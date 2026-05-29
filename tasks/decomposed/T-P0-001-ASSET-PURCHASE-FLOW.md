# T-P0-001: 资产购买流程 (Asset Purchase Flow)

**状态**: 待分派
**优先级**: CRITICAL (P0)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现完整的资产购买流程，包括购物车、结算、交易确认和购买历史。

## 详细需求

### 1. 购物车组件 (CartDrawer)
- 位置: `frontend/src/components/CartDrawer.tsx`
- 功能:
  - 添加/移除资产
  - 更新数量
  - 显示总价
  - 积分余额验证
  - 结算按钮

### 2. 结算页面 (Checkout)
- 位置: `frontend/src/app/checkout/page.tsx`
- 功能:
  - 显示购买清单
  - 积分余额验证
  - 确认购买按钮
  - 交易结果反馈
  - 积分扣减 API 调用

### 3. 购买历史 (Purchase History)
- 位置: `frontend/src/app/dashboard/purchases/page.tsx`
- 功能:
  - 购买记录列表
  - 交易详情查看
  - 下载/查看已购资产

## 依赖 API

### 后端 API
- `POST /api/assets/purchase` - 购买资产
- `GET /api/assets/:id` - 获取资产详情
- `GET /api/credits/balance` - 获取积分余额
- `POST /api/credits/deduct` - 扣减积分
- `GET /api/transactions` - 获取交易记录

## 验收标准

- [ ] 购物车添加/移除资产功能正常
- [ ] 积分余额不足时正确提示
- [ ] 购买后积分正确扣减
- [ ] 购买历史正确显示
- [ ] 响应式设计，移动端可用

## 技术要求

- 使用 Zustand 管理购物车状态
- 使用 React Query 管理 API 数据
- 遵循项目现有组件风格
- 单元测试覆盖率 >80%

## 预计工时

Medium (4-6 小时)
