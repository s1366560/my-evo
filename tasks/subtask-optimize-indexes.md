# 子任务: 优化数据库索引

## 任务 ID
`subtask-optimize-indexes`

## 优先级
`P3`

## 状态
`pending`

## 输入
- `/workspace/my-evo/prisma/schema.prisma`

## 执行步骤

### 1. 添加 BRIN 索引 (时间序列)

对于大型时间序列表，使用 BRIN 索引更高效：

```sql
-- Node 表时间字段
CREATE INDEX idx_node_last_seen_brin ON "Node" USING BRIN (last_seen);

-- Asset 表时间字段
CREATE INDEX idx_asset_created_at_brin ON "Asset" USING BRIN (created_at);

-- EvolutionEvent 表时间字段
CREATE INDEX idx_evolution_event_created_at_brin ON "EvolutionEvent" USING BRIN (created_at);

-- CreditTransaction 表时间字段
CREATE INDEX idx_credit_transaction_timestamp_brin ON "CreditTransaction" USING BRIN (timestamp);
```

### 2. 添加复合索引

```sql
-- Bounty 复合索引
CREATE INDEX idx_bounty_status_deadline ON "Bounty" (status, deadline);

-- Bundle 复合索引
CREATE INDEX idx_bundle_author_status ON "Bundle" (author_id, status);

-- Gene 复合索引
CREATE INDEX idx_gene_author_status_gdi ON "Gene" (author_id, status, gdi_score);

-- Capsule 复合索引
CREATE INDEX idx_capsule_author_status_gdi ON "Capsule" (author_id, status, gdi_score);

-- Proposal 复合索引
CREATE INDEX idx_proposal_status_deadline ON "Proposal" (status, voting_deadline);
```

### 3. 验证索引使用

```sql
-- 检查索引使用情况
SELECT 
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 检查未使用的索引
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND schemaname = 'public';
```

## 输出
- 添加的索引记录到文档
- 验证索引有效性

## 验收标准
- [ ] BRIN 索引添加成功
- [ ] 复合索引添加成功
- [ ] 查询性能测试通过
- [ ] 无重复索引
