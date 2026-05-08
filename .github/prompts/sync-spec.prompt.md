---
mode: agent
description: Reconcile SPEC.md with the actual Express+SQLite implementation
---

# Sync SPEC.md with implementation

[SPEC.md](../../SPEC.md) describes a *target* architecture (Fastify + PostgreSQL 15 + Redis 7, JWT-with-Redis-blacklist, etc.). The shipped code uses **Express 4 + Prisma + SQLite** with no Redis. This drift causes confusion for new agents and contributors.

## Goal
Produce a single, accurate SPEC.md that reflects the running system. Do **not** silently change architecture — propose changes for the user to approve.

## Steps

1. **Inventory the drift**. For each technology choice in SPEC.md, check the actual code:
   - Backend framework — `backend/package.json` `dependencies` (`express` vs `fastify`).
   - Database — [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) `datasource db { provider = ... }`.
   - Cache — search for `redis`, `ioredis`, `bull` in dependencies.
   - State libs frontend — `frontend/package.json` (`@tanstack/react-query` vs not present).
   - API base path — does the code mount `/api/v1/...`? Check [backend/src/index.ts](../../backend/src/index.ts) `app.use(...)` calls.

2. **Build a drift table**. Columns: *Topic | SPEC says | Code actually does | Recommendation*. Recommendations are one of:
   - `Update SPEC` — code is correct; the spec is aspirational.
   - `Update code` — spec was a deliberate decision and the code regressed.
   - `Decide with user` — neither is obviously right.

3. **Stop and present the table to the user**. Do not edit SPEC.md or code yet. Wait for explicit approval per row.

4. **Apply approved changes**:
   - For SPEC updates: edit [SPEC.md](../../SPEC.md) in place. Keep the table-of-contents structure. Add a `## Status` line near the top: `Reflects implementation as of <commit-sha>`.
   - For code updates: open a follow-up todo per item; do not bundle infrastructure swaps with documentation fixes in the same change.

5. **Cross-check linked docs** under [docs/architecture/](../../docs/architecture/) — especially `API-Endpoint-Specifications.md` and `Database-Schema-Reference.md`. Note any further drift but only fix what the user approved.

## Output
- The drift table (markdown).
- A list of files modified.
- A list of follow-up tasks for any "Update code" rows.
