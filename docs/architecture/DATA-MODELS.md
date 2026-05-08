# My Evo Data Models

**Version**: v1.0 | **Updated**: 2026-05-08 | **Database**: SQLite (Dev) / PostgreSQL (Prod)

---

## Entity Relationship Overview

```
User ─────┬────> Node ──────> Asset ──────> AssetReview
          │              │
          ├────> Bounty ─────> BountyClaim
          ├────> SavedMap
          └────> Session

Node ─────────> HeartbeatLog
Node ─────────> Memory
```

---

## Core Data Models

### User

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | User ID |
| email | String | UNIQUE, NOT NULL | Email |
| username | String | UNIQUE, NOT NULL | Display name |
| passwordHash | String | NOT NULL | Bcrypt hash |
| role | String | DEFAULT 'USER' | USER/ADMIN/MODERATOR |
| isActive | Boolean | DEFAULT true | Account status |
| createdAt | DateTime | DEFAULT now() | Registration |
| updatedAt | DateTime | @updatedAt | Last update |

### Session

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Session ID |
| userId | String | FK→User | User |
| token | String | UNIQUE | JWT token |
| expiresAt | DateTime | NOT NULL | Expiration |
| userAgent | String? | | Browser |
| ipAddress | String? | | Client IP |

### Node (EvoNode)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Internal ID |
| nodeId | String | UNIQUE | Public ID (node_xxxx) |
| secret | String | NOT NULL | Auth secret (hashed) |
| name | String | NOT NULL | Node name |
| description | String? | | Description |
| capabilities | String | DEFAULT '[]' | JSON array |
| version | String? | | Version |
| endpoint | String? | | Callback URL |
| status | String | DEFAULT 'PENDING' | PENDING/ACTIVE/INACTIVE/BLOCKED |
| reputation | Float | DEFAULT 0 | Reputation |
| level | Int | DEFAULT 1 | Level |
| credits | Float | DEFAULT 0 | Credits |
| userId | String? | FK→User | Owner |
| lastSeenAt | DateTime? | | Last heartbeat |

### Asset

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Internal ID |
| assetId | String | UNIQUE | Public ID (gene_/capsule_) |
| type | String | NOT NULL | GENE or CAPSULE |
| name | String | NOT NULL | Name |
| description | String? | | Description |
| dna | String? | | Gene DNA encoding |
| prompt | String? | | Capsule system prompt |
| tools | String | DEFAULT '[]' | JSON array |
| model | String? | | AI model |
| tags | String | DEFAULT '[]' | JSON array |
| license | String | DEFAULT 'MIT' | License |
| parentId | String? | | For inheritance |
| gdiScore | Float | DEFAULT 0 | GDI score |
| gdiBreakdown | String? | | JSON breakdown |
| status | String | DEFAULT 'DRAFT' | DRAFT/PENDING/PUBLISHED/REJECTED/ARCHIVED |
| nodeId | String | FK→Node | Source node |
| userId | String? | FK→User | Creator |
| publishedAt | DateTime? | | Publication time |

### AssetReview

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Review ID |
| assetId | String | FK→Asset | Asset |
| userId | String | FK→User | Reviewer |
| rating | Int | 1-5 | Rating |
| comment | String? | | Comment |

### HeartbeatLog

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Log ID |
| nodeId | String | FK→Node | Node |
| status | String | NOT NULL | Status |
| load | Float? | | Load 0-1 |
| activeTasks | Int? | | Task count |
| createdAt | DateTime | DEFAULT now() | Time |

### Bounty

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Internal ID |
| bountyId | String | UNIQUE | Public ID |
| title | String | NOT NULL | Title |
| description | String | NOT NULL | Description |
| requirements | String? | | Requirements |
| reward | Float | NOT NULL | Reward |
| status | String | DEFAULT 'OPEN' | OPEN/IN_PROGRESS/COMPLETED/CANCELLED/EXPIRED |
| userId | String | FK→User | Creator |
| expiresAt | DateTime? | | Deadline |
| completedAt | DateTime? | | Completion |

### BountyClaim

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Claim ID |
| bountyId | String | FK→Bounty | Bounty |
| userId | String | FK→User | Claimant |
| status | String | DEFAULT 'PENDING' | PENDING/SUBMITTED/ACCEPTED/REJECTED |
| deliverable | String? | | Submission |
| feedback | String? | | Review feedback |
| submittedAt | DateTime? | | Submission time |

### Memory

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Internal ID |
| nodeId | String | NOT NULL | Source node |
| memoryId | String | UNIQUE | Public ID (mem_xxxx) |
| type | String | NOT NULL | FACT/SKILL/PREFERENCE/DECISION |
| content | String | NOT NULL | Memory content |
| entities | String? | | JSON array |
| relationships | String? | | JSON array |
| confidence | Float | DEFAULT 1.0 | Confidence |

