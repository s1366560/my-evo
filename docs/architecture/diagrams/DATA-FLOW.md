# My Evo 数据流草图

**版本**: 1.0 | **日期**: 2026-04-29 | **类型**: 数据流文档

---

## 1. 系统数据流总览

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户层 (Browser/Client)                     │
│   Dashboard │ Market │ Bounty │ Swarm │ Evolver Node           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API 网关层 (Next.js API Routes)               │
│   /api/assets/* │ /api/bounty/* │ /api/user/* │ /api/kg/*      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │  PostgreSQL      │      │  Redis Cache    │
    │  - users         │      │  - sessions     │
    │  - assets        │      │  - tokens       │
    │  - bounties      │      │  - rate limit   │
    │  - transactions  │      └──────────────────┘
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  Neo4j KG        │
    │  - entities      │
    │  - relations     │
    │  - embeddings    │
    └──────────────────┘
```

---

## 2. 核心数据流

### 2.1 用户认证流程

```
前端 → POST /api/auth/login → 后端验证 → 查询用户表 → 验证密码
       → 生成JWT → 写入Redis → 返回token → 前端存储
```

### 2.2 资产发布流程

```
前端 → 填写资产信息 → 计算GDI评分 → 提交发布
       → 写入assets表 → 生成Gene/Capsule → 同步Hub → 返回成功
```

### 2.3 资产搜索流程

```
输入关键词 → 分词+向量化 → Neo4j语义搜索 + PostgreSQL关键词匹配
       → GDI排序 → 返回结果列表
```

### 2.4 赏金任务流程

```
发布者: 创建赏金 → 写入bounties表 → 通知用户
解决者: 认领赏金 → 更新状态 → 提交方案 → 发布者验收 → 积分转账
```

### 2.5 Evolver 节点流程

```
启动 → 注册节点 → 获取任务 → 本地执行 → 检测错误 → 触发进化
     → 沙箱测试 → 上报新Gene → 获得积分奖励
```

### 2.6 Swarm 协作流程

```
创建会话 → 初始化Orchestrator → 任务分发 → Agent执行
       → 结果收集 → 整合输出 → 返回最终结果
```

---

## 3. 数据模型关系

```
User ──< Asset (author_id)          Bounty ──< Solution
  │         │                            │
  │         ├── Gene                     │
  │         ├── Capsule ───< Gene        │
  │         └── Recipe                   │
  │                                    Signal ──< GeneSignal ──> Gene
  │
  └──< Transaction (credits变化)
  
User ──< Bounty (author_id)
```

### 核心表结构

| 表名 | 关键字段 | 说明 |
|------|----------|------|
| users | id, email, credits, reputation | 用户表 |
| assets | id, type, author_id, gdi_score, price | 资产表 |
| genes | id, prompt, signals, success_rate | Gene表 |
| capsules | id, genes[], execution_path | 胶囊表 |
| bounties | id, credits, status, author_id | 赏金表 |
| solutions | id, bounty_id, author_id, content | 解决方案 |
| transactions | id, type, amount, user_id | 积分交易 |
| signals | id, name, type | 信号标签 |
| gene_signals | gene_id, signal_id | Gene-信号关联 |

---

## 4. API 端点数据流

### 4.1 资产 API

```
GET    /api/assets          → 列表查询 → PostgreSQL + Neo4j
GET    /api/assets/:id     → 详情查询 → PostgreSQL
POST   /api/assets         → 创建资产 → 验证 → 写入 → 同步Hub
POST   /api/assets/:id/purchase → 余额检查 → 积分扣除 → 下载
```

### 4.2 赏金 API

```
GET    /api/bounties        → 列表 + 过滤 → PostgreSQL
POST   /api/bounties        → 创建 → 写入 → 通知
POST   /api/bounties/:id/claim → 状态更新 → 锁定期
POST   /api/bounties/:id/solution → 提交 → 审核通知
POST   /api/bounties/:id/accept → 积分转账 → 关闭赏金
```

### 4.3 知识图谱 API

```
POST   /api/kg/query        → 向量化 → Neo4j语义搜索 → 返回实体
POST   /api/kg/search       → 混合搜索 → 排序 → 返回结果
GET    /api/kg/entities/:id → 实体详情 → 关系查询
```

---

## 5. 实时数据流 (WebSocket/SSE)

```
客户端 ←→ Redis Pub/Sub ←→ 服务器
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   赏金通知   Swarm进度    资产更新
```

### 事件类型

| 事件 | 方向 | 说明 |
|------|------|------|
| bounty:new | Server→Client | 新赏金发布 |
| bounty:claimed | Server→Client | 赏金被认领 |
| solution:submitted | Server→Client | 方案提交 |
| swarm:update | Server→Client | Swarm进度 |
| asset:updated | Server→Client | 资产更新 |

---

## 6. 外部集成数据流

### 6.1 EvoMap Hub 同步

```
本地Gene/Capsule → 计算SHA256哈希 → POST /api/hub/asset/submit
                → 获取Asset ID → 本地存储映射

搜索资产 → GET /api/hub/asset/search → 缓存本地 → 显示
```

### 6.2 Evolver 节点通信

```
本地Proxy(:19820) → Hub API → 任务获取/结果上报
                  ← 新任务推送 ←
```

---

## 7. 安全数据流

```
请求 → JWT验证 → Rate Limit检查 → 权限验证 → 业务逻辑 → 日志记录 → 响应

积分操作: 双重写入(乐观锁) → 事务日志 → 补偿机制
```

---

*文档版本: 1.0 | 更新: 2026-04-29*
