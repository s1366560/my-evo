---
mode: agent
description: Code review tailored to my-evo conventions (Express+Prisma+Next.js)
---

# Code review — my-evo

Review the staged or specified changes against this repo's conventions. Be concise; quote the file:line for each finding.

## Checks

### Cross-cutting
- [ ] No new dependencies added without justification (check `package.json` diffs in both `backend/` and `frontend/`).
- [ ] No secrets or real env values committed; `.env*` (except `*.example`) stays git-ignored.
- [ ] No files outside the two real packages (`backend/`, `frontend/`) — the top-level `src/` is legacy scaffolding (see [AGENTS.md](../../AGENTS.md)).
- [ ] Error responses match `{ error, message, details? }`.

### Backend (`backend/**/*.ts`)
- [ ] Relative imports include `.js` extension (ESM requirement).
- [ ] New routes follow `routes/ → controllers/ → prisma` layering. No business logic in routers.
- [ ] Input validated via `validateBody(zodSchema)` middleware, schemas in [backend/src/models/schemas.ts](../../backend/src/models/schemas.ts).
- [ ] Prisma client imported from `../db/prisma.js` singleton — not instantiated locally.
- [ ] Auth-required endpoints use the `authenticate` middleware; `req.user` is read, never trusted from query/body.
- [ ] `schema.prisma` changes ship with a migration (`backend/prisma/migrations/...`) and `prisma generate` ran.
- [ ] Jest tests added/updated under `backend/src/__tests__/` for new logic.

### Frontend (`frontend/**/*.{ts,tsx}`)
- [ ] Client components are marked `'use client'` only when needed (state/effects/handlers).
- [ ] No client-side `fetch` to `http://localhost:3001` — UI calls go via `/api/frontend/**` route handlers.
- [ ] Only route handlers read `process.env.BACKEND_URL`.
- [ ] Styling is Tailwind only; conditional classes use `cn(...)` helper. No CSS-in-JS, no inline styles.
- [ ] State stays in Zustand stores under [frontend/src/store/](../../frontend/src/store/); no new global Context for app data.
- [ ] No new test runner introduced; e2e additions go to [frontend/tests/](../../frontend/tests/) following [tests.instructions.md](../instructions/tests.instructions.md).

### SPEC drift watch
- [ ] No PR sneakily introduces Fastify, PostgreSQL, or Redis. If the change moves the codebase toward [SPEC.md](../../SPEC.md), the user must explicitly approve. Otherwise flag.

## Output format
1. **Summary** — one paragraph, overall verdict (approve / approve-with-fixes / block).
2. **Findings** table — `Severity | File:Line | Issue | Suggested fix`. Severities: `block`, `nit`, `praise`.
3. **Suggested follow-ups** — anything out of scope but worth tracking.
