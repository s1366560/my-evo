# 子任务: 创建 Bundle 表

## 任务 ID
`subtask-extract-bundle-table`

## 优先级
`P0`

## 状态
`pending`

## 依赖
- `/workspace/my-evo/tasks/DATABASE-GAP-ANALYSIS.md`

## 输入
- `/workspace/my-evo/prisma/schema.prisma`
- `/workspace/my-evo/tasks/DATABASE-GAP-ANALYSIS.md` (第2.2节 Bundle 表建议)

## 执行步骤

### 1. 添加 Bundle 模型

在 `prisma/schema.prisma` 文件中添加 Bundle 模型：

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
  genes           Gene[]
  
  // Capsule 关联
  capsule_id      String?
  capsule         Capsule? @relation(fields: [capsule_id], references: [id])
  
  // EvolutionEvent 关联
  evolution_events EvolutionEvent[]
  
  // 元数据
  author_id       String
  gdi_score       Float    @default(50)
  confidence      Float    @default(1.0)
  carbon_cost    Int      @default(0)
  signals         String[]
  tags            String[]
  
  // Bounty 关联
  bounty_id       String?
  bounty          Bounty?  @relation(fields: [bounty_id], references: [bounty_id])
  
  // 状态
  status          String   @default("draft")
  auto_promoted   Boolean  @default(false)
  promoted_at     DateTime?
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  @@index([author_id])
  @@index([topic])
  @@index([bounty_id])
  @@index([status])
}
```

### 2. 添加 BundleGene 关联表

```prisma
model BundleGene {
  id        String   @id @default(uuid())
  bundle_id String
  gene_id   String
  created_at DateTime @default(now())
  
  bundle Bundle @relation(fields: [bundle_id], references: [bundle_id])
  gene   Gene   @relation(fields: [gene_id], references: [gene_id])
  
  @@unique([bundle_id, gene_id])
  @@index([bundle_id])
  @@index([gene_id])
}
```

### 3. 更新 EvolutionEvent 模型

确保 Bundle 关联正确：

```prisma
// 在 EvolutionEvent 中添加 bundle_id 字段
model EvolutionEvent {
  // ... 现有字段
  bundle_id String?  // 添加此字段
  
  bundle Bundle? @relation(fields: [bundle_id], references: [bundle_id])  // 添加此关系
}
```

### 4. 运行 Prisma Migration

```bash
cd /workspace/my-evo
npx prisma migrate dev --name add_bundle_table
```

## 输出
- 更新 `/workspace/my-evo/prisma/schema.prisma`
- 生成 migration 文件
- 确认 Bundle 表创建成功

## 验收标准
- [ ] Bundle 模型存在且字段完整
- [ ] BundleGene 关联表存在
- [ ] EvolutionEvent 包含 bundle_id
- [ ] 索引正确创建
- [ ] Migration 成功执行
