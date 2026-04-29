# 子任务: 创建 Gene 表

## 任务 ID
`subtask-extract-gene-table`

## 优先级
`P1`

## 状态
`pending`

## 依赖
- `/workspace/my-evo/tasks/subtask-extract-bundle-table.md` (建议先执行)

## 输入
- `/workspace/my-evo/prisma/schema.prisma`
- `/workspace/my-evo/tasks/DATABASE-GAP-ANALYSIS.md` (第2.3节 Gene 表建议)

## 执行步骤

### 1. 添加 Gene 模型

在 `prisma/schema.prisma` 文件中添加 Gene 模型：

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

### 2. 更新 EvolutionEvent 模型

确保 Gene 关联正确：

```prisma
// 在 EvolutionEvent 中添加 gene_id 字段
model EvolutionEvent {
  // ... 现有字段
  gene_id String?  // 添加此字段
  
  gene Gene? @relation(fields: [gene_id], references: [gene_id])  // 添加此关系
}
```

### 3. 运行 Prisma Migration

```bash
cd /workspace/my-evo
npx prisma migrate dev --name add_gene_table
```

## 输出
- 更新 `/workspace/my-evo/prisma/schema.prisma`
- 生成 migration 文件
- 确认 Gene 表创建成功

## 验收标准
- [ ] Gene 模型存在且字段完整
- [ ] GeneExecution 模型存在
- [ ] EvolutionEvent 包含 gene_id
- [ ] 索引正确创建
- [ ] Migration 成功执行
