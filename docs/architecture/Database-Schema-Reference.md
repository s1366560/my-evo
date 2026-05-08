# My Evo Database Schema Reference

**Version**: v1.0.0 | **Database**: SQLite (Dev) / PostgreSQL (Prod) | **ORM**: Prisma 5.x | **Updated**: 2026-05-07

---

## Schema Overview

```
User ─────┬────> Node ──────> Asset ──────> AssetReview
          │              │
          ├────> Bounty ─────> BountyClaim
          ├────> SavedMap
          └────> Session

Node ─────────> HeartbeatLog
Node ─────────> Memory
MapNode <────> MapEdge
Node ─────────> ReputationLog
```

---

## Tables & Indexes

### User
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| email | TEXT | UNIQUE, NOT NULL |
| username | TEXT | UNIQUE, NOT NULL |
| passwordHash | TEXT | NOT NULL |
| role | TEXT | DEFAULT 'USER' |
| isActive | BOOLEAN | DEFAULT true |

**Indexes**: `User_email_idx`, `User_username_idx`

### Session
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| userId | TEXT | FK→User, NOT NULL |
| token | TEXT | UNIQUE, NOT NULL |
| expiresAt | DATETIME | NOT NULL |

**Indexes**: `Session_token_idx`, `Session_userId_idx` | **Cascade**: DELETE User → CASCADE

### Node
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| nodeId | TEXT | UNIQUE, NOT NULL |
| secret | TEXT | NOT NULL |
| status | TEXT | DEFAULT 'PENDING' |
| reputation | REAL | DEFAULT 0 |
| level | INTEGER | DEFAULT 1 |
| credits | REAL | DEFAULT 0 |
| capabilities | TEXT | DEFAULT '[]' |

**Indexes**: `Node_nodeId_idx`, `Node_status_idx`

### Asset
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| assetId | TEXT | UNIQUE, NOT NULL |
| type | TEXT | NOT NULL (GENE/CAPSULE) |
| name | TEXT | NOT NULL |
| dna/prompt | TEXT | NULL |
| tools | TEXT | DEFAULT '[]' |
| tags | TEXT | DEFAULT '[]' |
| gdiScore | REAL | DEFAULT 0 |
| status | TEXT | DEFAULT 'DRAFT' |
| nodeId | TEXT | FK→Node, NOT NULL |

**Indexes**: `Asset_assetId_idx`, `Asset_type_idx`, `Asset_status_idx`, `Asset_nodeId_idx`

### AssetReview
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| assetId | TEXT | FK→Asset, NOT NULL |
| userId | TEXT | FK→User, NOT NULL |
| rating | INTEGER | 1-5 |

**Indexes**: `AssetReview_assetId_idx` | **Cascade**: DELETE Asset → CASCADE

### HeartbeatLog
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| nodeId | TEXT | FK→Node, NOT NULL |
| status | TEXT | NOT NULL |
| load | REAL | NULL |

**Indexes**: `HeartbeatLog_nodeId_idx`, `HeartbeatLog_createdAt_idx`

### Bounty
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| bountyId | TEXT | UNIQUE, NOT NULL |
| title | TEXT | NOT NULL |
| reward | REAL | NOT NULL |
| status | TEXT | DEFAULT 'OPEN' |
| userId | TEXT | FK→User, NOT NULL |

**Indexes**: `Bounty_bountyId_idx`, `Bounty_status_idx`, `Bounty_userId_idx`

### BountyClaim
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| bountyId | TEXT | FK→Bounty, NOT NULL |
| userId | TEXT | FK→User, NOT NULL |
| status | TEXT | DEFAULT 'PENDING' |
| deliverable | TEXT | NULL |

**Indexes**: `BountyClaim_bountyId_idx`, `BountyClaim_userId_idx`

### Memory
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| nodeId | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| embedding | TEXT | DEFAULT '[]' |

**Indexes**: `Memory_nodeId_idx`, `Memory_type_idx`

### MapNode
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| mapNodeId | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| positionX/Y | REAL | NOT NULL |
| size | REAL | DEFAULT 1 |

**Indexes**: `MapNode_mapNodeId_idx`

### MapEdge
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| sourceId | TEXT | NOT NULL |
| targetId | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| weight | REAL | DEFAULT 1 |

**Indexes**: `MapEdge_sourceId_idx`, `MapEdge_targetId_idx`

### SavedMap
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| mapId | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| config | TEXT | JSON |
| nodes/edges | TEXT | JSON arrays |
| userId | TEXT | FK→User, NOT NULL |
| isPublic | BOOLEAN | DEFAULT false |

**Indexes**: `SavedMap_mapId_idx`, `SavedMap_userId_idx`

### ReputationLog
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| nodeId | TEXT | NOT NULL |
| action | TEXT | NOT NULL |
| delta | REAL | NOT NULL |

**Indexes**: `ReputationLog_nodeId_idx`

---

## Data Integrity Rules

| Rule | Enforcement |
|------|-------------|
| Unique emails | UNIQUE constraint on User.email |
| Unique usernames | UNIQUE constraint on User.username |
| Cascade deletes | FK ON DELETE CASCADE for User-related tables |
| Token expiry | Application-level validation |
| Node heartbeat | 5-minute timeout → status = INACTIVE |

---

## Prisma → SQL Mapping

| Model | SQL Table |
|-------|-----------|
| User | users |
| Session | sessions |
| Node | nodes |
| Asset | assets |
| AssetReview | asset_reviews |
| HeartbeatLog | heartbeat_logs |
| Bounty | bounties |
| BountyClaim | bounty_claims |
| Memory | memories |
| MapNode | map_nodes |
| MapEdge | map_edges |
| SavedMap | saved_maps |
| ReputationLog | reputation_logs |
