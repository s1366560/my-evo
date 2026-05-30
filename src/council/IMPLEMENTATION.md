/**
 * ============================================================
 * Council Module Implementation Plan
 * AI Governance: Proposal Submission, Voting, and Results
 * ============================================================
 *
 * Task: 调研并规划 council 模块
 * Module: src/council/
 * Date: 2026-05-29
 *
 * ============================================================
 * 1. RESEARCH SUMMARY
 * ============================================================
 *
 * Sources consulted:
 * - docs/GAP-EXTRACT-P0-P1.md
 * - prisma/schema.prisma (Proposal, ProposalVote models)
 * - frontend/src/app/council/page.tsx (frontend contract)
 * - frontend/src/lib/api/endpoints.ts (API endpoints)
 * - frontend/src/lib/api/client.ts (API client methods)
 * - src/subscription/routes.ts (pattern reference)
 * - src/shared/auth.ts (auth middleware)
 *
 * Key findings:
 * - Prisma already has Proposal and ProposalVote models defined
 * - Frontend expects GET /a2a/council/history and POST /a2a/council/proposal/:id/vote
 * - Voting weight is based on node reputation (GDI score)
 * - Proposal lifecycle: draft → active → passed/rejected → executed
 *
 * ============================================================
 * 2. DATA MODEL (prisma/schema.prisma already has these)
 * ============================================================
 *
 * Proposal:
 * - id, proposal_id (unique), title, description
 * - proposer_id, status (draft|active|passed|rejected|executed|cancelled)
 * - category (protocol|parameter|treasury|upgrade|governance|emergency)
 * - seconds: String[] (nodes that endorsed the proposal)
 * - deposit: Int (credits locked as security)
 * - discussion_deadline, voting_deadline: DateTime?
 * - execution_result: String?
 * - created_at, updated_at
 * - Relation: votes: ProposalVote[]
 *
 * ProposalVote:
 * - id, voter_id, proposal_id
 * - decision: String (approve|reject|abstain)
 * - weight: Float (based on node reputation)
 * - reason: String?
 * - cast_at
 * - Unique constraint: [voter_id, proposal_id]
 *
 * ============================================================
 * 3. API ENDPOINTS (implemented in routes.ts)
 * ============================================================
 *
 * Route Prefix: /a2a/council
 *
 * Public:
 * - GET  /history              List proposals (pagination, status filter)
 * - GET  /proposal/:id         Get proposal details + votes
 *
 * Authenticated (requireNodeSecretAuth):
 * - POST /proposal             Create new proposal (draft)
 * - POST /proposal/:id/second  Second an open proposal
 * - POST /proposal/:id/activate Activate for voting (requires minSeconds)
 * - POST /proposal/:id/vote    Cast vote (approve|reject|abstain)
 * - POST /proposal/:id/finalize Tally votes, determine outcome
 * - POST /proposal/:id/cancel  Cancel draft proposal, refund deposit
 *
 * ============================================================
 * 4. SERVICE LAYER (service.ts)
 * ============================================================
 *
 * Functions:
 * - listProposals(prisma, opts) → {proposals, total}
 * - getProposal(prisma, proposalId) → ProposalWithStats | null
 * - createProposal(prisma, input) → ProposalDetail
 * - secondProposal(prisma, proposalId, seconderId) → {success, seconds}
 * - activateProposal(prisma, proposalId, activatorId) → ProposalDetail
 * - castVote(prisma, input) → VoteRecord
 * - finalizeProposal(prisma, proposalId) → ProposalDetail
 * - cancelProposal(prisma, proposalId, cancellerId) → ProposalDetail
 *
 * Business Rules:
 * - Min reputation to propose: 30
 * - Min reputation to vote: 10
 * - Min deposit: 50 credits
 * - Min seconds to activate: 3
 * - Voting weight: reputation ≥80 → 3.0, ≥60 → 2.0, else 1.0
 * - Simple majority: approve_weight > reject_weight → passed
 * - Deposit refunded on passed or cancelled
 *
 * ============================================================
 * 5. TYPES (types.ts)
 * ============================================================
 *
 * Core types:
 * - ProposalStatus: draft | active | passed | rejected | executed | cancelled
 * - VoteDecision: approve | reject | abstain
 * - ProposalCategory: protocol | parameter | treasury | upgrade | governance | emergency
 *
 * API types:
 * - CouncilProposalsResponse
 * - ProposalDetailsResponse
 * - CreateProposalRequest / Response
 * - CastVoteRequest / Response
 *
 * Domain types:
 * - ProposalSummary (list view)
 * - ProposalDetail (full view with seconds)
 * - VoteRecord
 * - ProposalWithStats (computed stats)
 *
 * ============================================================
 * 6. IMPLEMENTATION STATUS
 * ============================================================
 *
 * ✅ types.ts     — Complete type definitions
 * ✅ service.ts   — Complete service layer (8 functions)
 * ✅ routes.ts    — Complete routes (8 endpoints)
 * ⏳ tests        — Not yet written
 *
 * ============================================================
 * 7. FILES CREATED
 * ============================================================
 *
 * src/council/types.ts           — Type definitions
 * src/council/service.ts         — Service layer (business logic)
 * src/council/routes.ts         — API routes
 * src/council/IMPLEMENTATION.md — This plan
 *
 * ============================================================
 * 8. INTEGRATION NOTES
 * ============================================================
 *
 * The routes must be registered in src/app.ts:
 *   app.register(councilRoutes, { prefix: '/a2a/council' });
 *
 * The frontend already has:
 * - API client methods: getCouncilProposals(), castVote()
 * - Endpoints: /a2a/council/history, /a2a/council/proposal/:id/vote
 * - UI components: CouncilPage, ProposalCard, StatusBadge
 *
 * ============================================================
 * 9. NEXT STEPS (for Builder Agent)
 * ============================================================
 *
 * 1. Add unit tests in src/council/service.test.ts
 * 2. Verify TypeScript compilation: cd backend && npm run build
 * 3. Register routes in src/app.ts (if not already registered)
 * 4. Run integration tests against the API
 * 5. Verify frontend council page loads correctly
 *
 * ============================================================
 * 10. ESTIMATED EFFORT
 * ============================================================
 *
 * - Types & service layer: 4h (COMPLETED)
 * - Routes: 2h (COMPLETED)
 * - Tests: 4h (PENDING)
 * - Integration verification: 2h (PENDING)
 * - Total: ~12h
 */
