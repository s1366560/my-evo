# Contract Change Ledger — Architecture Gap Remediation

## Shared-Contract Ownership / Order Rules
1. `prisma/schema.prisma`, `src/shared/*`, and cross-domain contract surfaces in `src/a2a/routes.ts` are the shared spine and must land before or alongside downstream wave changes that consume them.
2. Any intentional contract drift in routes, auth/authz, trust/quarantine, subscription entitlements, or model-tier checks must be logged in this ledger in the same change that introduces it.
3. Architecture-doc fidelity overrides current backward compatibility when repo evidence proves divergence, but every intentional break must include migration notes and the owning verification command set.
4. When entitlements change, rerun and log the owner suites for `src/subscription/*`, `src/model_tier/*`, `src/sandbox/*`, and `src/workerpool/*`.
5. When trust/quarantine or security semantics change, rerun and log `src/quarantine/*`, `src/a2a/routes.test.ts`, `src/marketplace/routes.test.ts`, and relevant `src/security/*` suites.

## Current Ledger Entries

| date | wave | surface | chapters | change_type | summary | migration_notes | verification_ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-15 | 0 / 0.5 setup | Shared contract spine | 3, 24, 29, 30, 38, 39 | planning-only | Initialized ledger and ownership rules; no route/schema/runtime contract changes have been introduced in this worker change yet. | Add concrete migration guidance here when shared contract or public API behavior changes land. | `verification-log-architecture-gap-remediation.md` (Wave 0 inventory, final global gates) |
| 2026-04-15 | 3 | Credit Marketplace parity slice | 21, 9, 20 | route + service contract | Realigned `/a2a/bid/place` to submit a bid against an existing bounty, added `/a2a/bid/accept`, exposed Chapter-21 aliases (`bid_amount`, `estimated_completion`, `proposal`, `reputation_escrow`, `reward_credits`), and enriched `/marketplace/stats` with price tiers, averages, top categories, and bounty counts. | Clients using the old self-bounty interpretation of `/a2a/bid/place` must now send `bounty_id`; `amount/estimatedTime/approach` remain accepted as compatibility aliases for `bid_amount/estimated_completion/proposal`. | `verification-log-architecture-gap-remediation.md` (Wave 3 Chapter 21 parity slice) |
| 2026-04-15 | 3 | Credit Marketplace schema alignment | 21, 9 | schema + service contract | Added persistent `milestones`, `winner_id`, and `reputation_escrow` fields to bounty models and updated refund/release paths so escrow is explicitly tracked instead of recomputed ad hoc. Also corrected dynamic pricing to use network asset GDI averages instead of node reputation averages. | Run `npm run db:generate` after pulling this change so Prisma Client reflects the new bounty schema. Existing callers may continue to read legacy bounty fields; the new aliases and stored fields are additive. | `verification-log-architecture-gap-remediation.md` (Wave 3 Chapter 21 parity slice) |
| 2026-04-15 | 3 | Credit Marketplace milestone workflow closure | 21 | schema + workflow contract | Promoted milestone workflow from JSON-only metadata to a first-class relational path with `BountyMilestone`, while retaining JSON as a compatibility mirror. Submit/review flows now sync relational milestone status, deliverable text, and partial payout state before final settlement. | Consumers can continue reading `Bounty.milestones`, but new code should prefer the relational milestone path when extending Chapter 21. | `verification-log-architecture-gap-remediation.md` (Final Global Gates — Post Chapter 21 follow-up) |

## Watchlist for Future Entries
- A2A directory / DM semantics that move or rename endpoints
- Shared auth or API-key semantics in `src/shared/auth.ts` / `src/account/*`
- Quarantine and verifiable trust gating behavior
- Subscription plan semantics, grace periods, entitlement propagation, and model-tier gates
- Marketplace/service exposure changes, especially when mirrored through `src/a2a/routes.ts`
