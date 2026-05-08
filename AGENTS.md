# My Evo — Agent Instructions

AI self-evolution platform based on the GEP protocol (Hub/Marketplace, A2A, Bounty, Reputation, Memory, GDI scoring).

## Repository layout

This is a **two-package monorepo** (no workspace tool — each package has its own `package.json` and `node_modules`):

| Path | Stack | Purpose |
|---|---|---|
| [backend/](backend/) | Express 4 + Prisma + SQLite + TypeScript (ESM, `tsx`/`tsc`) | REST API at `:3001` (`/auth`, `/a2a`, `/bounty`, `/map`, `/health`) |
| [frontend/](frontend/) | Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui + Zustand | Web UI at `:3002` (dev) / `:3000` (prod). Proxies to backend via `/api/frontend/**` route handlers |
| [docs/](docs/) | Markdown | Architecture, API specs, deployment runbooks (mostly Chinese) |
| [src/](src/) | — | **Legacy scaffolding** (50+ feature folders like `a2a/`, `kg/`, `swarm/`). Not wired into either package's build. Do not modify unless explicitly asked. |
| Root `*.js` files (`e2e-test.js`, `generate-ppt*.js`, `test-*.js`) | Node | Standalone scripts (Playwright e2e, PPT generation). Root [package.json](package.json) only declares Playwright/axe deps. |

## Build & test commands

Run from the relevant package directory.

**Backend** ([backend/package.json](backend/package.json)):
```
npm run dev                    # tsx watch on :3001
npm run build && npm start     # tsc → dist/, then node
npm test                       # jest --coverage (tests in backend/src/__tests__/**/*.test.ts)
npm run prisma:migrate         # apply Prisma migrations against DATABASE_URL (default: file:./dev.db)
npm run prisma:generate        # regenerate Prisma client (run after schema.prisma changes)
```

**Frontend** ([frontend/package.json](frontend/package.json)):
```
npm run dev                    # next dev -p 3002
npm run build && npm start     # next build, then next start -p 3000
npm run lint                   # next lint (eslint-config-next)
```

**Frontend has no unit-test runner configured** — tests are Playwright-based at the repo root and in [frontend/tests/](frontend/tests/).

## Conventions

- **TypeScript ESM imports in backend**: imports include `.js` extensions even for `.ts` source (e.g. `import { config } from './config/index.js'`). Match this pattern when adding files.
- **Backend pattern**: `routes/` (Express router) → `controllers/` (request handlers) → `services/` / direct Prisma in controllers. See [backend/src/index.ts](backend/src/index.ts), [backend/src/routes/auth.ts](backend/src/routes/auth.ts), [backend/src/controllers/authController.ts](backend/src/controllers/authController.ts).
- **Validation**: Zod schemas in [backend/src/models/schemas.ts](backend/src/models/schemas.ts), applied via `validateBody(schema)` middleware.
- **Auth**: JWT in `Authorization: Bearer <token>` via `authenticate` middleware ([backend/src/middleware/auth.ts](backend/src/middleware/auth.ts)).
- **Frontend API access**: UI calls Next.js route handlers under `frontend/src/app/api/frontend/**`, which forward to `process.env.BACKEND_URL` (default `http://localhost:3001`). Do not call the backend directly from client components.
- **State**: Zustand stores in [frontend/src/store/](frontend/src/store/). UI primitives from shadcn live in `frontend/src/components/ui/`.
- **Styling**: Tailwind only, with CSS variables `--background` / `--foreground`. No CSS-in-JS.
- **Error responses**: `{ error: "CODE", message: "...", details?: {} }` — match in new endpoints.

## Important: SPEC.md drift

[SPEC.md](SPEC.md) describes the *target* architecture (Fastify + PostgreSQL + Redis). The **actual implementation uses Express + SQLite**. When in doubt, trust the code, not the spec. Flag the drift to the user before reshaping infrastructure.

## Environment

- Backend: copy [backend/.env.example](backend/.env.example) → `backend/.env`. Minimum required: `DATABASE_URL`, `JWT_SECRET`.
- Frontend: optional `frontend/.env.local` with `BACKEND_URL=http://localhost:3001`.
- All `.env*` files (except `*.example`) are git-ignored — never commit secrets.

## Documentation map

Link to these rather than restating. Many are in Chinese.

- [docs/architecture/系统架构文档.md](docs/architecture/系统架构文档.md) — system architecture (definitive)
- [docs/architecture/API-Endpoint-Specifications.md](docs/architecture/API-Endpoint-Specifications.md) — full API contract (v1)
- [docs/architecture/Database-Schema-Reference.md](docs/architecture/Database-Schema-Reference.md) — DB schema
- [docs/architecture/Deployment-Runbook.md](docs/architecture/Deployment-Runbook.md) — ops/deploy
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) — source of truth for data model

## Pitfalls

- The repo has 174 tracked files but the worktree contains `node_modules/`, `.next/`, `dist/`, `coverage/`, and `test-results/` from prior builds — these are git-ignored, leave them alone.
- `master-with-history-backup` branch (local only) holds pre-cleanup history with large binaries. Do not push it.
- Top-level `node_modules/` (17 MB) only services the Playwright/axe scripts — runtime deps live in `backend/` and `frontend/`.
