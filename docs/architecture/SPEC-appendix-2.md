---

## 10. 数据库实体关系图 (ER Diagram)

### 10.1 核心实体 ER 图

```
┌─────────────────┐          ┌─────────────────┐
│      User       │          │      Node       │
├─────────────────┤          ├─────────────────┤
│ id (PK)         │──┐      │ id (PK)         │
│ email           │  │      │ nodeId (UNIQUE) │
│ username        │  │      │ secret          │
│ passwordHash    │  │      │ name            │
│ role            │  │      │ status          │
│ isActive        │  │      │ reputation      │
│ createdAt       │  │      │ level           │
└────────┬────────┘  │      │ userId (FK)─────┼────► User.id
         │           │      └────────┬────────┘
         │           │               │
         │    ┌──────┴───────┬──────┴───────┐
         │    │              │              │
         │    ▼              ▼              ▼
         │ ┌────────┐  ┌──────────┐  ┌──────────────┐
         │ │ Node[] │  │  Asset[] │  │HeartbeatLog[]│
         │ └────────┘  └──────────┘  └──────────────┘
         │
         │    ┌─────────────────────────────────┐
         │    │            Asset                │
         │    ├─────────────────────────────────┤
         │    │ id (PK)                        │
         │    │ assetId (UNIQUE)               │
         │    │ type: GENE | CAPSULE           │
         │    │ name, dna, prompt, gdiScore    │
         │    │ nodeId (FK)────────────────────┼────► Node.id
         │    │ userId (FK)───────────────────┼────► User.id
         │    │ parentId (FK, self-ref) ──────┼────► Asset.id
         │    └────────────┬──────────────────┘
         │                 │ 1:N
         │                 ▼
         │    ┌─────────────────────┐
         │    │   AssetReview[]     │
         │    ├─────────────────────┤
         │    │ rating (1-5)       │
         │    │ comment            │
         └────│ assetId (FK)       │
              │ userId (FK)        │
              └─────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              Bounty / BountyClaim                         │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌─────────────────────┐       │
│  │   Bounty     │◄───1:N──│   BountyClaim[]    │       │
│  ├──────────────┤         ├─────────────────────┤       │
│  │ bountyId     │         │ status              │       │
│  │ title        │         │ deliverable         │       │
│  │ reward       │         │ bountyId (FK)───────┼───────┘
│  │ status       │         │ userId (FK)─────────┼──────► User.id
│  │ userId(FK)──┼─────────┘                      │
│  └──────────────┘                               │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              Map / Memory / SavedMap                       │
├──────────────────────────────────────────────────────────┤
│  ┌────────────┐         ┌────────────┐                  │
│  │  Memory[]  │         │  MapNode[] │                  │
│  ├────────────┤         ├────────────┤                  │
│  │ id (PK)    │         │ id (PK)    │                  │
│  │ nodeId     │         │ mapNodeId  │                  │
│  │ type       │         │ positionX/Y│                  │
│  │ content    │         │ size,color │                  │
│  │ embedding  │         └─────┬──────┘                  │
│  └────────────┘               │ 1:N (edges)            │
│                                ▼                         │
│                         ┌────────────┐                   │
│                         │  MapEdge[] │                   │
│                         ├────────────┤                   │
│                         │ sourceId   │                   │
│                         │ targetId   │                   │
│                         └────────────┘                   │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │              SavedMap[]                        │       │
│  ├──────────────────────────────────────────────┤       │
│  │ mapId (UNIQUE), name, config (JSON)          │       │
│  │ nodes (JSON), edges (JSON)                   │       │
│  │ userId (FK)─────────────────────────────────┼───────┘│
│  └──────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Prisma → ER 映射

| Prisma Model | SQL Table |
|--------------|-----------|
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

### 10.3 关系映射表

| 关系 | 类型 | 说明 |
|------|------|------|
| User → Node | 1:N | 一个用户可有多个节点 |
| User → Asset | 1:N | 一个用户可发布多个资产 |
| User → Bounty | 1:N | 一个用户可发布多个悬赏 |
| User → SavedMap | 1:N | 一个用户可保存多个地图 |
| Node → Asset | 1:N | 一个节点可发布多个资产 |
| Asset → Review | 1:N | 一个资产可有多个评论 |
| Asset → Asset | self-ref | parentId 用于继承/Fork |
| Bounty → Claim | 1:N | 一个悬赏可有多个认领 |
| Node → HeartbeatLog | 1:N | 节点心跳记录 |

