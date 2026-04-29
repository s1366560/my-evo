# 子任务: 添加 Row Level Security (RLS) 策略

## 任务 ID
`subtask-add-rls-policies`

## 优先级
`P2`

## 状态
`pending`

## 依赖
- 数据库连接配置完成

## 输入
- `/workspace/my-evo/prisma/schema.prisma`
- `/workspace/my-evo/.env` (数据库连接配置)

## 执行步骤

### 1. 启用 RLS

对多租户相关表启用 RLS：

```sql
-- Node 表 (user_id 关联)
ALTER TABLE "Node" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Node" FORCE ROW LEVEL SECURITY;

-- CreditTransaction 表
ALTER TABLE "CreditTransaction" ENABLE ROW LEVEL SECURITY;

-- ReputationEvent 表
ALTER TABLE "ReputationEvent" ENABLE ROW LEVEL SECURITY;

-- ApiKey 表
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;

-- UserSession 表
ALTER TABLE "UserSession" ENABLE ROW LEVEL SECURITY;

-- Bounty 表 (creator_id)
ALTER TABLE "Bounty" ENABLE ROW LEVEL SECURITY;

-- BountyBid 表
ALTER TABLE "BountyBid" ENABLE ROW LEVEL SECURITY;

-- MarketplaceListing 表
ALTER TABLE "MarketplaceListing" ENABLE ROW LEVEL SECURITY;

-- MarketplaceTransaction 表
ALTER TABLE "MarketplaceTransaction" ENABLE ROW LEVEL SECURITY;
```

### 2. 创建 RLS 策略

```sql
-- Node 表策略: 用户只能访问自己的节点
CREATE POLICY node_user_policy ON "Node"
  FOR ALL
  TO PUBLIC
  USING (
    user_id = current_setting('app.current_user_id', true)::text
    OR user_id IS NULL
  );

-- CreditTransaction 策略
CREATE POLICY credit_transaction_user_policy ON "CreditTransaction"
  FOR ALL
  TO PUBLIC
  USING (
    node_id IN (
      SELECT node_id FROM "Node" 
      WHERE user_id = current_setting('app.current_user_id', true)::text
    )
  );

-- ApiKey 策略: 用户只能访问自己的 API Key
CREATE POLICY api_key_user_policy ON "ApiKey"
  FOR ALL
  TO PUBLIC
  USING (user_id = current_setting('app.current_user_id', true)::text);

-- UserSession 策略
CREATE POLICY user_session_user_policy ON "UserSession"
  FOR ALL
  TO PUBLIC
  USING (user_id = current_setting('app.current_user_id', true)::text);

-- Bounty 策略: 用户只能访问自己创建的赏金
CREATE POLICY bounty_user_policy ON "Bounty"
  FOR ALL
  TO PUBLIC
  USING (creator_id = current_setting('app.current_user_id', true)::text);

-- BountyBid 策略
CREATE POLICY bounty_bid_user_policy ON "BountyBid"
  FOR ALL
  TO PUBLIC
  USING (bidder_id = current_setting('app.current_user_id', true)::text);

-- MarketplaceListing 策略
CREATE POLICY marketplace_listing_user_policy ON "MarketplaceListing"
  FOR ALL
  TO PUBLIC
  USING (
    seller_id = current_setting('app.current_user_id', true)::text
    OR buyer_id = current_setting('app.current_user_id', true)::text
  );

-- MarketplaceTransaction 策略
CREATE POLICY marketplace_transaction_user_policy ON "MarketplaceTransaction"
  FOR ALL
  TO PUBLIC
  USING (
    seller_id = current_setting('app.current_user_id', true)::text
    OR buyer_id = current_setting('app.current_user_id', true)::text
  );
```

### 3. 应用设置函数

```sql
-- 创建设置当前用户的函数
CREATE OR REPLACE FUNCTION set_app_current_user(user_id text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;

-- 创建获取当前用户的函数
CREATE OR REPLACE FUNCTION get_app_current_user()
RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql;
```

## 输出
- RLS 策略应用到数据库
- 测试验证策略有效性

## 验收标准
- [ ] RLS 启用成功
- [ ] 策略创建成功
- [ ] 用户隔离测试通过
- [ ] 无性能明显下降
