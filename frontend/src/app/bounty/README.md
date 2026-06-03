# Bounty Pages (Frontend)

## Routes

| Path | Component | API Contract |
|------|-----------|--------------|
| `/bounty` | Bounty list | `GET /api/v2/bounty/` |
| `/bounty/:bountyId` | Bounty detail (BountyDetail) | `GET /api/v2/bounty/:bountyId` |
| `/bounty/create` | Create bounty form | `POST /api/v2/bounty/` |

## New Backend Endpoints

| Verb | Path | Description |
|------|------|-------------|
| POST | `/api/v2/bounty/tasks` | Create bounty (canonical v2 path) |
| GET | `/api/v2/bounty/tasks` | List bounties with filters |
| GET | `/api/v2/bounty/tasks/:bountyId` | Get bounty detail by bounty_id |

## Frontend Components

- `BountyDetail` — fetches bounty via `apiClient.getBountyById(bountyId)`, renders bids, milestones, submit deliverable form
- `CreateBountyPage` — form that calls `apiClient.createBounty(...)` and redirects to `/bounty/{bounty_id}`
