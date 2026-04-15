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

## Watchlist for Future Entries
- A2A directory / DM semantics that move or rename endpoints
- Shared auth or API-key semantics in `src/shared/auth.ts` / `src/account/*`
- Quarantine and verifiable trust gating behavior
- Subscription plan semantics, grace periods, entitlement propagation, and model-tier gates
- Marketplace/service exposure changes, especially when mirrored through `src/a2a/routes.ts`
