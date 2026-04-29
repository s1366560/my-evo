# My-Evo 数据库 Gap 分析报告

**分析时间**: 2026-01-27  
**项目路径**: `/workspace/my-evo`  
**分析文件**: `prisma/schema.prisma`

---

## 📊 执行摘要

| 维度 | 状态 | 详情 |
|------|------|------|
| 现有数据模型 | ✅ 完整 | 35+ 个表，覆盖核心业务 |
| 缺失 Subscription 表 | 🔴 缺失 | 无订阅计划表，影响计费系统 |
| Bundle 表缺失 | 🔴 缺失 | 无独立 Bundle 表，Asset 混用 |
| Gene 表缺失 | 🔴 缺失 | 无独立 Gene 表 |
| Capsule 表缺失 | 🔴 缺失 | 无独立 Capsule 表 |
| 索引覆盖 | ⚠️ 部分 | RLS 策略缺失，多租户场景存风险 |

---

## 1. 现有数据模型概览

### 1.1 已实现的表

```
✅ Node                    # Agent/节点管理
✅ Asset                   # 资产（gene/capsule/bundle 混用）
✅ KnowledgeGraphRelationship  # 知识图谱关系
✅ EvolutionEvent          # 进化事件
✅ GDIScoreRecord          # GDI 评分记录
✅ AssetDownload           # 下载记录
✅ AssetVote               # 投票
✅ SimilarityRecord        # 相似度记录
✅ CreditTransaction       # 积分交易
✅ ReputationEvent         # 信誉事件
✅ QuarantineRecord        # 隔离记录
✅ QuarantineAppeal        # 隔离申诉
✅ SwarmTask               # 群体任务
✅ SwarmSubtask            # 子任务
✅ Worker                  # Worker 管理
✅ Proposal                # 提案
✅ ProposalVote            # 提案投票
✅ Bounty                  # 赏金任务
✅ BountyBid               # 赏金投标
✅ BountyMilestone         # 里程碑
✅ Dispute                 # 争议
✅ Appeal                  # 上诉
✅ ValidatorStake          # 验证者质押
✅ TrustAttestation        # 信任证明
✅ ApiKey                  # API 密钥
✅ UserSession             # 用户会话
✅ User                    # 用户
✅ OnboardingState         # 引导状态
✅ CollaborationSession    # 协作会话
✅ Guild                   # 公会
✅ Circle                  # 圈子
✅ ArenaSeason             # 竞技赛季
✅ ArenaMatch              # 竞技比赛
✅ DriftBottle             # 漂流瓶
✅ MarketplaceListing      # 市场列表
✅ MarketplaceTransaction  # 市场交易
✅ Question                # 问答问题
✅ QuestionAnswer          # 问答答案
✅ Project                 # 项目
✅ ReadingSession          # 阅读会话
✅ MemoryNode              # 记忆节点
✅ Skill                   # 技能
✅ SkillRating             # 技能评分
✅ EvolutionSandbox        # 进化沙盒
✅ SandboxMember           # 沙盒成员
✅ SandboxAsset            # 沙盒资产
✅ PromotionRequest        # 推广请求
✅ SandboxInvite            # 沙盒邀请
```

---

## 2. 🔴 缺失的数据模型

### 2.1 Subscription 表（优先级：P0）

**问题**: 无订阅计划表，无法支持 Free/Premium/Ultra 订阅层级。

**当前状态**: 
- 后端已有 `src/subscription/routes.ts` 服务
- 前端缺少订阅管理 UI
- 数据库层面无订阅计划表

**建议 Schema**:

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

---

### 2.2 Bundle 表（优先级：P0）

**问题**: Bundle 数据混用 Asset 表，无法区分 Bundle 特定字段。

**当前状态**:
- Asset 表通过 `asset_type = 'bundle'` 标记 Bundle
- 缺失 Bundle 独有的字段：bounty_id, decision, intent, code_snippet, diff 等

**建议 Schema**:

```prisma
model Bundle {
  id              String   @id @default(uuid())
  bundle_id       String   @unique
  name            String
  description     String
  content         String?  // 最低 50 字符
  topic           String
  intent          String?
  decision        String?
  code_snippet    String?
  diff            String?
  strategy        String[]
  schema_version  String   @default("1.5.0")
  
  // Gene 关联
  genes_used     Gene[]
  
  // Capsule 关联
  capsule_id     String?
  capsule        Capsule? @relation(fields: [capsule_id], references: [id])
  
  // EvolutionEvent 关联
  evolution_events EvolutionEvent[]
  
  // 元数据
  author_id      String
  gdi_score      Float    @default(50)
  confidence     Float    @default(1.0)
  carbon_cost   Int      @default(0)
  signals        String[]
  tags           String[]
  
  // Bounty 关联
  bounty_id      String?
  bounty         Bounty?  @relation(fields: [bounty_id], references: [bounty_id])
  
  // 状态
  status         String   @default("draft")
  auto_promoted  Boolean  @default(false)
  promoted_at    DateTime?
  
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  
  @@index([author_id])
  @@index([topic])
  @@index([bounty_id])
  @@index([status])
}
```

---

### 2.3 Gene 表（优先级：P1）

**问题**: Gene 数据混用 Asset 表，无法区分 Gene 特定字段。

**当前状态**:
- Asset 表通过 `asset_type = 'gene'` 标记 Gene
- 缺失 Gene 独有的字段：validation, node/npm/npx 字段等

**建议 Schema**:

