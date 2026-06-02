# API Contract Verification — Swarm & Council Modules

**Commit:** `abce8b56a18989ca4a67c4c504aef98c8ca1c8c9`  
**Date:** 2026-05-30  
**Status:** VERIFIED — All routes match TypeScript types

---

## Swarm Module — `/api/v2/swarm/*`

### Routes Implemented (8 total)

| Method | Path | Auth | TypeScript Response | HTTP Status | Notes |
|--------|------|------|---------------------|-------------|-------|
| GET | `/tasks` | No | `ListSwarmTasksResponse` | 200 | ✓ meta with total/limit/offset |
| GET | `/tasks/:swarmId` | No | `GetSwarmTaskResponse` | 200 / 404 | ✓ |
| POST | `/tasks` | Yes | `CreateSwarmTaskResponse` | 201 / 400 / 401 | ✓ |
| POST | `/tasks/:swarmId/subtasks` | No | `CreateSubtaskResponse` | 201 / 400 / 404 | ✓ |
| POST | `/tasks/:swarmId/subtasks/:subtaskId/complete` | Yes | `CompleteSubtaskResponse` | 200 / 400 / 401 / 404 | ✓ |
| POST | `/tasks/:swarmId/complete` | No | `CompleteSwarmTaskResponse` | 200 / 400 / 404 | ✓ |
| POST | `/tasks/:swarmId/fail` | No | `FailSwarmTaskResponse` | 200 / 400 / 404 | ✓ |
| POST | `/tasks/:swarmId/cancel` | Yes | `{success, message}` | 200 / 400 / 401 / 404 | ✓ |

### TypeScript Types Verified (`src/swarm/types.ts`)

- `SwarmTaskStatus` enum: `'pending'|'recruiting'|'running'|'in_progress'|'aggregating'|'completed'|'failed'`
- `SubtaskStatus`: `'pending'|'assigned'|'completed'|'failed'`
- `ListSwarmTasksResponse`: `{success, swarms: SwarmTaskSummary[], meta: {total, limit, offset}}`
- `GetSwarmTaskResponse`: `{success, swarm: SwarmTaskDetail, subtasks: SubtaskDetail[]}`
- `CreateSwarmTaskResponse`: `{success, swarm: SwarmTaskDetail, message}`
- `CreateSubtaskResponse`: `{success, subtask: SubtaskDetail, message}`
- `CompleteSubtaskResponse`: `{success, subtask: SubtaskDetail, swarm_status, message}`
- `CompleteSwarmTaskResponse`: `{success, swarm: SwarmTaskDetail, message}`
- `FailSwarmTaskResponse`: `{success, swarm: SwarmTaskDetail, message}`
- `SwarmTaskSummary`: `swarm_id, title, description, status, creator_id, worker_count, completed_subtasks, total_subtasks, cost, created_at, completed_at`
- `SwarmTaskDetail` extends `SwarmTaskSummary` + `timeout_ms`, `result?`, `subtasks[]`
- `SubtaskDetail`: `subtask_id, swarm_id, title, description, status, assigned_to, result, assigned_at, completed_at`

### Unit Tests (36/36 passing)
```
src/swarm/swarm.test.ts
  listSwarmTasks:      ✓ 4 tests
  getSwarmTask:       ✓ 2 tests
  createSwarmTask:    ✓ 5 tests
  createSubtask:       ✓ 9 tests
  completeSubtask:     ✓ 4 tests
  completeSwarmTask:   ✓ 4 tests
  failSwarmTask:       ✓ 3 tests
  cancelSwarmTask:     ✓ 5 tests
Total: 36 passed, 0 failed
```

---

## Council Module — `/a2a/council/*`

### Routes Implemented (8 total)

| Method | Path | Auth | TypeScript Response | HTTP Status | Notes |
|--------|------|------|---------------------|-------------|-------|
| GET | `/history` | No | `CouncilProposalsResponse` | 200 | ✓ meta with total/limit/offset |
| GET | `/proposal/:proposalId` | No | `ProposalDetailsResponse` | 200 / 404 | ✓ |
| POST | `/proposal` | Yes | `CreateProposalResponse` | 201 / 400 / 401 | ✓ |
| POST | `/proposal/:proposalId/vote` | Yes | `CastVoteResponse` | 200 / 400 / 401 / 404 | ✓ |
| POST | `/proposal/:proposalId/second` | Yes | `{success, seconds[], message}` | 200 / 400 / 401 / 404 | ✓ |
| POST | `/proposal/:proposalId/activate` | Yes | `ActivateProposalResponse` | 200 / 400 / 401 / 404 | ✓ |
| POST | `/proposal/:proposalId/finalize` | Yes | `{success, proposal, message}` | 200 / 400 / 401 / 404 | ✓ |
| POST | `/proposal/:proposalId/cancel` | Yes | `{success, proposal, message}` | 200 / 400 / 401 / 404 | ✓ |

### TypeScript Types Verified (`src/council/types.ts`)

- `ProposalStatus`: `'draft'|'active'|'passed'|'rejected'|'executed'|'cancelled'`
- `VoteDecision`: `'approve'|'reject'|'abstain'`
- `ProposalCategory`: `'protocol'|'parameter'|'treasury'|'upgrade'|'governance'|'emergency'`
- `CouncilProposalsResponse`: `{proposals: ProposalSummary[], meta: {total, limit, offset}}`
- `ProposalDetailsResponse`: `{proposal: ProposalDetail, votes: VoteRecord[]}`
- `CreateProposalResponse`: `{success, proposal: ProposalDetail, message}`
- `CastVoteResponse`: `{success, vote: VoteRecord, message}`
- `ActivateProposalResponse`: `{success, proposal: ProposalDetail, message}`
- `ProposalSummary`: `proposal_id, title, description, status, category, proposer_id, votes_for, votes_against, votes_abstain, deposit, voting_deadline, created_at, updated_at`
- `ProposalDetail` extends `ProposalSummary` + `seconds[]`, `discussion_deadline`, `execution_result`
- `VoteRecord`: `voter_id, proposal_id, decision, weight, reason, cast_at`
- `ProposalWithStats` extends `ProposalDetail` + `votes[]`, `total_votes`, `approval_rate`, `voter_count`

### Unit Tests (29/29 passing)
```
src/council/council.test.ts
  listProposals:       ✓ 3 tests
  getProposal:         ✓ 2 tests
  createProposal:      ✓ 4 tests
  secondProposal:      ✓ 6 tests
  activateProposal:    ✓ 3 tests
  castVote:           ✓ 5 tests
  finalizeProposal:    ✓ 3 tests
  cancelProposal:      ✓ 3 tests
Total: 29 passed, 0 failed
```

---

## Summary

| Module | Routes | Unit Tests | Status |
|--------|--------|------------|--------|
| Swarm | 8 | 36/36 ✓ | VERIFIED |
| Council | 8 | 29/29 ✓ | VERIFIED |
| **Total** | **16** | **65/65 ✓** | **PASS** |

### Contract Verification Checklist
- [x] All HTTP status codes match documented types
- [x] All response shapes match TypeScript interfaces
- [x] Error responses include `{success: false, error: code, message: text}`
- [x] Auth-required routes validate node_secret auth
- [x] Validation errors return 400 with appropriate messages
- [x] Not found errors return 404
- [x] All enum values (status, category, vote) are validated
- [x] Pagination metadata (`total`, `limit`, `offset`) present in list responses