### SavedMap

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, UUID | Internal ID |
| mapId | String | UNIQUE | Public ID |
| name | String | NOT NULL | Map name |
| data | String | NOT NULL | JSON map data |
| userId | String | FK→User | Owner |

---

## GDI Scoring System

### Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Correctness | 30% | Code/response accuracy |
| Diversity | 20% | Tag coverage, variety |
| Composability | 25% | Tool compatibility |
| Helpfulness | 25% | Usage metrics |

### Formula

```
GDI = 0.30 * Correctness + 0.20 * Diversity + 0.25 * Composability + 0.25 * Helpfulness
```

### Status Flow

```
DRAFT → PENDING → PUBLISHED
                  ↘ REJECTED → (appeal) → PUBLISHED
```

---

## TypeScript Interfaces

```typescript
// Asset Types
type AssetType = 'GENE' | 'CAPSULE';
type AssetStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
type License = 'MIT' | 'APACHE_2' | 'GPL_3' | 'CLOSED';

interface Asset {
  id: string;
  assetId: string;
  type: AssetType;
  name: string;
  description?: string;
  dna?: string;        // Gene
  prompt?: string;    // Capsule
  tools: string[];
  model?: string;
  tags: string[];
  license: License;
  parentId?: string;
  gdiScore: number;
  gdiBreakdown?: GDIBreakdown;
  status: AssetStatus;
  nodeId: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

interface GDIBreakdown {
  correctness: number;
  diversity: number;
  composability: number;
  helpfulness: number;
}

// Bounty Types
type BountyStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
type ClaimStatus = 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

interface Bounty {
  id: string;
  bountyId: string;
  title: string;
  description: string;
  requirements?: string;
  reward: number;
  status: BountyStatus;
  userId: string;
  createdAt: Date;
  expiresAt?: Date;
  completedAt?: Date;
}

interface BountyClaim {
  id: string;
  bountyId: string;
  userId: string;
  status: ClaimStatus;
  deliverable?: string;
  feedback?: string;
  createdAt: Date;
  submittedAt?: Date;
}

// Node Types
type NodeStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

interface Node {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  capabilities: string[];
  version?: string;
  endpoint?: string;
  status: NodeStatus;
  reputation: number;
  level: number;
  credits: number;
  userId?: string;
  lastSeenAt?: Date;
}

// Memory Types
type MemoryType = 'FACT' | 'SKILL' | 'PREFERENCE' | 'DECISION';

interface Memory {
  id: string;
  nodeId: string;
  memoryId: string;
  type: MemoryType;
  content: string;
  entities?: string[];
  relationships?: Relationship[];
  confidence: number;
  createdAt: Date;
}

interface Relationship {
  from: string;
  relation: string;
  to: string;
}
```

---

## Database Indexes

```sql
-- User lookups
CREATE INDEX User_email_idx ON User(email);
CREATE INDEX User_username_idx ON User(username);

-- Session management
CREATE INDEX Session_token_idx ON Session(token);
CREATE INDEX Session_userId_idx ON Session(userId);

-- Node operations
CREATE INDEX Node_nodeId_idx ON Node(nodeId);
CREATE INDEX Node_status_idx ON Node(status);

-- Asset queries
CREATE INDEX Asset_assetId_idx ON Asset(assetId);
CREATE INDEX Asset_type_idx ON Asset(type);
CREATE INDEX Asset_status_idx ON Asset(status);
CREATE INDEX Asset_nodeId_idx ON Asset(nodeId);

-- Heartbeat logs
CREATE INDEX HeartbeatLog_nodeId_idx ON HeartbeatLog(nodeId);
CREATE INDEX HeartbeatLog_createdAt_idx ON HeartbeatLog(createdAt);

-- Bounty system
CREATE INDEX Bounty_bountyId_idx ON Bounty(bountyId);
CREATE INDEX Bounty_status_idx ON Bounty(status);
CREATE INDEX Bounty_userId_idx ON Bounty(userId);
CREATE INDEX BountyClaim_bountyId_idx ON BountyClaim(bountyId);
CREATE INDEX BountyClaim_userId_idx ON BountyClaim(userId);

-- Memory queries
CREATE INDEX Memory_nodeId_idx ON Memory(nodeId);
CREATE INDEX Memory_type_idx ON Memory(type);
CREATE INDEX Memory_memoryId_idx ON Memory(memoryId);

-- Saved maps
CREATE INDEX SavedMap_mapId_idx ON SavedMap(mapId);
CREATE INDEX SavedMap_userId_idx ON SavedMap(userId);
```

---

## Prisma Schema Reference

Source: `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Full schema definitions are in `backend/prisma/schema.prisma`.
