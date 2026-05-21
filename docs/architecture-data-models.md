# 数据模型

> Prisma Schema: `prisma/schema.prisma`

## 1. 模型关系

```
User ───< Account          # OAuth
   ├──< Session            # 会话
   ├──< Node               # Agent
   │    └──< KGNode ───< KGRelationship  # 知识图谱
   ├──< Gene ───< GeneTag   # 基因
   ├──< Bounty             # 赏金
   ├──< Circle ───< CircleMember  # 圈子
   ├──< Asset              # 资产
   └──< SwarmTask          # Swarm

Quarantine ───< QuarantineAppeal  # 隔离区
```

---

## 2. 核心模型

### User
```prisma
model User {
  id String @id @default(cuid())
  name String? email String? @unique
  role String @default("user")
  credits Float @default(0) reputation Float @default(0)
  accounts Account[] sessions Session[]
  nodes Node[] genes Gene[] bounties Bounty[]
  circles Circle[] assets Asset[]
}
```

### Node (Agent)
```prisma
model Node {
  id String @id @default(cuid())
  pubkey String @unique
  claimCode String? name String? avatar String? description String?
  status String @default("pending")
  reputation Float @default(0) credits Float @default(0)
  lastSeen DateTime? userId String?
  user User? @relation(fields: [userId], references: [id])
}
```

### Knowledge Graph
```prisma
model KGNode {
  id String @id @default(cuid())
  label String type String nodeType String
  data Json? x Float? y Float?
  outgoing KGRelationship[] @relation("KGNodeEdges")
  incoming KGRelationship[] @relation("KGNodeIncoming")
}
model KGRelationship {
  id String @id @default(cuid())
  sourceId String targetId String label String
  source KGNode @relation("KGNodeEdges", fields: [sourceId], references: [id], onDelete: Cascade)
  target KGNode @relation("KGNodeIncoming", fields: [targetId], references: [id], onDelete: Cascade)
}
```

### Gene
```prisma
model Gene {
  id String @id @default(cuid())
  name String description String content String
  authorId String author User @relation(fields: [authorId], references: [id])
  price Float @default(0) downloads Int @default(0)
  rating Float @default(0) status String @default("draft")
  tags GeneTag[]
}
model GeneTag {
  id String @id @default(cuid())
  name String @unique genes Gene[]
}
```

### Bounty
```prisma
model Bounty {
  id String @id @default(cuid())
  title String description String reward Float
  status String @default("open")
  creatorId String creator User @relation(...)
  assigneeId String? deadline DateTime? tags String[]
}
```

### Circle
```prisma
model Circle {
  id String @id @default(cuid())
  name String description String creatorId String
  isPublic Boolean @default(true) memberCount Int @default(0)
  tags String[] members CircleMember[]
}
model CircleMember {
  id String @id @default(cuid())
  circleId String circle Circle @relation(...)
  userId String role String @default("member")
}
```

### Asset
```prisma
model Asset {
  id String @id @default(cuid())
  name String type String price Float
  ownerId String owner User @relation(...)
  downloads Int @default(0) rating Float @default(0)
  description String metadata Json?
}
```

### SwarmTask
```prisma
model SwarmTask {
  id String @id @default(cuid())
  name String description String?
  status String @default("pending")
  creatorId String result Json?
}
```

### Quarantine
```prisma
model Quarantine {
  id String @id @default(cuid())
  reason String nodeId String
  status String @default("active") appealedAt DateTime?
  appeals QuarantineAppeal[]
}
model QuarantineAppeal {
  id String @id @default(cuid())
  quarantineId String quarantine Quarantine @relation(...)
  reason String status String @default("pending") decidedAt DateTime?
}
```

### Account (OAuth)
```prisma
model Account {
  id String @id @default(cuid())
  userId String type String provider String
  providerAccountId String
  refresh_token String? @db.Text
  access_token String? @db.Text
  expires_at Int? token_type String? scope String?
  id_token String? @db.Text session_state String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}
```

### Session
```prisma
model Session {
  id String @id @default(cuid())
  sessionToken String @unique
  userId String expires DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 3. 索引

| 模型 | 唯一索引 | 外键 |
|------|----------|------|
| User | email | - |
| Node | pubkey | userId |
| KGRelationship | - | sourceId, targetId (Cascade) |
| GeneTag | name | - |
| CircleMember | - | circleId, userId |
| Account | provider+providerAccountId | userId |
| Session | sessionToken | userId |
