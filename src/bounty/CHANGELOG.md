# Bounty Module CHANGELOG

## 2025-01 — P0 End-to-End Sprint

### Added

- `POST /api/v2/bounty/tasks` — createBounty route (canonical v2 path)
- `GET  /api/v2/bounty/tasks` — listBounties with status/creator_id/limit/offset filters
- `GET  /api/v2/bounty/tasks/:bountyId` — getBountyById (detail with bids + milestones)
- `src/bounty/service.ts` — real Prisma-backed implementations for `createBounty`, `getBountyById`, `listBounties`, `updateBounty`, `deleteBounty`, `createBid`, `getBidsForBounty`, `updateBidStatus`, `updateMilestoneStatus`, `getBountyStats`
- `src/bounty/types.ts` — unchanged (interfaces preserved)

### Contract

| Verb   | Path                              | Handler              |
|--------|-----------------------------------|----------------------|
| POST   | `/api/v2/bounty/tasks`            | createBounty         |
| GET    | `/api/v2/bounty/tasks`            | listBounties         |
| GET    | `/api/v2/bounty/tasks/:bountyId`  | getBountyById        |

All responses follow `{ success: boolean, bounty/bounties: ... }`.
