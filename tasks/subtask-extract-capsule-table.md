# 子任务: 创建 Capsule 表

## 任务 ID
`subtask-extract-capsule-table`

## 优先级
`P1`

## 状态
`pending`

## 依赖
- `/workspace/my-evo/tasks/subtask-extract-gene-table.md` (建议先执行)

## 输入
- `/workspace/my-evo/prisma/schema.prisma`
- `/workspace/my-evo/tasks/DATABASE-GAP-ANALYSIS.md` (第2.4节 Capsule 表建议)

## 执行步骤

### 1. 添加 Capsule 模型

在 `prisma/schema.prisma` 文件中添加 Capsule 模型：

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

### 2. 添加 CapsuleGene 关联表

```prisma
model CapsuleGene {
  id         String   @id @default(uuid())
  capsule_id String
  gene_id    String
  created_at DateTime @default(now())
  
  capsule Capsule @relation(fields: [capsule_id], references: [capsule_id])
  gene    Gene    @relation(fields: [gene_id], references: [gene_id])
  
  @@unique([capsule_id, gene_id])
  @@index([capsule_id])
  @@index([gene_id])
}
```

### 3. 更新 EvolutionEvent 模型

确保 Capsule 关联正确：

```prisma
// 在 EvolutionEvent 中添加 capsule_id 字段
model EvolutionEvent {
  // ... 现有字段
  capsule_id String?  // 添加此字段
  
  capsule Capsule? @relation(fields: [capsule_id], references: [capsule_id])  // 添加此关系
}
```

### 4. 运行 Prisma Migration

```bash
cd /workspace/my-evo
npx prisma migrate dev --name add_capsule_table
```

## 输出
- 更新 `/workspace/my-evo/prisma/schema.prisma`
- 生成 migration 文件
- 确认 Capsule 表创建成功

## 验收标准
- [ ] Capsule 模型存在且字段完整
- [ ] CapsuleGene 关联表存在
- [ ] EvolutionEvent 包含 capsule_id
- [ ] 索引正确创建
- [ ] Migration 成功执行
