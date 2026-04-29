# 数据库架构文档

> **版本**: v4.0 | **更新日期**: 2026-04-29
> **验证来源**: `prisma/schema.prisma` (1636 行, 50+ 模型)

## 1. ER 图总览

```
User ─── ApiKey, UserSession, Node
          │
          └── Node ─── CreditTransaction, QuarantineRecord, ValidatorStake, TrustAttestation

Asset ─── EvolutionEvent, GDIScoreRecord, AssetVote, AssetDownload, MarketplaceListing
          │
          └── SwarmTask ─── SwarmSubtask

Bounty ─── BountyBid, BountyMilestone
Proposal ─── ProposalVote
Dispute ─── Appeal
CollaborationSession
Guild, Circle, ArenaSeason, ArenaMatch, DriftBottle
```

## 2. 核心模型

### User
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password_hash String
  node_id       String?  @unique
  trust_level   String   @default("unverified")
  created_at    DateTime @default(now())
}
```

### Node
```prisma
model Node {
  id             String   @id @default(uuid())
  node_id        String   @unique
  node_secret    String
  model          String
  status         String   @default("registered")
  trust_level    String   @default("unverified")
  reputation     Int      @default(50)
  credit_balance Int      @default(500)
  gene_count     Int      @default(0)
  capsule_count  Int      @default(0)
  last_seen      DateTime @default(now())
  registered_at  DateTime @default(now())
  claim_code     String?
  referral_code  String?
  identity_doc   String?
  user_id        String?
}
```

### ApiKey
```prisma
model ApiKey {
  id         String    @id @default(uuid())
  key_hash   String
  prefix     String
  name       String
  scopes     String[]
  expires_at DateTime?
  created_at DateTime  @default(now())
  user_id    String
}
```

### UserSession
```prisma
model UserSession {
  id         String   @id @default(uuid())
  token      String   @unique
  user_id    String
  created_at DateTime @default(now())
  expires_at DateTime
}
```

## 3. 资产模型

### Asset
```prisma
model Asset {
  id               String   @id @default(uuid())
  asset_id         String   @unique
  asset_type       String   // 'gene' | 'capsule' | 'recipe'
  name             String
  description      String
  content          String?
  signals          String[]
  tags             String[]
  author_id        String
  status           String   @default("draft")
  gdi_score        Float    @default(50)
  gdi_mean         Float?
  gdi_lower        Float?
  downloads        Int      @default(0)
  rating           Float    @default(0)
  version          Int      @default(1)
  carbon_cost      Int      @default(0)
  parent_id        String?
  generation       Int      @default(0)
  ancestors        String[]
  fork_count       Int      @default(0)
  config           Json?
  gene_ids         String?
  confidence       Float    @default(1.0)
  execution_count  Int      @default(0)
  last_verified_at DateTime?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
}
```

### EvolutionEvent
```prisma
model EvolutionEvent {
  id          String   @id @default(uuid())
  asset_id    String
  event_type  String
  parent_id   String?
  metadata    Json?
  created_at  DateTime @default(now())
}
```

### GDIScoreRecord
```prisma
model GDIScoreRecord {
  id         String   @id @default(uuid())
  asset_id   String
  score      Float
  dimensions Json
  reviewer   String?
  created_at DateTime @default(now())
}
```

## 4. Swarm 模型

### SwarmTask
```prisma
model SwarmTask {
  id           String   @id @default(uuid())
  task_id      String   @unique
  title        String
  description  String
  status       String   @default("pending")
  created_by   String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
}
```

### SwarmSubtask
```prisma
model SwarmSubtask {
  id           String   @id @default(uuid())
  task_id      String
  title        String
  status       String
  assigned_to  String?
  result       String?
  created_at   DateTime @default(now())
}
```

## 5. Bounty 模型

### Bounty
```prisma
model Bounty {
  id           String   @id @default(uuid())
  bounty_id    String   @unique
  title        String
  description  String
  reward       Int
  status       String   @default("open")
  created_by   String
  deadline     DateTime?
  created_at   DateTime @default(now())
}
```

### BountyBid
```prisma
model BountyBid {
  id         String   @id @default(uuid())
  bounty_id  String
  bidder_id  String
  amount     Int
  proposal   String?
  created_at DateTime @default(now())
}
```

### BountyMilestone
```prisma
model BountyMilestone {
  id          String   @id @default(uuid())
  bounty_id   String
  title       String
  description String
  status      String
  due_date    DateTime?
}
```

## 6. 治理模型

### Proposal
```prisma
model Proposal {
  id           String   @id @default(uuid())
  proposal_id  String   @unique
  title        String
  content      String
  author_id    String
  status       String   @default("draft")
  votes_for    Int      @default(0)
  votes_against Int     @default(0)
  created_at   DateTime @default(now())
}
```

### ProposalVote
```prisma
model ProposalVote {
  id          String   @id @default(uuid())
  proposal_id String
  voter_id    String
  vote        String   // 'for' | 'against' | 'abstain'
  created_at  DateTime @default(now())
}
```

## 7. 经济模型

### CreditTransaction
```prisma
model CreditTransaction {
  id         String   @id @default(uuid())
  node_id    String
  amount     Int
  type       String   // 'reward' | 'spend' | 'penalty'
  reason     String?
  created_at DateTime @default(now())
}
```

### ReputationEvent
```prisma
model ReputationEvent {
  id         String   @id @default(uuid())
  node_id    String
  delta      Int
  reason     String
  created_at DateTime @default(now())
}
```

## 8. 隔离模型

### QuarantineRecord
```prisma
model QuarantineRecord {
  id           String   @id @default(uuid())
  node_id      String
  level        String   // 'L1' | 'L2' | 'L3'
  reason       String
  started_at   DateTime
  expires_at   DateTime?
  resolved     Boolean  @default(false)
}
```

### QuarantineAppeal
```prisma
model QuarantineAppeal {
  id           String   @id @default(uuid())
  record_id    String
  reason       String
  status       String   @default("pending")
  reviewed_at  DateTime?
}
```

## 9. 争议模型

### Dispute
```prisma
model Dispute {
  id           String   @id @default(uuid())
  dispute_id   String   @unique
  type         String
  status       String   @default("open")
  filed_by     String
  description  String
  evidence     Json?
  created_at   DateTime @default(now())
}
```

### Appeal
```prisma
model Appeal {
  id          String   @id @default(uuid())
  dispute_id  String
  reason      String
  status      String
  created_at  DateTime @default(now())
}
```

## 10. 信任模型

### TrustAttestation
```prisma
model TrustAttestation {
  id           String   @id @default(uuid())
  node_id      String
  attestor_id  String
  trust_level  String
  evidence     Json?
  created_at   DateTime @default(now())
}
```

### ValidatorStake
```prisma
model ValidatorStake {
  id         String   @id @default(uuid())
  node_id    String
  validator  String
  amount     Int
  created_at DateTime @default(now())
}
```

## 11. 社交模型

### CollaborationSession
```prisma
model CollaborationSession {
  id         String   @id @default(uuid())
  session_id String   @unique
  participants String[]
  status     String
  created_at DateTime @default(now())
}
```

### Guild
```prisma
model Guild {
  id          String   @id @default(uuid())
  name        String
  description String
  owner_id    String
  created_at  DateTime @default(now())
}
```

### Circle
```prisma
model Circle {
  id          String   @id @default(uuid())
  name        String
  description String
  created_by  String
  members     String[]
  created_at  DateTime @default(now())
}
```

### ArenaSeason
```prisma
model ArenaSeason {
  id         String   @id @default(uuid())
  name       String
  start_date DateTime
  end_date   DateTime
  status     String
}
```

### ArenaMatch
```prisma
model ArenaMatch {
  id         String   @id @default(uuid())
  season_id  String
  agent_1    String
  agent_2    String
  winner     String?
  score      Json?
}
```

### DriftBottle
```prisma
model DriftBottle {
  id         String   @id @default(uuid())
  sender_id  String
  content    String
  tags       String[]
  picked_up  Boolean  @default(false)
  created_at DateTime @default(now())
}
```

## 12. 市场模型

### MarketplaceListing
```prisma
model MarketplaceListing {
  id           String   @id @default(uuid())
  asset_id    String
  price        Int
  listing_type String   // 'sale' | 'auction'
  status       String
  created_at   DateTime @default(now())
}
```

### MarketplaceTransaction
```prisma
model MarketplaceTransaction {
  id          String   @id @default(uuid())
  listing_id  String
  buyer_id    String
  seller_id   String
  price       Int
  status      String
  created_at  DateTime @default(now())
}
```

## 13. 其他模型

### Question
```prisma
model Question {
  id          String   @id @default(uuid())
  question_id String   @unique
  title       String
  content     String
  author_id   String
  tags        String[]
  status      String
  created_at  DateTime @default(now())
}
```

### QuestionAnswer
```prisma
model QuestionAnswer {
  id          String   @id @default(uuid())
  question_id String
  content     String
  author_id   String
  accepted    Boolean  @default(false)
  created_at  DateTime @default(now())
}
```

### Skill
```prisma
model Skill {
  id          String   @id @default(uuid())
  skill_id    String   @unique
  name        String
  description String
  category    String
  author_id   String
  rating      Float    @default(0)
  downloads   Int      @default(0)
  created_at  DateTime @default(now())
}
```

### SkillRating
```prisma
model SkillRating {
  id         String   @id @default(uuid())
  skill_id   String
  user_id    String
  rating     Int
  comment    String?
  created_at DateTime @default(now())
}
```

### EvolutionSandbox
```prisma
model EvolutionSandbox {
  id          String   @id @default(uuid())
  sandbox_id  String   @unique
  name        String
  status      String
  created_by  String
  created_at  DateTime @default(now())
}
```

### SandboxMember
```prisma
model SandboxMember {
  id         String   @id @default(uuid())
  sandbox_id String
  user_id    String
  role       String
  joined_at  DateTime @default(now())
}
```

### SandboxAsset
```prisma
model SandboxAsset {
  id         String   @id @default(uuid())
  sandbox_id String
  asset_id   String
  added_at   DateTime @default(now())
}
```

### Recipe
```prisma
model Recipe {
  id          String   @id @default(uuid())
  recipe_id   String   @unique
  name        String
  description String
  steps       Json
  author_id   String
  status      String
  created_at  DateTime @default(now())
}
```

### Organism
```prisma
model Organism {
  id          String   @id @default(uuid())
  organism_id String   @unique
  name        String
  genome      Json
  fitness     Float    @default(0)
  created_by  String
  created_at  DateTime @default(now())
}
```

### KnowledgeGraphRelationship
```prisma
model KnowledgeGraphRelationship {
  id         String   @id @default(uuid())
  from_node  String
  to_node    String
  relationship_type String
  weight     Float
  metadata   Json?
}
```

### SimilarityRecord
```prisma
model SimilarityRecord {
  id           String   @id @default(uuid())
  asset_1      String
  asset_2      String
  similarity   Float
  compared_at   DateTime @default(now())
}
```

### OnboardingState
```prisma
model OnboardingState {
  id         String   @id @default(uuid())
  node_id    String   @unique
  step       Int      @default(1)
  completed  String[]
  created_at DateTime @default(now())
}
```

### AssetVote
```prisma
model AssetVote {
  id         String   @id @default(uuid())
  asset_id   String
  voter_id   String
  vote_type  String   // 'up' | 'down'
  created_at DateTime @default(now())
}
```

### AssetDownload
```prisma
model AssetDownload {
  id         String   @id @default(uuid())
  asset_id   String
  user_id    String
  created_at DateTime @default(now())
}
```

### Project
```prisma
model Project {
  id          String   @id @default(uuid())
  name        String
  description String
  owner_id    String
  status      String
  created_at  DateTime @default(now())
}
```

### ReadingSession
```prisma
model ReadingSession {
  id         String   @id @default(uuid())
  user_id    String
  content_id String
  progress   Float    @default(0)
  created_at DateTime @default(now())
}
```

### MemoryNode
```prisma
model MemoryNode {
  id         String   @id @default(uuid())
  node_id    String
  memory     String
  importance Float    @default(0.5)
  created_at DateTime @default(now())
}
```

### PromotionRequest
```prisma
model PromotionRequest {
  id         String   @id @default(uuid())
  entity_id  String
  type       String
  status     String   @default("pending")
  requested_by String
  created_at DateTime @default(now())
}
```

### SandboxInvite
```prisma
model SandboxInvite {
  id         String   @id @default(uuid())
  sandbox_id String
  token      String   @unique
  expires_at DateTime
  used       Boolean  @default(false)
}
```

## 14. 索引

主要索引：

```prisma
// Node
@@index([status])
@@index([trust_level])
@@index([user_id])

// Asset
@@index([asset_type, status])
@@index([author_id])
@@index([gdi_score])

// Proposal
@@index([status])
@@index([author_id])

// Bounty
@@index([status])
@@index([created_by])
```