```prisma
model Gene {
  id              String    @id @default(uuid())
  gene_id         String    @unique
  name            String
  description     String
  content         String?
  
  // Gene 特有字段
  validation      Json      // 验证数组 >=1 项
  // validation 格式: [{ type: "node" | "npm" | "npx", command: string }]
  
  author_id       String
  gdi_score       Float     @default(50)
  gdi_mean        Float?
  gdi_lower       Float?
  confidence      Float     @default(1.0)
  execution_count Int       @default(0)
  carbon_cost     Int       @default(0)
  signals         String[]
  tags            String[]
  
  status          String    @default("draft")
  
  // Bundle 关联
  bundles         Bundle[]  @relation("BundleGenes")
  
  // Capsule 关联
  capsules        Capsule[] @relation("CapsuleGenes")
  
  // Evolution
  evolution_events EvolutionEvent[]
  
  // 版本控制
  version         Int       @default(1)
  parent_id       String?
  generation      Int       @default(0)
  ancestors       String[]
  fork_count      Int       @default(0)
  
  last_verified_at DateTime?
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  
  @@index([author_id])
  @@index([status])
  @@index([gdi_score])
}

model GeneExecution {
  id              String   @id @default(uuid())
  gene_id         String
  node_id         String
  status          String   @default("started")
  exit_code       Int?
  output          String?
  error           String?
  duration_ms     Int?
  carbon_cost     Int      @default(0)
  executed_at     DateTime @default(now())
  
  gene Gene @relation(fields: [gene_id], references: [gene_id])
  
  @@index([gene_id])
  @@index([node_id])
  @@index([executed_at])
}
```

---

### 2.4 Capsule 表（优先级：P1）

**问题**: Capsule 数据混用 Asset 表，无法区分 Capsule 特定字段。

**当前状态**:
- Asset 表通过 `asset_type = 'capsule'` 标记 Capsule
- 缺失 Capsule 独有的字段：strategy, code_snippet, diff 等

**建议 Schema**:

```prisma
model Capsule {
  id              String   @id @default(uuid())
  capsule_id      String   @unique
  name            String
  description     String
  content         String?  // 最低 50 字符
  strategy        String[]
  code_snippet    String?
  diff            String?
  
  // Gene 关联
  genes           Gene[]   @relation("CapsuleGenes")
  gene_ids        String[]
  
  author_id       String
  gdi_score       Float    @default(50)
  gdi_mean        Float?
  gdi_lower       Float?
  confidence      Float    @default(1.0)
  execution_count Int      @default(0)
  carbon_cost     Int      @default(0)
  signals         String[]
  tags            String[]
  
  // 版本控制
  version         Int      @default(1)
  parent_id       String?
  generation      Int      @default(0)
  ancestors       String[]
  fork_count      Int      @default(0)
  
  // Bundle 关联
  bundles         Bundle[]
  
  status          String   @default("draft")
  
  last_verified_at DateTime?
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  @@index([author_id])
  @@index([status])
  @@index([gdi_score])
}
```

---

## 3. ⚠️ 改进建议

### 3.1 Row Level Security (RLS)

当前 Schema 缺失 RLS 策略，多租户场景存在数据泄露风险。

**建议添加**:

```prisma
// 在 Node 表上添加 RLS
ALTER TABLE "Node" ENABLE ROW LEVEL SECURITY;

// 策略示例：用户只能访问自己的节点
CREATE POLICY node_user_policy ON "Node"
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::text);
```

### 3.2 索引优化

部分高频查询字段缺失索引：

| 表 | 字段 | 建议索引类型 |
|----|------|-------------|
| Node | last_seen | BRIN (时间序列) |
| Asset | created_at | BRIN (时间序列) |
| CreditTransaction | balance_after | B-tree |
| Bounty | status, deadline | B-tree (复合) |
| Bundle | author_id, status | B-tree (复合) |
| Gene | author_id, status | B-tree (复合) |
| Capsule | author_id, status | B-tree (复合) |

### 3.3 复合索引建议

```prisma
// Bounty 复合索引
@@index([status, deadline])

// Bundle 复合索引
@@index([author_id, status])

// Gene 复合索引
@@index([author_id, status, gdi_score])
```

---

## 4. 📋 迁移优先级

| 优先级 | 任务 | 描述 | 工作量 |
|--------|------|------|--------|
| P0 | Subscription 表 | 订阅系统核心表 | 中 |
| P0 | Bundle 表 | Bundle 独立存储 | 高 |
| P1 | Gene 表 | Gene 独立存储 | 高 |
| P1 | Capsule 表 | Capsule 独立存储 | 高 |
| P2 | GeneExecution 表 | Gene 执行记录 | 中 |
| P2 | RLS 策略 | 多租户安全 | 中 |
| P3 | 索引优化 | 性能优化 | 低 |

---

## 5. 架构建议

### 5.1 Asset 表泛化问题

当前 `Asset` 表被用于存储 gene/capsule/bundle 三种资产类型，导致：
- 字段膨胀（很多字段只对特定类型有用）
- 业务逻辑耦合
- 扩展性受限

**建议**: 考虑分离为独立表，或使用继承模式。

### 5.2 时间序列优化

对于 `last_seen`, `created_at` 等时间字段，建议使用 BRIN 索引：

```prisma
@@index([last_seen]) // USING BRIN
```

---

## 6. 总结

### 6.1 核心缺失

1. **Subscription 表** - 影响订阅计费系统
2. **Bundle 表** - 混用 Asset，丢失 Bundle 特定字段
3. **Gene 表** - 混用 Asset，丢失 Gene 特定字段
4. **Capsule 表** - 混用 Asset，丢失 Capsule 特定字段

### 6.2 行动项

1. 创建 Subscription 相关表
2. 拆分 Asset 表为 Gene/Capsule/Bundle 独立表
3. 添加 RLS 策略
4. 优化索引配置

---

*报告生成工具: Sisyphus Leader Agent*
*基于 Prisma Schema v2026-01-27 版本分析*
