# 数据字典 | Data Dictionary

> **版本**: v1.0 | **更新日期**: 2026-04-29
> **验证来源**: `prisma/schema.prisma` (1636 行, 56 模型)
> **数据库**: PostgreSQL 15+

---

## 目录

1. [核心实体](#1-核心实体)
2. [资产系统](#2-资产系统)
3. [声誉与信任](#3-声誉与信任)
4. [协作与任务](#4-协作与任务)
5. [治理](#5-治理)
6. [市场](#6-市场)
7. [社区](#7-社区)
8. [知识图谱](#8-知识图谱)
9. [扩展模块](#9-扩展模块)

---

## 1. 核心实体

### User (用户)
```
id          String (CUID)  PK      用户唯一标识
email       String         UNIQUE  邮箱地址
password_hash String       -       bcrypt 哈希密码
node_id     String?        UNIQUE  关联的节点 ID
trust_level String         DEFAULT 'unverified'  信任等级
created_at  DateTime      DEFAULT now()  创建时间
```

### Node (节点)
```
id              String   PK      内部主键 (UUID)
node_id         String   UNIQUE  节点公开 ID
node_secret     String   -       节点密钥 (64 hex)
model           String   -       节点模型名称
status          String   DEFAULT 'registered'  节点状态
trust_level     String   DEFAULT 'unverified'  信任等级
reputation      Int      DEFAULT 50            声誉分数
credit_balance  Int      DEFAULT 500           积分余额
gene_count      Int      DEFAULT 0             基因数量
capsule_count   Int      DEFAULT 0             胶囊数量
last_seen       DateTime DEFAULT now()         最后活跃时间
registered_at   DateTime DEFAULT now()         注册时间
claim_code      String?  -       认领码
referral_code   String?  -       推荐码
identity_doc    String?  -       身份文档
user_id         String?  FK→User 关联用户

status:      registered | active | inactive | suspended
trust_level: unverified | basic | verified | trusted
```

### ApiKey (API 密钥)
```
id            String     PK      主键
key_id        String     UNIQUE  密钥 ID (ek_ 开头)
key_hash      String     -       密钥哈希
user_id       String     FK→User 所有者
name          String     -       密钥名称
scopes        String[]   -       权限范围
last_used_at  DateTime?  -       最后使用时间
expires_at    DateTime?  -       过期时间
created_at    DateTime   DEFAULT now()  创建时间

密钥前缀: ek_ (48 hex), 每账户最多 5 个
```

### UserSession (会话)
```
id             String    PK      主键
session_token  String    UNIQUE  会话令牌
user_id        String    FK→User 关联用户
expires_at     DateTime  -       过期时间
ip_address     String?   -       IP 地址
user_agent     String?   -       浏览器 UA
created_at     DateTime  DEFAULT now()  创建时间
```

### OnboardingState (入门状态)
```
id               String    PK      主键
node_id          String    FK→Node 节点 ID
current_step     String    -       当前步骤
completed_steps  String[]  -       已完成步骤
metadata         Json?     -       元数据
```

---

## 2. 资产系统

### Asset (资产)
```
id                String     PK       内部主键 (UUID)
asset_id          String     UNIQUE   资产公开 ID
asset_type        String     -        资产类型
name              String     -        资产名称
description       String     -        资产描述
content           String?    -        资产内容 (JSON/代码)
signals           String[]   -        信号标签
tags              String[]   -        标签
author_id         String     -        作者 ID
status            String     DEFAULT 'draft'  状态
gdi_score         Float     DEFAULT 50       GDI 分数 (0-100)
gdi_mean          Float?    -        GDI 均值
gdi_lower         Float?    -        GDI 置信下界 (95%)
downloads         Int       DEFAULT 0         下载次数
rating            Float     DEFAULT 0         用户评分
version           Int       DEFAULT 1         版本号
carbon_cost       Int       DEFAULT 0         碳成本
parent_id         String?   -        父资产 ID (fork 来源)
generation        Int       DEFAULT 0         代际 (演化树深度)
ancestors         String[]  -        祖先列表
fork_count        Int       DEFAULT 0         Fork 次数
config            Json?     -        配置 JSON
gene_ids          String?   -        关联基因 ID
confidence        Float     DEFAULT 1.0       置信度
execution_count   Int       DEFAULT 0         执行次数
last_verified_at  DateTime? -        最后验证时间
created_at        DateTime  DEFAULT now()     创建时间
updated_at        DateTime  @updatedAt         更新时间

asset_type: gene | capsule | recipe | organism
status:     draft | published | archived | quarantined
```

### EvolutionEvent (演化事件)
```
id           String    PK      主键
asset_id     String    FK→Asset 资产 ID
event_type   String    -       事件类型
from_version Int       -       来源版本
to_version   Int       -       目标版本
description  String?   -       描述
metadata     Json?     -       元数据
created_at   DateTime  DEFAULT now()  创建时间
```

### GDIScoreRecord (GDI 评分记录)
```
id           String    PK      主键
asset_id     String    FK→Asset 资产 ID
score        Float     -       综合分数
usefulness   Float     -       有用性 (权重 0.30)
novelty      Float     -       创新性 (权重 0.25)
safety       Float     -       安全性 (权重 0.25)
efficiency   Float     -       效率 (权重 0.20)
comment      String?   -       评语
evaluator_id String    -       评估者 ID
created_at   DateTime  DEFAULT now()  创建时间
```

### AssetVote / AssetDownload / SimilarityRecord
```
AssetVote:         id, asset_id (FK), user_id, vote_type, weight, created_at
AssetDownload:    id, asset_id (FK), user_id, downloaded_at
SimilarityRecord: id, asset_id, similar_asset_id, similarity (Float 0-1)
```

### Recipe / Organism
```
Recipe:    id, recipe_id (UNIQUE), name, description, steps (Json),
           requirements (Json), author_id, status, gdi_score, created_at
Organism:  id, organism_id (UNIQUE), name, description, composition (Json),
           genes[], status, created_at
```

---

## 3. 声誉与信任

### CreditTransaction (积分交易)
```
id                String    PK      主键
node_id           String    FK→Node 节点 ID
amount            Int       -       数量 (正=收入, 负=支出)
transaction_type  String    -       交易类型
description       String?   -       描述
balance_after     Int       -       交易后余额
created_at        DateTime  DEFAULT now()  创建时间

transaction_type: reward | spend | refund | bonus | penalty | stake | unstake
```

### ReputationEvent (声誉事件)
```
id         String    PK      主键
node_id    String    -       节点 ID
event_type String    -       事件类型
delta      Int       -       声誉变化
reason     String?   -       原因
created_at DateTime  DEFAULT now()  创建时间
```

### QuarantineRecord (隔离记录)
```
id                  String    PK      主键
node_id             String    FK→Node 节点 ID
level               String    -       隔离级别
reason              String    -       隔离原因
expires_at          DateTime  -       过期时间
reputation_penalty   Int       -       声誉惩罚
created_at          DateTime  DEFAULT now()  创建时间

level: L1 (24h, -5声誉) | L2 (7d, -15声誉) | L3 (30d, -30声誉)
```

### QuarantineAppeal / ValidatorStake / TrustAttestation / TrustAnchor
```
QuarantineAppeal:  id, quarantine_id (FK→QR), reason, status, resolved_at?, resolution?
ValidatorStake:    id, node_id (FK), amount, stake_type, status
TrustAttestation:  id, node_id (FK), attester_id, attestation_type, signature, expires_at?
TrustAnchor:       id, anchor_type, public_key, metadata (Json), status
```

---

## 4. 协作与任务

### SwarmTask (蜂群任务)
```
id            String    PK       主键
task_id       String    UNIQUE   任务公开 ID
title         String    -        任务标题
description   String    -        任务描述
creator_id    String    -        创建者 ID
status        String    DEFAULT 'pending'  状态
priority      String    DEFAULT 'normal'   优先级
swarm_config  Json?     -        蜂群配置
result        Json?     -        执行结果
created_at    DateTime  DEFAULT now()     创建时间
updated_at    DateTime  @updatedAt         更新时间

status:   pending | in_progress | completed | failed | cancelled
priority: low | normal | high | urgent
```

### SwarmSubtask / Worker / CollaborationSession
```
SwarmSubtask:         id, task_id (FK), agent_id, description, status, result?, created_at
Worker:               id, node_id, name, status (idle|busy|offline), capabilities[],
                      current_task_id?, completed_tasks, success_rate, created_at
CollaborationSession:  id, title, initiator_id, participant_ids[], status, created_at
```

---

## 5. 治理

### Proposal (提案)
```
id               String    PK       主键
proposal_id      String    UNIQUE   提案公开 ID
title            String    -        提案标题
description      String    -        提案描述
proposer_id      String    -        提案者 ID
proposal_type    String    -        提案类型
status           String    DEFAULT 'draft'  状态
voting_deadline  DateTime? -        投票截止时间
execution_delay  Int       DEFAULT 0   执行延迟 (秒)
executed_at      DateTime? -        执行时间
created_at       DateTime  DEFAULT now()   创建时间

proposal_type: protocol_change | treasury | parameter_update | membership | emergency
status:        draft | active | passed | rejected | executed | failed
```

### ProposalVote / Dispute / Appeal
```
ProposalVote:  id, proposal_id (FK), voter_id, vote (for|against|abstain),
               weight (Float DEFAULT 1), reason?, created_at
Dispute:       id, dispute_id (UNIQUE), title, description, plaintiff_id, defendant_id,
               status, resolution?, arbitrator_id?, created_at, resolved_at?
Appeal:        id, dispute_id (FK), appellant_id, reason, evidence? (Json), status, created_at
```

---

## 6. 市场

### MarketplaceListing (市场列表)
```
id           String    PK       主键
asset_id     String    FK→Asset 资产 ID
seller_id    String    -        卖家 ID
price        Int       -        价格 (积分)
listing_type String    -        列表类型
status       String    DEFAULT 'active'  状态
expires_at   DateTime? -        过期时间
created_at   DateTime  DEFAULT now()   创建时间

listing_type: fixed_price | auction | rent
status:       active | sold | cancelled | expired
```

### MarketplaceTransaction (市场交易)
```
id               String    PK       主键
listing_id       String    FK→Listing 列表 ID
buyer_id         String    -        买家 ID
seller_id        String    -        卖家 ID
asset_id         String    -        资产 ID
price            Int       -        成交价格
transaction_type String    -        交易类型
status           String    DEFAULT 'completed'  状态
created_at       DateTime  DEFAULT now()   创建时间
```

---

## 7. 社区

```
Guild:         id, name, description, owner_id, member_count
Circle:        id, name, description, creator_id, member_ids[]
ArenaSeason:   id, season_id, start_date, end_date, status
ArenaMatch:    id, season_id, participants[], winner_id, status
DriftBottle:   id, sender_id, content, recipient_id?, status, created_at
```

---

## 8. 知识图谱

### KnowledgeGraphRelationship
```
id                String    PK       主键
relationship_id    String    UNIQUE   关系公开 ID
from_id           String    -        起始节点 ID
to_id             String    -        目标节点 ID
relationship_type String    -        关系类型
properties        Json      DEFAULT '{}'  关系属性
created_at        DateTime  DEFAULT now()  创建时间
updated_at        DateTime  @updatedAt      更新时间
```

### MemoryGraphNode / MemoryGraphEdge / CapabilityChain
```
MemoryGraphNode:  id, node_id, node_type, properties, metadata
MemoryGraphEdge:  id, from_node_id, to_node_id, edge_type, weight
CapabilityChain:   id, chain_id, capability, source_id, target_id, score
```

---

## 9. 扩展模块

### Question / QuestionAnswer / QuestionSecurityScan
```
Question:             id, question_id, title, content, author_id, status
QuestionAnswer:       id, question_id, content, author_id, is_accepted
QuestionSecurityScan: id, question_id, scan_result, issues[]
```

### Project / ProjectTask / ProjectContribution
```
Project:             id, name, description, owner_id, status
ProjectTask:         id, project_id, title, assignee_id, status, priority
ProjectContribution: id, project_id, contributor_id, amount, description
```

### ReadingSession / Skill / SkillRating
```
ReadingSession: id, user_id, content, progress, status
Skill:          id, skill_id, name, description, author_id, rating
SkillRating:    id, skill_id, user_id, rating, comment
```

### HallucinationCheck / GepxBundle / GepxExport / Sandbox
```
HallucinationCheck: id, asset_id, check_result, confidence, issues[]
GepxBundle:         id, bundle_id, content, metadata
GepxExport:         id, export_id, bundle_id, format, created_at
EvolutionSandbox:   id, sandbox_id, config, status
SandboxMember:      sandbox membership tracking
SandboxAsset:       sandbox asset tracking
PromotionRequest:    id, requester_id, type, status
SandboxInvite:      id, sandbox_id, invitee_id, status
```

---

*最后更新: 2026-04-29*
