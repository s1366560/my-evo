# T-P0-003: Checkout/支付后端 (Checkout Backend)

**状态**: 待分派
**优先级**: CRITICAL (P0)
**Worker 类型**: backend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现资产购买的原子性交易处理，确保积分扣减和资产所有权转移的原子性。

## 详细需求

### 1. 结账服务 (Checkout Service)
- 位置: `src/billing/checkout.ts` (新建)
- 功能:
  - 原子性积分扣减
  - 资产所有权转移
  - 交易记录创建
  - 幂等性处理

### 2. 积分事务 (Credit Transaction)
- 位置: `src/credits/transaction.ts` (扩展)
- 功能:
  - 原子性扣减
  - 余额验证
  - 交易历史记录
  - 并发控制

### 3. 收据生成 (Receipt Generation)
- 位置: `src/billing/receipt.ts` (新建)
- 功能:
  - 收据内容生成
  - PDF 可导出
  - 邮件发送

### 4. 退款处理 (Refund Handling)
- 位置: `src/billing/refund.ts` (新建)
- 功能:
  - 退款申请
  - 积分返还
  - 退款审核

## API 端点

### 结账
```
POST /api/billing/checkout
Request: { assetId: string, paymentMethod: 'credits' }
Response: { success: boolean, transactionId: string, receipt: Receipt }
```

### 退款
```
POST /api/billing/refund
Request: { transactionId: string, reason: string }
Response: { success: boolean, refundId: string }
```

### 交易记录
```
GET /api/billing/transactions
GET /api/billing/transactions/:id
```

## 验收标准

- [ ] 积分扣减原子性
- [ ] 并发购买正确处理
- [ ] 交易记录完整
- [ ] 退款流程可用
- [ ] 幂等性验证通过

## 技术要求

- 使用 Prisma Transaction
- 乐观锁控制并发
- 幂等性 key 支持

## 预计工时

Medium (4-6 小时)
