# 子任务: 创建 Subscription 订阅表

## 任务 ID
`subtask-create-subscription-table`

## 优先级
`P0`

## 状态
`pending`

## 依赖
- `/workspace/my-evo/tasks/DATABASE-GAP-ANALYSIS.md`

## 输入
- `/workspace/my-evo/prisma/schema.prisma`
- `/workspace/my-evo/tasks/DATABASE-GAP-ANALYSIS.md` (第2.1节 Subscription 表建议)

## 执行步骤

### 1. 添加 Subscription 模型

在 `prisma/schema.prisma` 文件末尾添加以下模型：

```prisma
model Subscription {
  id                  String    @id @default(uuid())
  subscription_id     String    @unique
  user_id             String
  plan                String    @default("free")  // 'free' | 'premium' | 'ultra'
  status              String    @default("active")
  billing_cycle       String    @default("monthly")  // 'monthly' | 'annual'
  price_cents         Int       @default(0)
  currency            String    @default("USD")
  started_at          DateTime  @default(now())
  current_period_start DateTime
  current_period_end   DateTime
  cancelled_at        DateTime?
  cancel_at_period_end Boolean  @default(false)
  stripe_subscription_id String? @unique
  stripe_customer_id    String?
  paypal_subscription_id String?
  
  invoices SubscriptionInvoice[]
  usage_quota SubscriptionUsage[]
  
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt
  
  @@index([user_id])
  @@index([status])
}

model SubscriptionInvoice {
  id                 String    @id @default(uuid())
  invoice_id         String    @unique
  subscription_id   String
  amount_cents      Int
  currency          String
  status            String    @default("pending")
  paid_at           DateTime?
  due_date          DateTime
  stripe_invoice_id String?
  description       String?
  
  subscription Subscription @relation(fields: [subscription_id], references: [subscription_id])
  
  @@index([subscription_id])
  @@index([status])
}

model SubscriptionUsage {
  id              String   @id @default(uuid())
  subscription_id String
  metric          String  // 'api_calls' | 'storage_gb' | 'genes' | 'capsules'
  used            Int     @default(0)
  quota           Int
  period_start    DateTime
  period_end      DateTime
  reset_at        DateTime?
  
  subscription Subscription @relation(fields: [subscription_id], references: [subscription_id])
  
  @@unique([subscription_id, metric, period_start])
  @@index([subscription_id])
}
```

### 2. 运行 Prisma Migration

```bash
cd /workspace/my-evo
npx prisma migrate dev --name add_subscription_tables
```

### 3. 验证 Schema

```bash
npx prisma validate
```

## 输出
- 更新 `/workspace/my-evo/prisma/schema.prisma`
- 生成 migration 文件
- 确认表创建成功

## 验收标准
- [ ] Subscription 模型存在且字段完整
- [ ] SubscriptionInvoice 模型存在
- [ ] SubscriptionUsage 模型存在
- [ ] 索引正确创建
- [ ] Migration 成功执行
