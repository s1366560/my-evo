# Branch Iteration Plan — 2026-05-20

## 分支信息

| 属性 | 值 |
|------|-----|
| 分支名 | `workspace/node-b056ccaddc5b-fd0a066e-e2e` |
| 基准 | `main` (commit `f74cba2`) |
| 任务 ID | `f2875f38-8f0c-444b-a533-692f71b06fa6` |
| 尝试 ID | `fd0a066e-e2e3-4459-b1f7-72e04c4e1398` |

## 选定的功能点

### Feature 1: Asset Purchase Flow (P0)

**为什么选这个**:
- P0 优先级，是核心交易闭环缺失的关键环节
- 购物车/结账/credit 扣减/交易记录是用户完成购买的核心路径
- Prisma `Transaction` 和 `CreditLog` 模型已存在，实现阻力小
- 前端（购物车页+结账页）和后端（purchase 路由）可完全独立开发

**验收标准**:
- 用户可在购物车中添加资产并完成结账
- Credits 原子化扣减（不出现超扣）
- 交易记录可查询
- 支持退款返还 credits
- E2E 测试覆盖完整购买链路

### Feature 2: Backend Test Coverage — Map & Graph Routes (P1)

**为什么选这个**:
- 调研报告显示 `routes/map.ts`（12 端点）和 `routes/graph.ts`（8 端点）测试覆盖率为 0
- `middleware/auth.ts` JWT 认证中间件也是 0 覆盖
- 纯后端 Jest 测试，无需前端配合，可独立完成
- 为后续功能开发提供稳定的基础

**验收标准**:
- `routes/map.test.ts` 覆盖 12 端点，≥20 个测试用例
- `routes/graph.test.ts` 覆盖 8 端点，≥15 个测试用例
- `middleware/auth.test.ts` 覆盖 JWT 验证逻辑，≥10 个测试用例
- 所有后端测试通过 `cd backend && npm test`

## 依赖分析

| 依赖 | 状态 | 说明 |
|------|------|------|
| Prisma schema | ✅ 已有 | Transaction, CreditLog 模型存在 |
| Backend auth middleware | ✅ 已有 | JWT 认证已实现 |
| Frontend API hooks | ✅ 已有 | useReactQueryHooks 可复用 |
| Next.js routing | ✅ 已有 | App Router 已就绪 |
| Playwright | ✅ 已有 | E2E 框架已配置 |

## 实现顺序建议

1. **Feature 2 先做**（后端测试）：纯后端独立，不涉及前端
2. **Feature 1 后做**（购买流程）：后端 API 先就位，前端再对接

## 交付物

- `backend/src/routes/purchase.ts` + `purchase.test.ts`
- `backend/src/routes/map.test.ts`
- `backend/src/routes/graph.test.ts`
- `backend/src/middleware/auth.test.ts`
- `frontend/src/app/purchase/cart/` + `checkout/` 页面
- `frontend/tests/e2e-purchase.spec.ts`
- 本次 CHANGELOG.md 更新
