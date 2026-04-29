# My Evo Data Models

**Version:** 1.0.0 | **ORM:** Prisma | **Database:** PostgreSQL

---

## Entity Relationships

```
User ──┬── 1:N ──► Node ──┬── 1:N ──► Edge (outgoing)
       │                  │
       │                  └── 1:N ──► Asset ──┬── 1:N ──► Vote
       │                                  │
       └── 1:N ──► Session                └── N:1 ◄── User
       └── 1:N ──► Vote ──► Asset
```

---

## Schema: User
```prisma
model User {
  id          String    @id @default(uuid())
  email       String    @unique
  password   String
  name        String?
  avatar      String?
  role        String    @default("user")
  level       Int       @default(1)
  reputation  Float     @default(0)
  credits     Float     @default(0)
  claimed     Boolean   @default(false)
  claimCode   String?   @unique
  claimDeadline DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  nodes       Node[]
  assets      Asset[]
  votes       Vote[]
  sessions    Session[]

  @@map("users")
}
```

## Schema: Session
```prisma
model Session {
  id           String   @id @default(uuid())
  userId       String
  refreshToken String
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([refreshToken])
  @@map("sessions")
}
```

## Schema: Node
```prisma
model Node {
  id          String   @id @default(uuid())
  name        String
  description String?
  type        String   @default("concept")
  category    String?
  metadata    Json     @default("{}")
  position    Json?
  level       Int      @default(0)
  reputation  Float    @default(0)
  viewCount   Int      @default(0)

  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  outgoingEdges Edge[]  @relation("SourceNode")
  incomingEdges Edge[]  @relation("TargetNode")
  assets        Asset[]

  @@index([ownerId])
  @@index([type])
  @@map("nodes")
}
```

## Schema: Edge
```prisma
model Edge {
  id          String   @id @default(uuid())
  sourceId    String
  targetId    String
  type        String   @default("related")
  weight      Float    @default(1.0)
  description String?

  sourceNode  Node     @relation("SourceNode", fields: [sourceId], references: [id], onDelete: Cascade)
  targetNode  Node     @relation("TargetNode", fields: [targetId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())

  @@index([sourceId])
  @@index([targetId])
  @@map("edges")
}
```

## Schema: Asset
```prisma
model Asset {
  id          String   @id @default(uuid())
  title       String
  description String?
  type        String
  content     String?
  url         String?
  metadata    Json     @default("{}")
  published   Boolean  @default(false)
  price       Float?

  authorId    String
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  nodeId      String?
  node        Node?    @relation(fields: [nodeId], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  votes       Vote[]

  @@index([authorId])
  @@index([nodeId])
  @@map("assets")
}
```

## Schema: Vote
```prisma
model Vote {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  assetId   String
  asset     Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  value     Int
  createdAt DateTime @default(now())

  @@unique([userId, assetId])
  @@index([assetId])
  @@map("votes")
}
```

---

## Field Reference

### User
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | UUID | auto | PK |
| email | String | - | Unique |
| password | String | - | Hashed |
| name | String? | null | Display name |
| avatar | String? | null | URL |
| role | String | "user" | user/admin |
| level | Int | 1 | User level |
| reputation | Float | 0 | Score |
| credits | Float | 0 | Balance |
| claimed | Boolean | false | Node claimed |
| claimCode | String? | null | Unique |

### Node
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | UUID | auto | PK |
| name | String | - | Required |
| description | String? | null | |
| type | String | "concept" | concept/model/skill |
| category | String? | null | |
| metadata | JSON | {} | Custom data |
| position | JSON? | null | {x, y} coords |
| level | Int | 0 | Hierarchy |
| reputation | Float | 0 | Node score |
| viewCount | Int | 0 | Counter |
| ownerId | String | - | FK → User |

### Edge
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | UUID | auto | PK |
| sourceId | String | - | FK → Node |
| targetId | String | - | FK → Node |
| type | String | "related" | Edge type |
| weight | Float | 1.0 | Importance |
| description | String? | null | |

### Asset
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | UUID | auto | PK |
| title | String | - | Required |
| type | String | - | skill/model/dataset |
| published | Boolean | false | |
| price | Float? | null | Credits price |
| authorId | String | - | FK → User |
| nodeId | String? | null | FK → Node |

---

## Indexes
| Table | Index | Type |
|-------|-------|------|
| users | email | UNIQUE |
| nodes | ownerId, type | INDEX |
| edges | sourceId, targetId | INDEX |
| assets | authorId, nodeId | INDEX |
| votes | (userId, assetId) | UNIQUE |

---

## Cascade Rules
| Parent | Child | On Delete |
|--------|-------|-----------|
| User | Session | CASCADE |
| User | Node | CASCADE |
| User | Asset | CASCADE |
| User | Vote | CASCADE |
| Node | Edge | CASCADE |
| Node | Asset | SET NULL |
| Asset | Vote | CASCADE |

---

**Version:** 1.0.0 | **Updated:** 2026-04-29
